import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'
import type { PushEnv } from '../lib/webpush'
import { NOTIFY_ROLE_KEYS, SERVICE_TIERS, minServiceTier, pushToOwners, tierNotifies } from '../lib/alerts'

type Bindings = { DB: D1Database } & PushEnv
type Variables = { user: AuthUser }

export const alertRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()
alertRoutes.use('*', requireAuth)

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const isMember = (db: D1Database, userId: number, brandId: number) =>
  db.prepare(`SELECT 1 FROM user_brands WHERE user_id = ? AND brand_id = ?`).bind(userId, brandId).first()

// Service alert category -> incident type of the log it creates (the log keeps the original category in details).
const SERVICE_CATEGORIES: Record<string, string> = {
  'Equipment Issue': 'Equipment Fault',
  'Guest Complaint': 'Guest — Complaint or Dispute',
  'Staffing Issue': 'Other',
  'Safety / Security': 'Security — Theft or Threat',
  'Supply Shortage': 'Other',
  Other: 'Other',
}
const EMERGENCY_TYPES: Record<string, string> = {
  fire: 'Fire / Evacuation', medical: 'Medical Emergency', security: 'Security Threat', facility: 'Facility Emergency',
}
const EMERGENCY_SENDER_ROLES = ['chef', 'manager', 'gm']
const isOwner = (u: AuthUser) => NOTIFY_ROLE_KEYS.includes(u.role.key)

// Service alert: always becomes an incident log; notifies the owners when its tier reaches the admin-set threshold.
alertRoutes.post('/service', async (c) => {
  const user = c.get('user')
  const b: any = await c.req.json().catch(() => null)
  const brandId = Number(b?.brand_id)
  if (!Number.isInteger(brandId) || brandId < 1) return c.json({ success: false, error: 'Invalid id' }, 400)
  if (!SERVICE_TIERS.includes(b?.tier)) return c.json({ success: false, error: 'Select an incident tier' }, 400)
  if (!(b?.category in SERVICE_CATEGORIES)) return c.json({ success: false, error: 'Invalid category' }, 400)
  if (!DATE_RE.test(b?.log_date ?? '')) return c.json({ success: false, error: 'Invalid date' }, 400)
  if (!(await isMember(c.env.DB, user.id, brandId))) return c.json({ success: false, error: 'You do not have access to this brand' }, 403)

  const description = s(b.description, 1000)
  const details = {
    tier: b.tier, description, parties: '', action_taken: '', escalated_to: 'Handled on shift — no escalation needed',
    gm_review: false, category: b.category, source: 'service_alert',
  }
  const row = await c.env.DB.prepare(
    `INSERT INTO logs (brand_id, type, log_date, title, details, created_by) VALUES (?, 'incident', ?, ?, ?, ?) RETURNING id`
  ).bind(brandId, b.log_date, SERVICE_CATEGORIES[b.category], JSON.stringify(details), user.id).first<{ id: number }>()

  const notified = tierNotifies(b.tier, await minServiceTier(c.env.DB))
  if (notified) {
    const brand = await c.env.DB.prepare(`SELECT label FROM brands WHERE id = ?`).bind(brandId).first<{ label: string }>()
    c.executionCtx.waitUntil(pushToOwners(c.env, {
      title: `Service Alert ${b.tier} — ${brand?.label ?? ''}`.trim(),
      body: `${b.category}${description ? `: ${description}` : ''}`.slice(0, 200),
      tag: `service-${row!.id}`,
    }))
  }
  return c.json({ success: true, log_id: row!.id, notified })
})

// Emergency alert: chef / manager / gm raise it; Admin + Executive are notified (push + in-app banner).
alertRoutes.post('/emergency', async (c) => {
  const user = c.get('user')
  if (!EMERGENCY_SENDER_ROLES.includes(user.role.key)) return c.json({ success: false, error: 'Forbidden' }, 403)
  const b: any = await c.req.json().catch(() => null)
  if (!(b?.type in EMERGENCY_TYPES)) return c.json({ success: false, error: 'Select an emergency type' }, 400)
  let brandId: number | null = null
  if (b.brand_id !== undefined && b.brand_id !== null) {
    brandId = Number(b.brand_id)
    if (!Number.isInteger(brandId) || brandId < 1) return c.json({ success: false, error: 'Invalid id' }, 400)
    if (!(await isMember(c.env.DB, user.id, brandId))) return c.json({ success: false, error: 'You do not have access to this brand' }, 403)
  }
  const notes = s(b.notes, 1000)
  const row = await c.env.DB.prepare(
    `INSERT INTO emergency_alerts (brand_id, type, notes, created_by) VALUES (?, ?, ?, ?) RETURNING id`
  ).bind(brandId, b.type, notes, user.id).first<{ id: number }>()
  const brand = brandId ? await c.env.DB.prepare(`SELECT label FROM brands WHERE id = ?`).bind(brandId).first<{ label: string }>() : null
  c.executionCtx.waitUntil(pushToOwners(c.env, {
    title: `🚨 EMERGENCY — ${EMERGENCY_TYPES[b.type]}${brand ? ` (${brand.label})` : ''}`,
    body: `${user.name}${notes ? `: ${notes}` : ''}`.slice(0, 200),
    tag: `emergency-${row!.id}`,
  }))
  return c.json({ success: true, id: row!.id })
})

// Unresolved emergencies, for the red banner shown to Admin / Executive.
alertRoutes.get('/emergency/active', async (c) => {
  if (!isOwner(c.get('user'))) return c.json({ success: true, alerts: [] })
  const { results } = await c.env.DB.prepare(
    `SELECT e.id, e.type, e.notes, e.created_at, b.label AS brand_label, u.name AS author, r.label AS author_role
     FROM emergency_alerts e
     LEFT JOIN brands b ON b.id = e.brand_id
     LEFT JOIN users u ON u.id = e.created_by
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE e.resolved_at IS NULL ORDER BY e.created_at DESC, e.id DESC`
  ).all()
  return c.json({ success: true, alerts: results })
})

alertRoutes.post('/emergency/:id/resolve', async (c) => {
  const user = c.get('user')
  if (!isOwner(user)) return c.json({ success: false, error: 'Forbidden' }, 403)
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id < 1) return c.json({ success: false, error: 'Invalid id' }, 400)
  await c.env.DB.prepare(`UPDATE emergency_alerts SET resolved_at = datetime('now'), resolved_by = ? WHERE id = ? AND resolved_at IS NULL`).bind(user.id, id).run()
  return c.json({ success: true })
})
