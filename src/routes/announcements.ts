import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'
import { IS_LIVE, TARGETS_USER } from '../lib/announcements'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

export const announcementRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Home-page feed: live announcements addressed to the caller that don't need an acknowledgement.
announcementRoutes.get('/', requireAuth, async (c) => {
  const { results: announcements } = await c.env.DB.prepare(
    `SELECT a.id, a.title, a.body, a.title_zh, a.body_zh, a.accent, a.posted_by, a.posted_at
     FROM announcements a JOIN users u ON u.id = ?
     WHERE a.display_mode = 'feed' AND ${IS_LIVE} AND ${TARGETS_USER}
     ORDER BY a.posted_at DESC, a.id DESC`
  ).bind(c.get('user').id).all<{
    id: number
    title: string
    body: string
    title_zh: string | null
    body_zh: string | null
    accent: string
    posted_by: string
    posted_at: string
  }>()

  const { results: tags } = await c.env.DB.prepare(
    `SELECT announcement_id, label, label_zh, variant
     FROM announcement_tags
     ORDER BY announcement_id, sort_order`
  ).all<{ announcement_id: number; label: string; label_zh: string | null; variant: string }>()

  const tagsByAnnouncement = new Map<number, { label: string; label_zh: string | null; variant: string }[]>()
  for (const tag of tags) {
    const list = tagsByAnnouncement.get(tag.announcement_id) ?? []
    list.push({ label: tag.label, label_zh: tag.label_zh, variant: tag.variant })
    tagsByAnnouncement.set(tag.announcement_id, list)
  }

  return c.json({
    success: true,
    announcements: announcements.map((a) => ({
      ...a,
      tags: tagsByAnnouncement.get(a.id) ?? [],
    })),
  })
})

// Live 'modal' announcements addressed to the caller that they haven't acknowledged (oldest first).
announcementRoutes.get('/pending', requireAuth, async (c) => {
  const { results: pending } = await c.env.DB.prepare(
    `SELECT a.id, a.title, a.body, a.title_zh, a.body_zh, a.accent, a.posted_by, a.posted_at
     FROM announcements a JOIN users u ON u.id = ?1
     WHERE a.display_mode = 'modal' AND ${IS_LIVE} AND ${TARGETS_USER}
       AND NOT EXISTS (SELECT 1 FROM announcement_acks k WHERE k.announcement_id = a.id AND k.user_id = u.id)
     ORDER BY a.id`
  ).bind(c.get('user').id).all<{ id: number }>()

  const { results: tags } = await c.env.DB.prepare(
    `SELECT announcement_id, label, label_zh, variant FROM announcement_tags ORDER BY announcement_id, sort_order`
  ).all<{ announcement_id: number; label: string; label_zh: string | null; variant: string }>()

  return c.json({
    success: true,
    pending: pending.map((a) => ({ ...a, tags: tags.filter((t) => t.announcement_id === a.id) })),
  })
})

announcementRoutes.post('/:id/ack', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id < 1) return c.json({ success: false, error: 'Invalid id' }, 400)
  const userId = c.get('user').id

  // Only someone the announcement is addressed to can acknowledge it.
  await c.env.DB.prepare(
    `INSERT OR IGNORE INTO announcement_acks (announcement_id, user_id)
     SELECT a.id, u.id FROM announcements a JOIN users u ON u.id = ?2
     WHERE a.id = ?1 AND a.display_mode = 'modal' AND ${TARGETS_USER}`
  ).bind(id, userId).run()

  const acked = await c.env.DB.prepare(`SELECT 1 FROM announcement_acks WHERE announcement_id = ? AND user_id = ?`).bind(id, userId).first()
  if (!acked) return c.json({ success: false, error: 'Not found' }, 404)
  return c.json({ success: true })
})

// Removes an acknowledged pop-up from the caller's own log. Unacknowledged ones can't be removed.
announcementRoutes.delete('/:id/log', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id < 1) return c.json({ success: false, error: 'Invalid id' }, 400)
  const res = await c.env.DB.prepare(
    `UPDATE announcement_acks SET hidden_at = datetime('now') WHERE announcement_id = ? AND user_id = ?`
  ).bind(id, c.get('user').id).run()
  if (!res.meta.changes) return c.json({ success: false, error: 'Not found' }, 404)
  return c.json({ success: true })
})
