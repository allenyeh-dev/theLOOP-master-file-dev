import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

export const announcementRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

announcementRoutes.get('/', requireAuth, async (c) => {
  const { results: announcements } = await c.env.DB.prepare(
    `SELECT id, title, body, accent, posted_by, posted_at
     FROM announcements
     ORDER BY posted_at DESC, id DESC`
  ).all<{
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
