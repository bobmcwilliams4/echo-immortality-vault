/** Video & Biometric routes — upload, stream, biometric capture, FaceTime readiness */

import { Hono } from 'hono';
import type { Env, VideoUploadRequest, FaceTimeReadiness } from '../types';

const video = new Hono<{ Bindings: Env }>();

// ─── Upload video (multipart form) ───────────────────────────────────────

video.post('/upload', async (c) => {
  const ct = c.req.header('content-type') ?? '';

  let userId: string;
  let interviewId: string | undefined;
  let questionId: string | undefined;
  let durationSeconds: number | undefined;
  let cameraFacing = 'front';
  let transcription: string | undefined;
  let fileBytes: ArrayBuffer;
  let mimeType = 'video/mp4';

  if (ct.includes('multipart/form-data')) {
    const form = await c.req.formData();
    const file = form.get('file');
    if (!file || !(file instanceof File)) return c.json({ error: 'file required (multipart)' }, 400);

    userId = (form.get('user_id') as string) ?? '';
    interviewId = (form.get('interview_id') as string) || undefined;
    questionId = (form.get('question_id') as string) || undefined;
    durationSeconds = form.get('duration_seconds') ? Number(form.get('duration_seconds')) : undefined;
    cameraFacing = (form.get('camera_facing') as string) || 'front';
    transcription = (form.get('transcription') as string) || undefined;
    fileBytes = await file.arrayBuffer();
    mimeType = file.type || 'video/mp4';
  } else {
    // Raw body upload with metadata in headers/query
    userId = c.req.query('user_id') ?? '';
    interviewId = c.req.query('interview_id') || undefined;
    questionId = c.req.query('question_id') || undefined;
    durationSeconds = c.req.query('duration_seconds') ? Number(c.req.query('duration_seconds')) : undefined;
    cameraFacing = c.req.query('camera_facing') || 'front';
    transcription = c.req.query('transcription') || undefined;
    fileBytes = await c.req.arrayBuffer();
  }

  if (!userId) return c.json({ error: 'user_id required' }, 400);
  if (!fileBytes || fileBytes.byteLength === 0) return c.json({ error: 'Empty file' }, 400);

  const id = crypto.randomUUID();
  const r2Key = `videos/${userId}/${id}.mp4`;

  // Upload to R2
  await c.env.MEDIA_BUCKET.put(r2Key, fileBytes, {
    httpMetadata: { contentType: mimeType },
    customMetadata: { userId, videoId: id },
  });

  // Store metadata in D1
  await c.env.DB
    .prepare(
      `INSERT INTO video_recordings (id, user_id, interview_id, question_id, r2_key, duration_seconds, file_size, mime_type, camera_facing, biometric_status, transcription)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .bind(id, userId, interviewId ?? null, questionId ?? null, r2Key, durationSeconds ?? null, fileBytes.byteLength, mimeType, cameraFacing, transcription ?? null)
    .run();

  // Link to interview if question_id provided
  if (questionId) {
    await c.env.DB
      .prepare('UPDATE interviews SET video_id = ? WHERE user_id = ? AND question_id = ? AND video_id IS NULL ORDER BY created_at DESC LIMIT 1')
      .bind(id, userId, questionId)
      .run();
  }

  return c.json({
    id,
    r2_key: r2Key,
    file_size: fileBytes.byteLength,
    biometric_status: 'pending',
    message: 'Video uploaded — biometric processing will begin automatically',
  });
});

// ─── Stream video from R2 ──────────────────────────────────────────────

video.get('/stream/:videoId', async (c) => {
  const videoId = c.req.param('videoId');
  const rec = await c.env.DB
    .prepare('SELECT r2_key, mime_type FROM video_recordings WHERE id = ?')
    .bind(videoId)
    .first<{ r2_key: string; mime_type: string }>();

  if (!rec) return c.json({ error: 'Video not found' }, 404);

  const obj = await c.env.MEDIA_BUCKET.get(rec.r2_key);
  if (!obj) return c.json({ error: 'Video file missing from storage' }, 404);

  return new Response(obj.body, {
    headers: {
      'Content-Type': rec.mime_type || 'video/mp4',
      'Cache-Control': 'public, max-age=86400',
    },
  });
});

// ─── Video metadata ────────────────────────────────────────────────────

video.get('/metadata/:videoId', async (c) => {
  const videoId = c.req.param('videoId');
  const rec = await c.env.DB
    .prepare('SELECT * FROM video_recordings WHERE id = ?')
    .bind(videoId)
    .first();

  if (!rec) return c.json({ error: 'Video not found' }, 404);

  const biometrics = await c.env.DB
    .prepare('SELECT id, capture_type, confidence, frame_start, frame_end, created_at FROM biometric_captures WHERE video_id = ?')
    .bind(videoId)
    .all();

  return c.json({ video: rec, biometrics: biometrics.results ?? [] });
});

// ─── List videos for user ──────────────────────────────────────────────

video.get('/list/:userId', async (c) => {
  const userId = c.req.param('userId');
  const limit = Number(c.req.query('limit') ?? 50);

  const result = await c.env.DB
    .prepare('SELECT id, interview_id, question_id, duration_seconds, file_size, camera_facing, biometric_status, created_at FROM video_recordings WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .bind(userId, limit)
    .all();

  return c.json({ videos: result.results ?? [], count: result.results?.length ?? 0 });
});

// ─── Store biometric capture data (from client-side processing) ─────────

video.post('/biometric/:videoId', async (c) => {
  const videoId = c.req.param('videoId');
  const body = await c.req.json<{
    user_id: string;
    captures: Array<{
      capture_type: string;
      data_json: string;
      confidence: number;
      frame_start?: number;
      frame_end?: number;
    }>;
  }>();

  if (!body.user_id || !body.captures?.length) {
    return c.json({ error: 'user_id and captures[] required' }, 400);
  }

  // Verify video exists
  const exists = await c.env.DB
    .prepare('SELECT id FROM video_recordings WHERE id = ? AND user_id = ?')
    .bind(videoId, body.user_id)
    .first();

  if (!exists) return c.json({ error: 'Video not found or access denied' }, 404);

  let inserted = 0;
  for (const cap of body.captures) {
    const id = crypto.randomUUID();
    await c.env.DB
      .prepare(
        `INSERT INTO biometric_captures (id, user_id, video_id, capture_type, data_json, confidence, frame_start, frame_end)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, body.user_id, videoId, cap.capture_type, cap.data_json, cap.confidence ?? 0, cap.frame_start ?? null, cap.frame_end ?? null)
      .run();
    inserted++;
  }

  // Update video biometric_status
  await c.env.DB
    .prepare("UPDATE video_recordings SET biometric_status = 'complete' WHERE id = ?")
    .bind(videoId)
    .run();

  return c.json({ stored: inserted, video_id: videoId, biometric_status: 'complete' });
});

