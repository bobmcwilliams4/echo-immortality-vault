/** Voice routes — TTS synthesis + clone management */

import { Hono } from 'hono';
import type { Env, VoiceSynthRequest } from '../types';
import { synthesizeSpeech, getVoiceCloneStatus } from '../services/voice';
import { detectEmotion } from '../services/ai';

const voice = new Hono<{ Bindings: Env }>();

voice.post('/synthesize', async (c) => {
  const body = await c.req.json<VoiceSynthRequest>();
  if (!body.text) {
    return c.json({ error: 'text required' }, 400);
  }

  // Auto-detect emotion if not specified
  const emotion = body.emotion ?? await detectEmotion(c.env, body.text);

  // Default voice (Echo Prime) if none specified
  const voiceId = body.voice_id ?? 'keDMh3sQlEXKM4EQxvvi';

  const result = await synthesizeSpeech(c.env, body.text, voiceId, emotion);

  if (result.error) {
    return c.json({ error: result.error }, 500);
  }

  // Return audio as binary
  return new Response(result.audio, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'X-Emotion': emotion,
    },
  });
});

voice.get('/profiles/:userId', async (c) => {
  const userId = c.req.param('userId');
  const db = c.env.DB;

  const profiles = await db
    .prepare('SELECT * FROM voice_profiles WHERE user_id = ? ORDER BY created_at DESC')
    .bind(userId)
    .all();

  return c.json({ profiles: profiles.results ?? [] });
});

voice.post('/profiles', async (c) => {
  const body = await c.req.json<{ user_id: string; provider?: string; voice_id?: string }>();
  if (!body.user_id) {
    return c.json({ error: 'user_id required' }, 400);
  }

  const id = crypto.randomUUID();
  const db = c.env.DB;

  await db
    .prepare('INSERT INTO voice_profiles (id, user_id, provider, voice_id, clone_status) VALUES (?, ?, ?, ?, ?)')
    .bind(id, body.user_id, body.provider ?? 'elevenlabs', body.voice_id ?? null, body.voice_id ? 'active' : 'pending')
    .run();

  return c.json({ id, created: true });
});

voice.get('/clone-status/:voiceId', async (c) => {
  const voiceId = c.req.param('voiceId');
  const status = await getVoiceCloneStatus(c.env, voiceId);
  return c.json(status);
});

export default voice;
