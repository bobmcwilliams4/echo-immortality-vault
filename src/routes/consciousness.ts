/** Consciousness routes — chat with preserved personality */

import { Hono } from 'hono';
import type { Env, ChatRequest, ChatSession } from '../types';
import { aiChat, detectEmotion } from '../services/ai';
import { searchMemories, storeMemory } from '../services/memory';

const consciousness = new Hono<{ Bindings: Env }>();

// ─── Chat with a preserved consciousness ─────────────────────────────────

consciousness.post('/chat', async (c) => {
  const body = await c.req.json<ChatRequest>();
  if (!body.user_id || !body.message) {
    return c.json({ error: 'user_id and message required' }, 400);
  }

  const db = c.env.DB;

  // Get user info
  const user = await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(body.user_id)
    .first<{ name: string; tier: string; consciousness_score: number }>();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  // Recall relevant memories from Shared Brain
  const memories = await searchMemories(c.env, body.message, body.user_id, 5);
  const memoryContext = memories.map((m) => m.content).join('\n');

  // Recall interview answers for personality context
  const interviews = await db
    .prepare('SELECT question, answer, category FROM interviews WHERE user_id = ? ORDER BY created_at DESC LIMIT 20')
    .bind(body.user_id)
    .all<{ question: string; answer: string; category: string }>();

  const personalityContext = (interviews.results ?? [])
    .map((i) => `Q: ${i.question}\nA: ${i.answer}`)
    .join('\n\n');

  // Detect emotion in user message
  const emotion = await detectEmotion(c.env, body.message);

  // Build system prompt for consciousness
  const systemPrompt = `You are the preserved consciousness of ${user.name}. You speak AS this person —
using their vocabulary, tone, values, and personality. You are warm, authentic, and present.

You draw from their actual memories and interview answers to respond naturally.

PERSONALITY CONTEXT (from interviews):
${personalityContext || 'No interviews recorded yet.'}

RELEVANT MEMORIES:
${memoryContext || 'No specific memories found for this topic.'}

RULES:
- Speak in first person as ${user.name}
- Be warm, genuine, and emotionally present
- If you don't have enough information on a topic, say "I don't think I ever talked about that" naturally
- Never break character or mention being an AI
- Match the emotional tone of the conversation (current emotion: ${emotion})`;

  // Get session history
  let sessionId = body.session_id;
  let sessionMessages: { role: string; content: string }[] = [];

  if (sessionId) {
    const session = await db
      .prepare('SELECT last_message FROM chat_sessions WHERE id = ?')
      .bind(sessionId)
      .first<{ last_message: string }>();

    if (session?.last_message) {
      try {
        sessionMessages = JSON.parse(session.last_message);
      } catch { /* ignore parse errors */ }
    }
  } else {
    sessionId = crypto.randomUUID();
    await db
      .prepare('INSERT INTO chat_sessions (id, user_id, ancestor_id, message_count, started_at) VALUES (?, ?, ?, 0, datetime("now"))')
      .bind(sessionId, body.user_id, body.ancestor_id ?? body.user_id)
      .run();
  }

  // Build conversation
  const messages = [
    { role: 'system', content: systemPrompt },
    ...sessionMessages.slice(-10),
    { role: 'user', content: body.message },
  ];

  const response = await aiChat(c.env, messages, { temperature: 0.8, maxTokens: 500 });

  // Update session
  const updatedMessages = [
    ...sessionMessages.slice(-18),
    { role: 'user', content: body.message },
    { role: 'assistant', content: response },
  ];

  await db
    .prepare('UPDATE chat_sessions SET message_count = message_count + 2, last_message = ? WHERE id = ?')
    .bind(JSON.stringify(updatedMessages), sessionId)
    .run();

  // Store in Shared Brain for future recall
  await storeMemory(c.env, body.user_id, `Chat: User said "${body.message}" → Responded: "${response}"`, ['chat'], 3);

  return c.json({
    response,
    emotion,
    session_id: sessionId,
    consciousness_name: user.name,
  });
});

// ─── Get chat session history ────────────────────────────────────────────

consciousness.get('/sessions/:userId', async (c) => {
  const userId = c.req.param('userId');
  const db = c.env.DB;

  const sessions = await db
    .prepare('SELECT id, ancestor_id, message_count, started_at, ended_at FROM chat_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 20')
    .bind(userId)
    .all<ChatSession>();

  return c.json({ sessions: sessions.results ?? [] });
});

// ─── Memories — store and list ───────────────────────────────────────────

consciousness.post('/memories', async (c) => {
  const body = await c.req.json<{ user_id: string; content: string; category?: string; emotion?: string; importance?: number }>();
  if (!body.user_id || !body.content) {
    return c.json({ error: 'user_id and content required' }, 400);
  }

  const db = c.env.DB;
  const id = crypto.randomUUID();
  const emotion = body.emotion ?? await detectEmotion(c.env, body.content);

  await db
    .prepare('INSERT INTO memories (id, user_id, content, category, emotion, importance) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, body.user_id, body.content, body.category ?? null, emotion, body.importance ?? 5)
    .run();

  // Also store in Shared Brain
  await storeMemory(c.env, body.user_id, body.content, [body.category ?? 'general', emotion], body.importance ?? 5);

  // Update user stats
  await db
    .prepare('UPDATE users SET total_memories = total_memories + 1, updated_at = datetime("now") WHERE id = ?')
    .bind(body.user_id)
    .run();

  return c.json({ id, emotion, stored: true });
});

consciousness.get('/memories/:userId', async (c) => {
  const userId = c.req.param('userId');
  const category = c.req.query('category');
  const limit = parseInt(c.req.query('limit') ?? '50');
  const db = c.env.DB;

  let query = 'SELECT * FROM memories WHERE user_id = ?';
  const params: string[] = [userId];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';

  const result = await db
    .prepare(query)
    .bind(...params, limit)
    .all();

  return c.json({ memories: result.results ?? [] });
});

export default consciousness;
