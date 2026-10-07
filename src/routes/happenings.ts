import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

export const happeningRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

happeningRoutes.get('/', requireAuth, async (c) => {
  const { results: happenings } = await c.env.DB.prepare(
    `SELECT h.id, h.brand, h.accent, h.icon, h.tag_label, h.title, h.event_date, h.detail
     FROM brand_happenings h
     JOIN user_brands ub ON ub.brand_id = h.brand_id AND ub.user_id = ?
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
  }>()

  return c.json({ success: true, happenings })
})
