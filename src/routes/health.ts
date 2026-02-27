/** Health check endpoint */

import { Hono } from 'hono';
import type { Env } from '../types';

const health = new Hono<{ Bindings: Env }>();

health.get('/', async (c) => {
  const db = c.env.DB;

  // Quick D1 check
  let dbOk = false;
  let userCount = 0;
  let memoryCount = 0;
  try {
    const r = await db.prepare('SELECT COUNT(*) as cnt FROM users').first<{ cnt: number }>();
    userCount = r?.cnt ?? 0;
    const m = await db.prepare('SELECT COUNT(*) as cnt FROM memories').first<{ cnt: number }>();
    memoryCount = m?.cnt ?? 0;
    dbOk = true;
  } catch { /* D1 may not be initialized yet */ }

  return c.json({
    status: 'alive',
    service: 'echo-immortality-vault',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: dbOk ? 'connected' : 'disconnected',
    stats: { users: userCount, memories: memoryCount },
    endpoints: [
      '/health', '/chat', '/memories', '/interviews', '/questions',
      '/family', '/voice', '/achievements', '/stats',
    ],
  });
});

export default health;
