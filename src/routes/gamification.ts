/** Gamification routes — legacy score, achievements, streaks */

import { Hono } from 'hono';
import type { Env } from '../types';

const gamification = new Hono<{ Bindings: Env }>();

// Achievement definitions
const ACHIEVEMENT_DEFS = [
  { type: 'first_memory', title: 'First Memory', description: 'Stored your first memory', points: 10 },
  { type: 'first_interview', title: 'First Interview', description: 'Answered your first question', points: 10 },
  { type: 'storyteller', title: 'Storyteller', description: 'Answered 10 interview questions', points: 25 },
  { type: 'memory_keeper', title: 'Memory Keeper', description: 'Stored 25 memories', points: 25 },
  { type: 'voice_clone', title: 'Voice Immortal', description: 'Created a voice clone', points: 50 },
  { type: 'family_tree', title: 'Family Historian', description: 'Added 5 family members', points: 25 },
  { type: 'all_categories', title: 'Life Chronicler', description: 'Answered questions in all 12 categories', points: 100 },
  { type: 'legacy_session', title: 'Legacy Keeper', description: 'Completed a legacy session', points: 50 },
  { type: 'fifty_answers', title: 'Deep Roots', description: 'Answered 50 interview questions', points: 75 },
  { type: 'hundred_memories', title: 'Century of Memories', description: 'Stored 100 memories', points: 100 },
  { type: 'consciousness_ready', title: 'Digital Immortal', description: 'Consciousness score reached 80%', points: 200 },
  { type: 'first_chat', title: 'Hello Again', description: 'Had your first chat with a preserved consciousness', points: 25 },
];

gamification.get('/stats/:userId', async (c) => {
  const userId = c.req.param('userId');
  const db = c.env.DB;

  const user = await db
    .prepare('SELECT consciousness_score, total_memories, total_interviews, voice_clone_status FROM users WHERE id = ?')
    .bind(userId)
    .first<{ consciousness_score: number; total_memories: number; total_interviews: number; voice_clone_status: string }>();

  if (!user) return c.json({ error: 'User not found' }, 404);

  const achievements = await db
    .prepare('SELECT * FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC')
    .bind(userId)
    .all();

  const totalPoints = (achievements.results ?? []).reduce((sum, a: { points?: number }) => sum + (a.points ?? 0), 0);

  // Calculate consciousness score from components
  const interviewCoverage = Math.min(user.total_interviews / 80, 1.0) * 40;    // max 40 pts
  const memoryCoverage = Math.min(user.total_memories / 50, 1.0) * 30;          // max 30 pts
  const voiceBonus = user.voice_clone_status === 'active' ? 20 : 0;             // 20 pts
  const achievementBonus = Math.min(totalPoints / 500, 1.0) * 10;               // max 10 pts
  const consciousnessScore = Math.round(interviewCoverage + memoryCoverage + voiceBonus + achievementBonus);

  // Update score if changed
  if (consciousnessScore !== user.consciousness_score) {
    await db
      .prepare('UPDATE users SET consciousness_score = ?, updated_at = datetime("now") WHERE id = ?')
      .bind(consciousnessScore, userId)
      .run();
  }

  return c.json({
    user_id: userId,
    consciousness_score: consciousnessScore,
    total_memories: user.total_memories,
    total_interviews: user.total_interviews,
    voice_clone_status: user.voice_clone_status,
    total_points: totalPoints,
    achievements: achievements.results ?? [],
    available_achievements: ACHIEVEMENT_DEFS,
    level: consciousnessScore >= 80 ? 'Immortal' : consciousnessScore >= 60 ? 'Guardian' : consciousnessScore >= 40 ? 'Keeper' : consciousnessScore >= 20 ? 'Seeker' : 'Newcomer',
  });
});

gamification.post('/check/:userId', async (c) => {
  const userId = c.req.param('userId');
  const db = c.env.DB;

  const user = await db
    .prepare('SELECT total_memories, total_interviews, voice_clone_status FROM users WHERE id = ?')
    .bind(userId)
    .first<{ total_memories: number; total_interviews: number; voice_clone_status: string }>();

  if (!user) return c.json({ error: 'User not found' }, 404);

  const existing = await db
    .prepare('SELECT achievement_type FROM achievements WHERE user_id = ?')
    .bind(userId)
    .all<{ achievement_type: string }>();

  const existingTypes = new Set((existing.results ?? []).map((a) => a.achievement_type));
  const newAchievements: string[] = [];

  const checks: [string, boolean][] = [
    ['first_memory', user.total_memories >= 1],
    ['first_interview', user.total_interviews >= 1],
    ['storyteller', user.total_interviews >= 10],
    ['memory_keeper', user.total_memories >= 25],
    ['voice_clone', user.voice_clone_status === 'active'],
    ['fifty_answers', user.total_interviews >= 50],
    ['hundred_memories', user.total_memories >= 100],
  ];

  // Check family tree achievement
  const familyCount = await db
    .prepare('SELECT COUNT(*) as cnt FROM family_members WHERE vault_user_id = ?')
    .bind(userId)
    .first<{ cnt: number }>();
  checks.push(['family_tree', (familyCount?.cnt ?? 0) >= 5]);

  // Check all-categories achievement
  const catCount = await db
    .prepare('SELECT COUNT(DISTINCT category) as cnt FROM interviews WHERE user_id = ? AND category IS NOT NULL')
    .bind(userId)
    .first<{ cnt: number }>();
  checks.push(['all_categories', (catCount?.cnt ?? 0) >= 12]);

  for (const [type, earned] of checks) {
    if (earned && !existingTypes.has(type)) {
      const def = ACHIEVEMENT_DEFS.find((d) => d.type === type);
      if (def) {
        const id = crypto.randomUUID();
        await db
          .prepare('INSERT INTO achievements (id, user_id, achievement_type, title, description, points) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(id, userId, type, def.title, def.description, def.points)
          .run();
        newAchievements.push(type);
      }
    }
  }

  return c.json({ new_achievements: newAchievements, checked: checks.length });
});

export default gamification;
