/** Memory service — integrates with Echo Shared Brain */

import type { Env } from '../types';

export async function storeMemory(
  env: Env,
  userId: string,
  content: string,
  tags: string[] = [],
  importance = 5,
): Promise<boolean> {
  try {
    const resp = await env.SHARED_BRAIN.fetch(`${env.SHARED_BRAIN_URL}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instance_id: 'immortality-vault',
        role: 'user',
        content,
        importance,
        tags: ['immortality_vault', userId, ...tags],
      }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export async function searchMemories(
  env: Env,
  query: string,
  userId?: string,
  limit = 10,
): Promise<{ content: string; importance: number; created_at: string }[]> {
  try {
    const resp = await env.SHARED_BRAIN.fetch(`${env.SHARED_BRAIN_URL}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
    });

    if (!resp.ok) return [];
    const data = (await resp.json()) as { results?: { content: string; importance: number; created_at: string }[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}
