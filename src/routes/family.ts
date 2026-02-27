/** Family tree routes — CRUD for family members */

import { Hono } from 'hono';
import type { Env, FamilyMemberRequest } from '../types';

const family = new Hono<{ Bindings: Env }>();

family.get('/:vaultUserId', async (c) => {
  const vaultUserId = c.req.param('vaultUserId');
  const db = c.env.DB;

  const members = await db
    .prepare('SELECT * FROM family_members WHERE vault_user_id = ? ORDER BY birth_date ASC')
    .bind(vaultUserId)
    .all();

  return c.json({ family: members.results ?? [] });
});

family.post('/', async (c) => {
  const body = await c.req.json<FamilyMemberRequest>();
  if (!body.vault_user_id || !body.name) {
    return c.json({ error: 'vault_user_id and name required' }, 400);
  }

  const id = crypto.randomUUID();
  const db = c.env.DB;

  await db
    .prepare('INSERT INTO family_members (id, vault_user_id, name, relationship, birth_date, death_date, bio, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(id, body.vault_user_id, body.name, body.relationship ?? null, body.birth_date ?? null, body.death_date ?? null, body.bio ?? null, body.photo_url ?? null)
    .run();

  return c.json({ id, created: true });
});

family.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json<Partial<FamilyMemberRequest>>();
  const db = c.env.DB;

  const fields: string[] = [];
  const values: (string | null)[] = [];

  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
  if (body.relationship !== undefined) { fields.push('relationship = ?'); values.push(body.relationship ?? null); }
  if (body.birth_date !== undefined) { fields.push('birth_date = ?'); values.push(body.birth_date ?? null); }
  if (body.death_date !== undefined) { fields.push('death_date = ?'); values.push(body.death_date ?? null); }
  if (body.bio !== undefined) { fields.push('bio = ?'); values.push(body.bio ?? null); }
  if (body.photo_url !== undefined) { fields.push('photo_url = ?'); values.push(body.photo_url ?? null); }

  if (fields.length === 0) {
    return c.json({ error: 'No fields to update' }, 400);
  }

  await db
    .prepare(`UPDATE family_members SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values, id)
    .run();

  return c.json({ id, updated: true });
});

family.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM family_members WHERE id = ?').bind(id).run();
  return c.json({ id, deleted: true });
});

export default family;
