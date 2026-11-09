import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

export const logRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const TYPES = ['opening', 'closing', 'incident']
const TIERS = ['T1', 'T2', 'T3']
// Equipment checks on the opening log (toggles).
const EQUIPMENT_CHECKS = ['pos', 'refrigeration', 'cctv', 'radio']
// Closing checklist toggles on the closing log.
const CLOSING_CHECKS = ['guests_cleared', 'cash_secured', 'equipment_off', 'venue_locked']
// Incident report choices (titles are stored as these English strings and translated by the client).
const INCIDENT_TYPES = [
  'Guest — Complaint or Dispute', 'Guest — Injury or Medical', 'Guest — Drunk & Disorderly', 'Staff — Dispute or Altercation',
  'Staff — Injury', 'Equipment Fault', 'Food Safety Concern', 'Security — Theft or Threat', 'Other',
]
const ESCALATIONS = ['Handled on shift — no escalation needed', 'Manager on Duty', 'GM', 'Ownership', 'Emergency services']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
// Everyone can read the logs of their own brands; only these roles can write them.
const EDITOR_ROLES = ['admin', 'gm', 'manager', 'chef']
const canEdit = (u: AuthUser) => EDITOR_ROLES.includes(u.role.key)

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

const isMember = (db: D1Database, userId: number, brandId: number) =>
  db.prepare(`SELECT 1 FROM user_brands WHERE user_id = ? AND brand_id = ?`).bind(userId, brandId).first()

const SELECT_LOGS = `
  SELECT l.id, l.brand_id, b.label AS brand_label, l.type, l.log_date, l.title, l.details,
         l.created_at, l.updated_at, u.name AS author, r.label AS author_role
  FROM logs l
  JOIN brands b ON b.id = l.brand_id
  LEFT JOIN users u ON u.id = l.created_by
  LEFT JOIN roles r ON r.id = u.role_id`

const present = (row: any) => ({ ...row, details: JSON.parse(row.details || '{}') })

// Validates the request body for one log type; returns the clean { title, details } or an error message.
function parseBody(b: any): { type: string; log_date: string; title: string; details: Record<string, unknown> } | string {
  if (!TYPES.includes(b?.type)) return 'Invalid log type'
  const date = typeof b?.log_date === 'string' ? b.log_date : ''
  if (!DATE_RE.test(date)) return 'Invalid date'
  const d = b?.details ?? {}
  if (typeof d !== 'object' || Array.isArray(d)) return 'Invalid request body'
  if (b.type === 'opening') {
    const eq = d.equipment && typeof d.equipment === 'object' ? d.equipment : {}
    return { type: b.type, log_date: date, title: '', details: {
      staff_count: s(d.staff_count, 200),
      equipment: Object.fromEntries(EQUIPMENT_CHECKS.map((k) => [k, eq[k] === true])),
      items_86: s(d.items_86, 500), handoff_notes: s(d.handoff_notes, 1000), notes: s(d.notes, 1000),
    } }
  }
  if (b.type === 'closing') {
    const ck = d.checklist && typeof d.checklist === 'object' ? d.checklist : {}
    return { type: b.type, log_date: date, title: '', details: {
      summary: s(d.summary, 1000),
      checklist: Object.fromEntries(CLOSING_CHECKS.map((k) => [k, ck[k] === true])),
      outstanding: s(d.outstanding, 1000), incidents: s(d.incidents, 1000), handoff: s(d.handoff, 1000),
    } }
  }
  const title = typeof b?.title === 'string' ? b.title : ''
  if (!INCIDENT_TYPES.includes(title)) return 'Invalid incident type'
  if (!TIERS.includes(d.tier)) return 'Select an incident tier'
  if (!ESCALATIONS.includes(d.escalated_to)) return 'Invalid escalation'
  return { type: b.type, log_date: date, title, details: {
    tier: d.tier, description: s(d.description, 1000), parties: s(d.parties, 500), action_taken: s(d.action_taken, 1000),
    escalated_to: d.escalated_to, gm_review: d.gm_review === true,
  } }
}

