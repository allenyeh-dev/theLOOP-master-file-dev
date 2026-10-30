import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

export const playbookRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Every signed-in account reads the same Playbook; is_read is the caller's own tick.
playbookRoutes.get('/', requireAuth, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.kind, s.title, s.title_zh, s.body, s.body_zh, s.good, s.good_zh, s.miss, s.miss_zh,
            EXISTS (SELECT 1 FROM playbook_reads r WHERE r.section_id = s.id AND r.user_id = ?) AS is_read
     FROM playbook_sections s ORDER BY s.sort_order, s.id`
  ).bind(c.get('user').id).all<{ is_read: number }>()
  return c.json({ success: true, sections: results.map((s) => ({ ...s, is_read: !!s.is_read })) })
})

playbookRoutes.put('/:id/read', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json().catch(() => null)
  if (!Number.isInteger(id) || id <= 0 || typeof body?.read !== 'boolean') {
    return c.json({ success: false, error: 'Invalid id' }, 400)
  }
  const userId = c.get('user').id
  const db = c.env.DB
  if (body.read) {
    const res = await db.prepare(
      `INSERT OR IGNORE INTO playbook_reads (section_id, user_id)
       SELECT id, ? FROM playbook_sections WHERE id = ? AND kind != 'heading'`
    ).bind(userId, id).run()
    if (!res.meta.changes && !(await db.prepare(`SELECT 1 FROM playbook_reads WHERE section_id = ? AND user_id = ?`).bind(id, userId).first())) {
      return c.json({ success: false, error: 'Not found' }, 404)
    }
  } else {
    await db.prepare(`DELETE FROM playbook_reads WHERE section_id = ? AND user_id = ?`).bind(id, userId).run()
  }
  return c.json({ success: true })
})
