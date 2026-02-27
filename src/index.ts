/**
 * ECHO IMMORTALITY VAULT — Cloudflare Worker
 *
 * Digital consciousness preservation API.
 * Preserves voice, memories, personality, and wisdom
 * so loved ones can talk to you forever.
 *
 * Built by Bobby Don McWilliams II
 * Echo Prime Technologies — echo-ept.com
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './types';

import health from './routes/health';
import consciousness from './routes/consciousness';
import interview from './routes/interview';
import family from './routes/family';
import voice from './routes/voice';
import gamification from './routes/gamification';

const app = new Hono<{ Bindings: Env }>();

// ─── CORS ────────────────────────────────────────────────────────────────

app.use('*', cors({
  origin: [
    'https://echo-ept.com',
    'https://echo-op.com',
    'https://immortality-vault.vercel.app',
    'http://localhost:3000',
    'http://localhost:8081',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Echo-API-Key'],
  maxAge: 86400,
}));

// ─── Root ────────────────────────────────────────────────────────────────

app.get('/', (c) =>
  c.json({
    service: 'echo-immortality-vault',
    version: '1.0.0',
    tagline: 'Preserve Your Legacy. Forever.',
    docs: 'https://echo-ept.com/vault',
  }),
);

// ─── Mount routes ────────────────────────────────────────────────────────

app.route('/health', health);
app.route('/', consciousness);        // /chat, /memories, /sessions
app.route('/interview', interview);     // /interview/questions/*, /interview/interviews/*
app.route('/family', family);           // /family/:vaultUserId, CRUD
app.route('/voice', voice);             // /voice/synthesize, /voice/profiles, /voice/clone-status
app.route('/gamification', gamification); // /gamification/stats/:userId, /gamification/check/:userId

// ─── User management ────────────────────────────────────────────────────

app.post('/users', async (c) => {
  const body = await c.req.json<{ id?: string; name: string; email?: string; tier?: string }>();
  if (!body.name) return c.json({ error: 'name required' }, 400);

  const id = body.id ?? crypto.randomUUID();
  const db = c.env.DB;

  await db
    .prepare('INSERT OR IGNORE INTO users (id, name, email, tier) VALUES (?, ?, ?, ?)')
    .bind(id, body.name, body.email ?? null, body.tier ?? 'free')
    .run();

  return c.json({ id, name: body.name, created: true });
});

app.get('/users/:id', async (c) => {
  const id = c.req.param('id');
  const user = await c.env.DB
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first();

  if (!user) return c.json({ error: 'User not found' }, 404);
  return c.json(user);
});

// ─── Stats ───────────────────────────────────────────────────────────────

app.get('/stats', async (c) => {
  const db = c.env.DB;

  const users = await db.prepare('SELECT COUNT(*) as cnt FROM users').first<{ cnt: number }>();
  const memories = await db.prepare('SELECT COUNT(*) as cnt FROM memories').first<{ cnt: number }>();
  const interviews = await db.prepare('SELECT COUNT(*) as cnt FROM interviews').first<{ cnt: number }>();
  const family = await db.prepare('SELECT COUNT(*) as cnt FROM family_members').first<{ cnt: number }>();
  const sessions = await db.prepare('SELECT COUNT(*) as cnt FROM chat_sessions').first<{ cnt: number }>();

  return c.json({
    users: users?.cnt ?? 0,
    memories: memories?.cnt ?? 0,
    interviews: interviews?.cnt ?? 0,
    family_members: family?.cnt ?? 0,
    chat_sessions: sessions?.cnt ?? 0,
    timestamp: new Date().toISOString(),
  });
});

// ─── Schema init (admin) ────────────────────────────────────────────────

app.post('/init-schema', async (c) => {
  const apiKey = c.req.header('X-Echo-API-Key');
  if (apiKey !== c.env.ECHO_API_KEY) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = c.env.DB;
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT, tier TEXT DEFAULT 'free', consciousness_score REAL DEFAULT 0, total_memories INTEGER DEFAULT 0, total_interviews INTEGER DEFAULT 0, voice_clone_status TEXT DEFAULT 'none', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, content TEXT NOT NULL, category TEXT, emotion TEXT, importance INTEGER DEFAULT 5, source TEXT DEFAULT 'manual', created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS interviews (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, question_id TEXT, question TEXT NOT NULL, answer TEXT, emotion TEXT, category TEXT, session_type TEXT, follow_ups TEXT, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS family_members (id TEXT PRIMARY KEY, vault_user_id TEXT NOT NULL, name TEXT NOT NULL, relationship TEXT, birth_date TEXT, death_date TEXT, bio TEXT, photo_url TEXT, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS voice_profiles (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, provider TEXT DEFAULT 'elevenlabs', voice_id TEXT, clone_status TEXT DEFAULT 'pending', sample_count INTEGER DEFAULT 0, quality_score REAL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS achievements (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, achievement_type TEXT NOT NULL, title TEXT, description TEXT, points INTEGER DEFAULT 0, unlocked_at TEXT DEFAULT (datetime('now')))`,
    `CREATE TABLE IF NOT EXISTS chat_sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, ancestor_id TEXT, message_count INTEGER DEFAULT 0, last_message TEXT, started_at TEXT DEFAULT (datetime('now')), ended_at TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_interviews_user ON interviews(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_family_vault ON family_members(vault_user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_achievements_user ON achievements(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_sessions(user_id)`,
  ];

  for (const sql of statements) {
    await db.prepare(sql).run();
  }

  return c.json({ initialized: true, tables: 7, indexes: 5 });
});

export default app;