// One business day of logs across the caller's own brands (optionally one brand), newest first.
logRoutes.get('/', requireAuth, async (c) => {
  const user = c.get('user')
  const date = c.req.query('date') ?? ''
  if (!DATE_RE.test(date)) return c.json({ success: false, error: 'Invalid date' }, 400)
  const brandParam = c.req.query('brand_id')
  let brandId: number | null = null
  if (brandParam) {
    brandId = Number(brandParam)
    if (!Number.isInteger(brandId) || brandId < 1) return c.json({ success: false, error: 'Invalid id' }, 400)
    if (!(await isMember(c.env.DB, user.id, brandId))) return c.json({ success: false, error: 'You do not have access to this brand' }, 403)
  }
  const { results } = await c.env.DB.prepare(
    `${SELECT_LOGS}
     WHERE l.log_date = ?1 AND (?2 IS NULL OR l.brand_id = ?2)
       AND l.brand_id IN (SELECT brand_id FROM user_brands WHERE user_id = ?3)
     ORDER BY l.created_at DESC, l.id DESC`
  ).bind(date, brandId, user.id).all<any>()
  return c.json({ success: true, can_edit: canEdit(user), logs: results.map(present) })
})

logRoutes.post('/', requireAuth, async (c) => {
  const user = c.get('user')
  if (!canEdit(user)) return c.json({ success: false, error: 'Forbidden' }, 403)
  const b: any = await c.req.json().catch(() => null)
  const brandId = Number(b?.brand_id)
  if (!Number.isInteger(brandId) || brandId < 1) return c.json({ success: false, error: 'Invalid id' }, 400)
  const parsed = parseBody(b)
  if (typeof parsed === 'string') return c.json({ success: false, error: parsed }, 400)
  if (!(await isMember(c.env.DB, user.id, brandId))) return c.json({ success: false, error: 'You do not have access to this brand' }, 403)
  const row = await c.env.DB.prepare(
    `INSERT INTO logs (brand_id, type, log_date, title, details, created_by) VALUES (?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(brandId, parsed.type, parsed.log_date, parsed.title, JSON.stringify(parsed.details), user.id).first<{ id: number }>()
  const log = await c.env.DB.prepare(`${SELECT_LOGS} WHERE l.id = ?`).bind(row!.id).first<any>()
  return c.json({ success: true, log: present(log) })
})

// Editing keeps the log on its brand; only the content (and the business day) changes.
logRoutes.put('/:id', requireAuth, async (c) => {
  const user = c.get('user')
  if (!canEdit(user)) return c.json({ success: false, error: 'Forbidden' }, 403)
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id < 1) return c.json({ success: false, error: 'Invalid id' }, 400)
  const existing = await c.env.DB.prepare(`SELECT brand_id, type FROM logs WHERE id = ?`).bind(id).first<{ brand_id: number; type: string }>()
  if (!existing) return c.json({ success: false, error: 'Not found' }, 404)
  if (!(await isMember(c.env.DB, user.id, existing.brand_id))) return c.json({ success: false, error: 'You do not have access to this brand' }, 403)
  const b: any = await c.req.json().catch(() => null)
  const parsed = parseBody({ ...b, type: existing.type })
  if (typeof parsed === 'string') return c.json({ success: false, error: parsed }, 400)
  await c.env.DB.prepare(
    `UPDATE logs SET log_date = ?, title = ?, details = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(parsed.log_date, parsed.title, JSON.stringify(parsed.details), id).run()
  const log = await c.env.DB.prepare(`${SELECT_LOGS} WHERE l.id = ?`).bind(id).first<any>()
  return c.json({ success: true, log: present(log) })
})

logRoutes.delete('/:id', requireAuth, async (c) => {
  const user = c.get('user')
  if (!canEdit(user)) return c.json({ success: false, error: 'Forbidden' }, 403)
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id < 1) return c.json({ success: false, error: 'Invalid id' }, 400)
  const existing = await c.env.DB.prepare(`SELECT brand_id FROM logs WHERE id = ?`).bind(id).first<{ brand_id: number }>()
  if (!existing) return c.json({ success: false, error: 'Not found' }, 404)
  if (!(await isMember(c.env.DB, user.id, existing.brand_id))) return c.json({ success: false, error: 'You do not have access to this brand' }, 403)
  await c.env.DB.prepare(`DELETE FROM logs WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})
