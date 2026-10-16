import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

export const brandRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Every brand for the home-page picker; `accessible` is false for brands the user doesn't belong to (shown locked).
brandRoutes.get('/', requireAuth, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT b.id, b.key, b.label, b.logo_url, b.bg_color, b.sub_label,
            EXISTS (SELECT 1 FROM user_brands ub WHERE ub.brand_id = b.id AND ub.user_id = ?) AS accessible
     FROM brands b ORDER BY b.sort_order, b.id`
  ).bind(c.get('user').id).all<{ accessible: number }>()
  return c.json({ success: true, brands: results.map((b) => ({ ...b, accessible: Boolean(b.accessible) })) })
})

// Notices for one brand, newest first. Always listed (no acknowledge step) so they can be re-read.
brandRoutes.get('/:id/notices', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id < 1) return c.json({ success: false, error: 'Invalid id' }, 400)
  const member = await c.env.DB.prepare(`SELECT 1 FROM user_brands WHERE user_id = ? AND brand_id = ?`).bind(c.get('user').id, id).first()
  if (!member) return c.json({ success: false, error: 'You do not have access to this brand' }, 403)

  const { results } = await c.env.DB.prepare(
    `SELECT id, title, body, title_zh, body_zh, accent, tags, posted_by, posted_at
     FROM brand_notices WHERE brand_id = ? ORDER BY posted_at DESC, id DESC`
  ).bind(id).all<{ tags: string }>()
  return c.json({ success: true, notices: results.map((n) => ({ ...n, tags: JSON.parse(n.tags) })) })
})

/* ------------------------------ Ops Board ------------------------------ */

const EDIT_ROLES = ['admin', 'ownership', 'gm', 'manager']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const STATUS_86 = ['out', 'limited']
const RES_STATUS = ['confirmed', 'pending']
const TAG_KINDS = ['event', 'birthday', 'vip', 'allergy', 'new_guest', 'other']

type Board = {
  eighty_six: { name: string; status: string }[]
  specials: { name: string; price: string }[]
  shift_notes: string
  reservations: { time: string; pax: number; table: string; title: string; notes: string; tags: { kind: string; label: string }[]; status: string }[]
}
const EMPTY_BOARD: Board = { eighty_six: [], specials: [], shift_notes: '', reservations: [] }
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// Cleans a submitted board; returns the stored shape or an error message.
function parseBoard(b: any): Board | string {
  if (!b || typeof b !== 'object') return 'Invalid request body'
  const list = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : [])

  const eighty_six: Board['eighty_six'] = []
  for (const r of list(b.eighty_six, 50)) {
    const name = s(r?.name, 80)
    if (name) eighty_six.push({ name, status: STATUS_86.includes(r.status) ? r.status : 'out' })
  }
  const specials: Board['specials'] = []
  for (const r of list(b.specials, 50)) {
    const name = s(r?.name, 80)
    if (name) specials.push({ name, price: s(r.price, 30) })
  }
  const reservations: Board['reservations'] = []
  for (const r of list(b.reservations, 200)) {
    const title = s(r?.title, 100)
    if (!title) continue
    const time = s(r.time, 5)
    if (!TIME_RE.test(time)) return `Reservation "${title}" needs a time like 19:30`
    const pax = Number.isInteger(r.pax) && r.pax >= 0 && r.pax <= 999 ? r.pax : 0
    const tags = list(r.tags, 6)
      .map((t: any) => ({ kind: TAG_KINDS.includes(t?.kind) ? t.kind : 'other', label: s(t?.label, 20).toUpperCase() }))
      .filter((t) => t.label)
    reservations.push({
      time, pax, table: s(r.table, 20), title, notes: s(r.notes, 300), tags,
      status: RES_STATUS.includes(r.status) ? r.status : 'confirmed',
    })
  }
  reservations.sort((a, b) => a.time.localeCompare(b.time))
  return { eighty_six, specials, shift_notes: s(b.shift_notes, 1000), reservations }
}

// Brand membership gate shared by both ops routes; returns the brand row or a Response-ready error.
async function opsContext(c: any) {
  const id = Number(c.req.param('id'))
  const date = c.req.query('date')
  if (!Number.isInteger(id) || id < 1 || !DATE_RE.test(date ?? '')) return { error: c.json({ success: false, error: 'Invalid brand or date' }, 400) }
  const user = c.get('user') as AuthUser
  const brand = await c.env.DB.prepare(
    `SELECT b.id, b.label FROM brands b JOIN user_brands ub ON ub.brand_id = b.id AND ub.user_id = ? WHERE b.id = ?`
  ).bind(user.id, id).first()
  if (!brand) return { error: c.json({ success: false, error: 'You do not have access to this brand' }, 403) }
  return { id, date: date as string, user, brand, canEdit: EDIT_ROLES.includes(user.role.key) }
}

brandRoutes.get('/:id/ops', requireAuth, async (c) => {
  const ctx = await opsContext(c)
  if (ctx.error) return ctx.error
  const row = await c.env.DB.prepare(
    `SELECT o.data, o.updated_at, u.name AS updated_by FROM ops_boards o LEFT JOIN users u ON u.id = o.updated_by
     WHERE o.brand_id = ? AND o.board_date = ?`
  ).bind(ctx.id, ctx.date).first<{ data: string; updated_at: string; updated_by: string | null }>()
  return c.json({
    success: true,
    date: ctx.date,
    can_edit: ctx.canEdit,
    board: row ? JSON.parse(row.data) : EMPTY_BOARD,
    updated_at: row?.updated_at ?? null,
    updated_by: row?.updated_by ?? null,
  })
})

brandRoutes.put('/:id/ops', requireAuth, async (c) => {
  const ctx = await opsContext(c)
  if (ctx.error) return ctx.error
  if (!ctx.canEdit) return c.json({ success: false, error: 'Only GM, Manager, Admin or Ownership can edit the Ops Board' }, 403)
  const board = parseBoard(await c.req.json().catch(() => null))
  if (typeof board === 'string') return c.json({ success: false, error: board }, 400)

  await c.env.DB.prepare(
    `INSERT INTO ops_boards (brand_id, board_date, data, updated_by, updated_at) VALUES (?1, ?2, ?3, ?4, datetime('now'))
     ON CONFLICT (brand_id, board_date) DO UPDATE SET data = ?3, updated_by = ?4, updated_at = datetime('now')`
  ).bind(ctx.id, ctx.date, JSON.stringify(board), ctx.user.id).run()
  return c.json({ success: true, board })
})
