import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

export const happeningRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

happeningRoutes.get('/', requireAuth, async (c) => {
  const { results: happenings } = await c.env.DB.prepare(
    `SELECT id, brand, accent, icon, tag_label, title, event_date, detail
     FROM brand_happenings
     ORDER BY sort_order, id`
  ).all<{
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
