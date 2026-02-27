/** Interview routes — question engine + answer recording */

import { Hono } from 'hono';
import type { Env, InterviewAnswerRequest, QuestionItem } from '../types';
import { aiChat, detectEmotion } from '../services/ai';
import { storeMemory } from '../services/memory';

const interview = new Hono<{ Bindings: Env }>();

// ─── Embedded Question Bank (subset for Workers — full bank is 216 Qs) ───

const CATEGORIES = [
  'childhood', 'education', 'career', 'relationships', 'family', 'beliefs',
  'values', 'achievements', 'regrets', 'wisdom', 'daily_life', 'future_hopes',
] as const;

type Category = (typeof CATEGORIES)[number];

interface QDef { text: string; depth: string; priority: number; hints: string[]; tone: string }

const QUESTION_BANK: Record<Category, QDef[]> = {
  childhood: [
    { text: 'What is your earliest memory?', depth: 'light', priority: 1, hints: ['How old were you?', 'Who was there?'], tone: 'warm' },
    { text: 'Where did you grow up, and what was the neighborhood like?', depth: 'medium', priority: 2, hints: ['Who were the neighbors?'], tone: 'warm' },
    { text: 'Who was your best friend as a child?', depth: 'medium', priority: 2, hints: ['Are you still in touch?'], tone: 'warm' },
    { text: 'What games did you play as a kid?', depth: 'light', priority: 3, hints: [], tone: 'warm' },
    { text: 'Was there a moment in childhood that changed how you saw the world?', depth: 'deep', priority: 1, hints: ['How did it change you?'], tone: 'reflective' },
    { text: 'What did you want to be when you grew up?', depth: 'light', priority: 2, hints: ['Did that dream change?'], tone: 'warm' },
    { text: 'Who was the most influential adult in your childhood besides your parents?', depth: 'deep', priority: 2, hints: ['What did they teach you?'], tone: 'reflective' },
    { text: 'Describe a typical summer day from your childhood.', depth: 'narrative', priority: 2, hints: ['Who were you with?'], tone: 'warm' },
  ],
  education: [
    { text: 'What was your favorite subject in school and why?', depth: 'light', priority: 2, hints: [], tone: 'neutral' },
    { text: 'Was there a teacher who really impacted your life?', depth: 'medium', priority: 1, hints: ['What did they do?'], tone: 'reflective' },
    { text: 'What is the most important thing school taught you outside of academics?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'Did you go to college? What did you study?', depth: 'medium', priority: 2, hints: ['Why that major?'], tone: 'neutral' },
    { text: 'What advice about education would you give to a young person today?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'What book or lesson from school stayed with you for life?', depth: 'medium', priority: 2, hints: [], tone: 'reflective' },
  ],
  career: [
    { text: 'What was your first job?', depth: 'light', priority: 2, hints: ['How old were you?'], tone: 'neutral' },
    { text: 'How did you end up in the career you had?', depth: 'medium', priority: 1, hints: ['Was it planned?'], tone: 'reflective' },
    { text: 'What was the proudest moment of your career?', depth: 'deep', priority: 1, hints: ['Why does it stand out?'], tone: 'celebratory' },
    { text: 'What was the hardest professional challenge you faced?', depth: 'deep', priority: 1, hints: ['How did you handle it?'], tone: 'serious' },
    { text: 'What piece of career advice would you pass down?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'Tell me about a time you failed at work and what you learned.', depth: 'narrative', priority: 2, hints: [], tone: 'reflective' },
  ],
  relationships: [
    { text: 'How did you meet the love of your life?', depth: 'narrative', priority: 1, hints: ['What attracted you first?'], tone: 'warm' },
    { text: 'What is the secret to a lasting relationship?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'Who do you miss the most, and what would you say to them?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'What is the kindest thing anyone ever did for you?', depth: 'medium', priority: 1, hints: [], tone: 'warm' },
    { text: 'Tell me about a friend who has been like family.', depth: 'medium', priority: 2, hints: ['How did you meet?'], tone: 'warm' },
    { text: 'What did you learn about love that surprised you?', depth: 'deep', priority: 2, hints: [], tone: 'reflective' },
  ],
  family: [
    { text: 'Tell me about your parents — what kind of people were they?', depth: 'deep', priority: 1, hints: ['What values did they instill?'], tone: 'reflective' },
    { text: 'What is your favorite family tradition?', depth: 'medium', priority: 2, hints: ['How did it start?'], tone: 'warm' },
    { text: 'What moment with your children are you most proud of?', depth: 'deep', priority: 1, hints: [], tone: 'celebratory' },
    { text: 'What was the hardest part of being a parent?', depth: 'deep', priority: 1, hints: ['How did you handle it?'], tone: 'serious' },
    { text: 'What do you want your grandchildren to know about where they come from?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'What is the most important lesson your family taught you?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'If you could have one more family dinner with everyone, who would be at the table?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
  ],
  beliefs: [
    { text: 'Do you believe in God or a higher power? How has that shaped your life?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'What do you think happens after we die?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'What gives your life meaning?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'Was there a moment that tested your faith or beliefs?', depth: 'deep', priority: 1, hints: ['How did you come through it?'], tone: 'serious' },
    { text: 'Is there a Bible verse or spiritual text that guides you?', depth: 'medium', priority: 2, hints: [], tone: 'reflective' },
    { text: 'What do you want people to know about what you believe?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
  ],
  values: [
    { text: 'What three values do you hold above all others?', depth: 'deep', priority: 1, hints: ['Where did they come from?'], tone: 'reflective' },
    { text: 'What does integrity mean to you? Give an example.', depth: 'deep', priority: 1, hints: [], tone: 'serious' },
    { text: 'How do you define success?', depth: 'medium', priority: 1, hints: ['Has that changed?'], tone: 'reflective' },
    { text: 'What do you stand for that you would never compromise on?', depth: 'deep', priority: 1, hints: [], tone: 'serious' },
    { text: 'What values do you most want your descendants to carry forward?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'What is the role of hard work in a good life?', depth: 'medium', priority: 2, hints: [], tone: 'reflective' },
  ],
  achievements: [
    { text: 'What accomplishment are you most proud of?', depth: 'deep', priority: 1, hints: ['Why that one?'], tone: 'celebratory' },
    { text: 'What is something you did that nobody else thought you could?', depth: 'deep', priority: 1, hints: ['How did it feel?'], tone: 'celebratory' },
    { text: 'What was the greatest risk you took that paid off?', depth: 'narrative', priority: 1, hints: ['What were the stakes?'], tone: 'serious' },
    { text: 'What achievement do you think will outlast you?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'What do you want to be remembered for?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'Did you ever save someone or help someone in a critical moment?', depth: 'narrative', priority: 1, hints: ['What happened?'], tone: 'serious' },
  ],
  regrets: [
    { text: 'Is there something you wish you had done differently?', depth: 'deep', priority: 1, hints: ['What would you change?'], tone: 'reflective' },
    { text: 'What is the biggest lesson you learned the hard way?', depth: 'deep', priority: 1, hints: [], tone: 'serious' },
    { text: 'Is there someone you wish you had apologized to?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'If you could write a letter to your younger self, what would you say?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'What fear held you back the most in life?', depth: 'deep', priority: 1, hints: ['Did you ever overcome it?'], tone: 'serious' },
    { text: 'What unfinished business weighs on you?', depth: 'deep', priority: 1, hints: [], tone: 'serious' },
  ],
  wisdom: [
    { text: 'What is the single most important piece of advice you can give?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'What do you know now that you wish you knew at 20?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'What is the secret to a good life?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'How do you stay strong when everything falls apart?', depth: 'deep', priority: 1, hints: ['Give an example.'], tone: 'serious' },
    { text: 'What is worth suffering for?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'If you could leave one sentence carved in stone for all time, what would it be?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
  ],
  daily_life: [
    { text: 'What does a perfect day look like for you?', depth: 'light', priority: 2, hints: [], tone: 'warm' },
    { text: 'What hobby brings you the most joy?', depth: 'medium', priority: 2, hints: ['When did you start?'], tone: 'warm' },
    { text: 'What small thing makes you happy every day?', depth: 'light', priority: 2, hints: [], tone: 'warm' },
    { text: 'Describe your hometown — what makes it special?', depth: 'medium', priority: 2, hints: [], tone: 'warm' },
    { text: 'Do you have a favorite joke or funny story you always tell?', depth: 'light', priority: 3, hints: [], tone: 'warm' },
    { text: 'What was your favorite age to be, and why?', depth: 'medium', priority: 2, hints: [], tone: 'reflective' },
  ],
  future_hopes: [
    { text: 'What do you hope for your children and grandchildren?', depth: 'deep', priority: 1, hints: [], tone: 'warm' },
    { text: 'What legacy do you most want to leave behind?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'What message do you want to leave for someone who hasn\'t been born yet?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'What should your family name stand for in 100 years?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'What promise do you want future generations to keep?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
    { text: 'What are your final words of wisdom for the family?', depth: 'deep', priority: 1, hints: [], tone: 'reflective' },
  ],
};

function hashQ(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  }
  return `Q_${Math.abs(h).toString(16).padStart(8, '0')}`;
}

function allQuestions(): QuestionItem[] {
  const all: QuestionItem[] = [];
  for (const [cat, qs] of Object.entries(QUESTION_BANK)) {
    for (const q of qs) {
      all.push({
        question_id: hashQ(q.text),
        text: q.text,
        category: cat,
        depth: q.depth,
        priority: q.priority,
        follow_up_hints: q.hints,
        tags: [cat],
        emotion_tone: q.tone,
      });
    }
  }
  return all;
}

// Session type configs
const SESSION_COUNTS: Record<string, number> = {
  morning_brief: 4, afternoon_deep: 10, evening_story: 6,
  quick_capture: 2, legacy_session: 12, emergency_mode: 18,
};

// ─── Routes ──────────────────────────────────────────────────────────────

interview.post('/questions/select', async (c) => {
  const body = await c.req.json<{ session_type?: string; category?: string; count?: number; user_id?: string }>();
  const sessionType = body.session_type ?? 'afternoon_deep';
  const count = body.count ?? SESSION_COUNTS[sessionType] ?? 10;
  const db = c.env.DB;

  let pool = allQuestions();

  // Filter by category if specified
  if (body.category) {
    pool = pool.filter((q) => q.category === body.category);
  }

  // Exclude already-answered questions for user
  if (body.user_id) {
    const answered = await db
      .prepare('SELECT question_id FROM interviews WHERE user_id = ?')
      .bind(body.user_id)
      .all<{ question_id: string }>();
    const answeredIds = new Set((answered.results ?? []).map((r) => r.question_id));
    pool = pool.filter((q) => !answeredIds.has(q.question_id));
  }

  // Sort: priority ascending (1 first), then shuffle within priority
  pool.sort((a, b) => a.priority - b.priority + (Math.random() - 0.5) * 0.5);

  const selected = pool.slice(0, count);
  return c.json({ questions: selected, session_type: sessionType, total_available: pool.length });
});

interview.post('/questions/answer', async (c) => {
  const body = await c.req.json<InterviewAnswerRequest>();
  if (!body.user_id || !body.question || !body.answer) {
    return c.json({ error: 'user_id, question, and answer required' }, 400);
  }

  const db = c.env.DB;
  const id = crypto.randomUUID();
  const emotion = body.emotion ?? await detectEmotion(c.env, body.answer);

  await db
    .prepare('INSERT INTO interviews (id, user_id, question_id, question, answer, emotion, category, session_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, body.user_id, body.question_id ?? hashQ(body.question), body.question, body.answer, emotion, body.category ?? null, body.session_type ?? null)
    .run();

  // Store answer as memory in Shared Brain
  await storeMemory(
    c.env,
    body.user_id,
    `Interview Q: ${body.question}\nA: ${body.answer}`,
    ['interview', body.category ?? 'general', emotion],
    7,
  );

  // Update user stats
  await db
    .prepare('UPDATE users SET total_interviews = total_interviews + 1, updated_at = datetime("now") WHERE id = ?')
    .bind(body.user_id)
    .run();

  // Generate follow-up questions via LLM
  let followUps: string[] = [];
  try {
    const prompt = `Generate 2 follow-up questions for this interview answer. Be warm and curious.\nQ: ${body.question}\nA: ${body.answer}\nReturn ONLY questions, one per line.`;
    const raw = await aiChat(c.env, [{ role: 'user', content: prompt }], { maxTokens: 150, temperature: 0.7 });
    followUps = raw.split('\n').filter((l) => l.trim()).slice(0, 2);
  } catch { /* follow-ups are optional */ }

  return c.json({ id, emotion, follow_ups: followUps, stored: true });
});

interview.get('/questions/coverage/:userId', async (c) => {
  const userId = c.req.param('userId');
  const db = c.env.DB;

  const answered = await db
    .prepare('SELECT question_id, category FROM interviews WHERE user_id = ?')
    .bind(userId)
    .all<{ question_id: string; category: string }>();

  const answeredIds = new Set((answered.results ?? []).map((r) => r.question_id));
  const all = allQuestions();
  const totalAnswered = answeredIds.size;

  const categories: Record<string, { answered: number; total: number; percentage: number }> = {};
  for (const cat of CATEGORIES) {
    const catQs = all.filter((q) => q.category === cat);
    const catAnswered = catQs.filter((q) => answeredIds.has(q.question_id)).length;
    categories[cat] = {
      answered: catAnswered,
      total: catQs.length,
      percentage: catQs.length > 0 ? Math.round((catAnswered / catQs.length) * 100) : 0,
    };
  }

  return c.json({
    user_id: userId,
    total_questions: all.length,
    total_answered: totalAnswered,
    overall_percentage: all.length > 0 ? Math.round((totalAnswered / all.length) * 100) : 0,
    categories,
  });
});

interview.get('/questions/gaps/:userId', async (c) => {
  const userId = c.req.param('userId');
  const db = c.env.DB;

  const answered = await db
    .prepare('SELECT question_id FROM interviews WHERE user_id = ?')
    .bind(userId)
    .all<{ question_id: string }>();

  const answeredIds = new Set((answered.results ?? []).map((r) => r.question_id));
  const all = allQuestions();

  const gaps = CATEGORIES.map((cat) => {
    const catQs = all.filter((q) => q.category === cat);
    const unanswered = catQs.filter((q) => !answeredIds.has(q.question_id));
    return { category: cat, unanswered: unanswered.length, total: catQs.length, top_questions: unanswered.slice(0, 3) };
  })
    .filter((g) => g.unanswered > 0)
    .sort((a, b) => b.unanswered - a.unanswered);

  return c.json({ user_id: userId, gaps, critical_unanswered: all.filter((q) => q.priority === 1 && !answeredIds.has(q.question_id)).slice(0, 10) });
});

interview.get('/interviews/:userId', async (c) => {
  const userId = c.req.param('userId');
  const category = c.req.query('category');
  const db = c.env.DB;

  let sql = 'SELECT * FROM interviews WHERE user_id = ?';
  const params: string[] = [userId];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  sql += ' ORDER BY created_at DESC LIMIT 100';

  const result = await db.prepare(sql).bind(...params).all();
  return c.json({ interviews: result.results ?? [] });
});

export default interview;
