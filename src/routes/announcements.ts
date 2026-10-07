import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

export const announcementRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

announcementRoutes.get('/', requireAuth, async (c) => {
  const { results: announcements } = await c.env.DB.prepare(
    `SELECT a.id, a.title, a.body, a.accent, a.posted_by, a.posted_at
     FROM announcements a
     WHERE NOT EXISTS (SELECT 1 FROM announcement_brands ab WHERE ab.announcement_id = a.id)
        OR EXISTS (
          SELECT 1 FROM announcement_brands ab
          JOIN user_brands ub ON ub.brand_id = ab.brand_id
          WHERE ab.announcement_id = a.id AND ub.user_id = ?
        )
     ORDER BY a.posted_at DESC, a.id DESC`
  ).bind(c.get('user').id).all<{
    id: number
    title: string
    body: string
    accent: string
    posted_by: string
    posted_at: string
  }>()

  const { results: tags } = await c.env.DB.prepare(
    `SELECT announcement_id, label, variant
     FROM announcement_tags
     ORDER BY announcement_id, sort_order`
  ).all<{ announcement_id: number; label: string; variant: string }>()

  const tagsByAnnouncement = new Map<number, { label: string; variant: string }[]>()
  for (const tag of tags) {
    const list = tagsByAnnouncement.get(tag.announcement_id) ?? []
    list.push({ label: tag.label, variant: tag.variant })
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
