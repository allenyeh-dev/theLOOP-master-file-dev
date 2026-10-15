import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

export const happeningRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

happeningRoutes.get('/', requireAuth, async (c) => {
  const { results: happenings } = await c.env.DB.prepare(
    `SELECT h.id, h.brand, h.accent, h.icon, h.tag_label, h.title, h.event_date, h.detail,
            h.tag_label_zh, h.title_zh, h.event_date_zh, h.detail_zh
     FROM brand_happenings h
     WHERE h.all_brands = 1
        OR h.brand_id IN (SELECT brand_id FROM user_brands WHERE user_id = ?)
     ORDER BY h.sort_order, h.id`
  ).bind(c.get('user').id).all<{
    id: number
    brand: string
    accent: string
    icon: string
    tag_label: string
    title: string
    event_date: string
    detail: string
    tag_label_zh: string | null
    title_zh: string | null
    event_date_zh: string | null
    detail_zh: string | null
  }>()

  return c.json({ success: true, happenings })
})

const PENDING_DAYS = 7

// Pushed events this user hasn't acknowledged yet (oldest first). Drives the in-app "acknowledge" sheet.
happeningRoutes.get('/pending', requireAuth, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT p.id AS push_id, p.created_at AS pushed_at, h.brand, h.accent, h.tag_label, h.title, h.event_date, h.detail,
            h.tag_label_zh, h.title_zh, h.event_date_zh, h.detail_zh, u.name AS posted_by
     FROM happening_pushes p
     JOIN brand_happenings h ON h.id = p.happening_id
     LEFT JOIN users u ON u.id = p.sent_by
     WHERE (h.all_brands = 1 OR h.brand_id IN (SELECT brand_id FROM user_brands WHERE user_id = ?1))
       AND p.created_at >= datetime('now', '-${PENDING_DAYS} days')
       AND NOT EXISTS (SELECT 1 FROM happening_push_acks a WHERE a.push_id = p.id AND a.user_id = ?1)
     ORDER BY p.id`
  ).bind(c.get('user').id).all()
  return c.json({ success: true, pending: results })
})

happeningRoutes.post('/pushes/:id/ack', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id < 1) return c.json({ success: false, error: 'Invalid id' }, 400)
  // Only acknowledgeable by someone in the event's brand.
  const res = await c.env.DB.prepare(
    `INSERT OR IGNORE INTO happening_push_acks (push_id, user_id)
     SELECT p.id, ?2 FROM happening_pushes p
     JOIN brand_happenings h ON h.id = p.happening_id
     WHERE p.id = ?1
       AND (h.all_brands = 1 OR h.brand_id IN (SELECT brand_id FROM user_brands WHERE user_id = ?2))`
  ).bind(id, c.get('user').id).run()
  if (!res.meta.changes) {
    const exists = await c.env.DB.prepare(`SELECT 1 FROM happening_push_acks WHERE push_id = ? AND user_id = ?`).bind(id, c.get('user').id).first()
    if (!exists) return c.json({ success: false, error: 'Not found' }, 404)
  }
  return c.json({ success: true })
})
