/** AI service — routes LLM calls to Echo AI Orchestrator */

import type { Env } from '../types';

export async function aiChat(
  env: Env,
  messages: { role: string; content: string }[],
  opts: { model?: string; maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  // Use service binding (avoids error 1042 for same-account Workers)
  const resp = await env.AI_ORCHESTRATOR.fetch(`${env.AI_ORCHESTRATOR_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      worker: opts.model ?? 'gpt-4.1-mini',
      messages,
      max_tokens: opts.maxTokens ?? 500,
      temperature: opts.temperature ?? 0.8,
    }),
  });

  const data = (await resp.json()) as Record<string, unknown>;
  return (
    (data.content as string) ||
    (data.response as string) ||
    ((data.choices as { message?: { content?: string } }[])?.[0]?.message?.content) ||
    ''
  );
}

export async function detectEmotion(
  env: Env,
  text: string,
): Promise<string> {
  const keywords: Record<string, string[]> = {
    joy: ['happy', 'joy', 'wonderful', 'great', 'amazing', 'love', 'excited', 'blessed'],
    sadness: ['sad', 'miss', 'wish', 'sorry', 'lost', 'gone', 'remember when'],
    love: ['love', 'dear', 'sweetheart', 'honey', 'darling', 'precious', 'heart'],
    nostalgia: ['remember', 'back then', 'those days', 'used to', 'when I was'],
    pride: ['proud', 'accomplished', 'achieved', 'made it', 'succeeded'],
    wisdom: ['advice', 'learn', 'important', 'never forget', 'always remember'],
    humor: ['funny', 'laugh', 'joke', 'hilarious', 'silly'],
    concern: ['worried', 'careful', 'be safe', 'take care'],
    excitement: ["can't wait", 'so excited', 'amazing news', 'incredible'],
  };

  const lower = text.toLowerCase();
  let best = 'neutral';
  let bestScore = 0;

  for (const [emotion, kws] of Object.entries(keywords)) {
    const score = kws.filter((kw) => lower.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      best = emotion;
    }
  }
  return best;
}
