import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

export const happeningRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

happeningRoutes.get('/', requireAuth, async (c) => {
  const { results: happenings } = await c.env.DB.prepare(
    `SELECT h.id, h.brand, h.brand_id, h.all_brands, h.accent, h.icon, h.tag_label, h.title, h.event_date, h.detail,
            h.tag_label_zh, h.title_zh, h.event_date_zh, h.detail_zh
     FROM brand_happenings h
     WHERE h.all_brands = 1
        OR h.brand_id IN (SELECT brand_id FROM user_brands WHERE user_id = ?)
     ORDER BY h.sort_order, h.id`
  ).bind(c.get('user').id).all<{
    id: number
    brand: string
    brand_id: number | null
    all_brands: number
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