// ─── FaceTime readiness score ──────────────────────────────────────────

video.get('/facetime-readiness/:userId', async (c) => {
  const userId = c.req.param('userId');

  const videoCount = await c.env.DB
    .prepare('SELECT COUNT(*) as cnt FROM video_recordings WHERE user_id = ?')
    .bind(userId)
    .first<{ cnt: number }>();

  const biometricCounts = await c.env.DB
    .prepare(
      `SELECT capture_type, COUNT(*) as cnt FROM biometric_captures WHERE user_id = ? GROUP BY capture_type`,
    )
    .bind(userId)
    .all<{ capture_type: string; cnt: number }>();

  const counts: Record<string, number> = {};
  for (const row of biometricCounts.results ?? []) {
    counts[row.capture_type] = row.cnt;
  }

  const videosRecorded = videoCount?.cnt ?? 0;
  const faceMesh = counts['face_mesh'] ?? 0;
  const lipSync = counts['lip_sync'] ?? 0;
  const emotion = counts['emotion'] ?? 0;
  const mannerism = counts['mannerism'] ?? 0;
  const bodyPose = counts['body_pose'] ?? 0;

  // Minimum thresholds for FaceTime readiness
  const THRESHOLDS = {
    videos: 5,
    face_mesh: 10,
    lip_sync: 10,
    emotion: 8,
    mannerism: 5,
    body_pose: 3,
  };

  const missing: string[] = [];
  if (videosRecorded < THRESHOLDS.videos) missing.push(`Need ${THRESHOLDS.videos - videosRecorded} more video recordings`);
  if (faceMesh < THRESHOLDS.face_mesh) missing.push(`Need ${THRESHOLDS.face_mesh - faceMesh} more face mesh captures`);
  if (lipSync < THRESHOLDS.lip_sync) missing.push(`Need ${THRESHOLDS.lip_sync - lipSync} more lip sync captures`);
  if (emotion < THRESHOLDS.emotion) missing.push(`Need ${THRESHOLDS.emotion - emotion} more emotion captures`);
  if (mannerism < THRESHOLDS.mannerism) missing.push(`Need ${THRESHOLDS.mannerism - mannerism} more mannerism captures`);
  if (bodyPose < THRESHOLDS.body_pose) missing.push(`Need ${THRESHOLDS.body_pose - bodyPose} more body pose captures`);

  // Weighted score (0-100)
  const score = Math.min(100, Math.round(
    (Math.min(videosRecorded / THRESHOLDS.videos, 1) * 20) +
    (Math.min(faceMesh / THRESHOLDS.face_mesh, 1) * 25) +
    (Math.min(lipSync / THRESHOLDS.lip_sync, 1) * 25) +
    (Math.min(emotion / THRESHOLDS.emotion, 1) * 15) +
    (Math.min(mannerism / THRESHOLDS.mannerism, 1) * 10) +
    (Math.min(bodyPose / THRESHOLDS.body_pose, 1) * 5),
  ));

  const readiness: FaceTimeReadiness = {
    user_id: userId,
    ready: missing.length === 0,
    score,
    requirements: {
      videos_recorded: videosRecorded,
      videos_needed: THRESHOLDS.videos,
      face_mesh_captures: faceMesh,
      lip_sync_captures: lipSync,
      emotion_captures: emotion,
      mannerism_captures: mannerism,
      body_pose_captures: bodyPose,
    },
    missing,
  };

  return c.json(readiness);
});

// ─── Delete video ──────────────────────────────────────────────────────

video.delete('/:videoId', async (c) => {
  const videoId = c.req.param('videoId');
  const userId = c.req.query('user_id');

  const rec = await c.env.DB
    .prepare('SELECT r2_key, user_id FROM video_recordings WHERE id = ?')
    .bind(videoId)
    .first<{ r2_key: string; user_id: string }>();

  if (!rec) return c.json({ error: 'Video not found' }, 404);
  if (userId && rec.user_id !== userId) return c.json({ error: 'Access denied' }, 403);

  // Delete from R2
  await c.env.MEDIA_BUCKET.delete(rec.r2_key);

  // Delete biometric data
  await c.env.DB
    .prepare('DELETE FROM biometric_captures WHERE video_id = ?')
    .bind(videoId)
    .run();

  // Delete video record
  await c.env.DB
    .prepare('DELETE FROM video_recordings WHERE id = ?')
    .bind(videoId)
    .run();

  return c.json({ deleted: true, video_id: videoId });
});

export default video;
