import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

export const scheduleRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const POSITIONS = ['FOH', 'BOH', 'BAR', 'SECURITY', 'HOST', 'MANAGER']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

const isMember = (db: D1Database, userId: number, brandId: number) =>
  db.prepare(`SELECT 1 FROM user_brands WHERE user_id = ? AND brand_id = ?`).bind(userId, brandId).first()

const canManage = (u: AuthUser) => u.permissions.includes('schedule.manage') || u.role.key === 'admin'

const SELECT_SHIFTS = `
  SELECT s.id, s.user_id, u.name AS user_name, s.shift_date, s.start_time, s.end_time, s.position
  FROM shifts s JOIN users u ON u.id = s.user_id`

// Resolve brand + membership + (optionally) manage rights; returns an error Response or null.
async function guard(c: any, brandId: number, manage: boolean) {
  if (!Number.isInteger(brandId) || brandId < 1) return c.json({ success: false, error: 'Invalid id' }, 400)
  const user: AuthUser = c.get('user')
  if (!(await isMember(c.env.DB, user.id, brandId))) return c.json({ success: false, error: 'You do not have access to this brand' }, 403)
  if (manage && !canManage(user)) return c.json({ success: false, error: 'Forbidden' }, 403)
  return null
}

// One day: my shifts always (once published), the whole team when published or when the caller manages.
scheduleRoutes.get('/', requireAuth, async (c) => {
  const brandId = Number(c.req.query('brand_id'))
  const date = c.req.query('date') ?? ''
  if (!DATE_RE.test(date)) return c.json({ success: false, error: 'Invalid date' }, 400)
  const denied = await guard(c, brandId, false)
  if (denied) return denied
  const user = c.get('user')
  const manage = canManage(user)
  const published = Boolean(await c.env.DB.prepare(`SELECT 1 FROM schedule_publish WHERE brand_id = ? AND shift_date = ?`).bind(brandId, date).first())
  const { results } = await c.env.DB.prepare(
    `${SELECT_SHIFTS} WHERE s.brand_id = ? AND s.shift_date = ? ORDER BY s.start_time, u.name, s.id`
  ).bind(brandId, date).all<any>()
  const visible = published || manage ? results : []
  return c.json({
    success: true,
    published,
    can_manage: manage,
    shifts: visible,
    my_shifts: visible.filter((s) => s.user_id === user.id),
  })
})

// People of the brand who can be rostered.
scheduleRoutes.get('/staff', requireAuth, async (c) => {
  const brandId = Number(c.req.query('brand_id'))
  const denied = await guard(c, brandId, true)
  if (denied) return denied
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.name FROM users u JOIN user_brands ub ON ub.user_id = u.id AND ub.brand_id = ?
     WHERE u.is_active = 1 ORDER BY u.name`
  ).bind(brandId).all()
  return c.json({ success: true, staff: results, positions: POSITIONS })
})

scheduleRoutes.post('/shifts', requireAuth, async (c) => {
  const b: any = await c.req.json().catch(() => null)
  const brandId = Number(b?.brand_id)
  const userId = Number(b?.user_id)
  const date = typeof b?.shift_date === 'string' ? b.shift_date : ''
  if (!DATE_RE.test(date)) return c.json({ success: false, error: 'Invalid date' }, 400)
  if (!TIME_RE.test(b?.start_time ?? '') || !TIME_RE.test(b?.end_time ?? '') || b.start_time === b.end_time) {
    return c.json({ success: false, error: 'Invalid shift time' }, 400)
  }
  if (!POSITIONS.includes(b?.position)) return c.json({ success: false, error: 'Invalid position' }, 400)
  const denied = await guard(c, brandId, true)
  if (denied) return denied
  if (!Number.isInteger(userId) || !(await isMember(c.env.DB, userId, brandId))) {
    return c.json({ success: false, error: 'That person is not part of this brand' }, 400)
  }
  const row = await c.env.DB.prepare(
    `INSERT INTO shifts (brand_id, user_id, shift_date, start_time, end_time, position, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(brandId, userId, date, b.start_time, b.end_time, b.position, c.get('user').id).first<{ id: number }>()
  const shift = await c.env.DB.prepare(`${SELECT_SHIFTS} WHERE s.id = ?`).bind(row!.id).first()
  return c.json({ success: true, shift })
})

scheduleRoutes.delete('/shifts/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id < 1) return c.json({ success: false, error: 'Invalid id' }, 400)
  const shift = await c.env.DB.prepare(`SELECT brand_id FROM shifts WHERE id = ?`).bind(id).first<{ brand_id: number }>()
  if (!shift) return c.json({ success: false, error: 'Not found' }, 404)
  const denied = await guard(c, shift.brand_id, true)
  if (denied) return denied
  await c.env.DB.prepare(`DELETE FROM shifts WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

// Publish / unpublish one day.
scheduleRoutes.put('/publish', requireAuth, async (c) => {
  const b: any = await c.req.json().catch(() => null)
  const brandId = Number(b?.brand_id)
  const date = typeof b?.date === 'string' ? b.date : ''
  if (!DATE_RE.test(date) || typeof b?.published !== 'boolean') return c.json({ success: false, error: 'Invalid request body' }, 400)
  const denied = await guard(c, brandId, true)
  if (denied) return denied
  if (b.published) {
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO schedule_publish (brand_id, shift_date, published_by) VALUES (?, ?, ?)`
    ).bind(brandId, date, c.get('user').id).run()
  } else {
    await c.env.DB.prepare(`DELETE FROM schedule_publish WHERE brand_id = ? AND shift_date = ?`).bind(brandId, date).run()
  }
  return c.json({ success: true, published: b.published })
})

// Copy the same weekday of the previous week onto `date` (as drafts); shifts already there are skipped.
scheduleRoutes.post('/copy-last-week', requireAuth, async (c) => {
  const b: any = await c.req.json().catch(() => null)
  const brandId = Number(b?.brand_id)
  const date = typeof b?.date === 'string' ? b.date : ''
  if (!DATE_RE.test(date)) return c.json({ success: false, error: 'Invalid date' }, 400)
  const denied = await guard(c, brandId, true)
  if (denied) return denied
  const res = await c.env.DB.prepare(
    `INSERT INTO shifts (brand_id, user_id, shift_date, start_time, end_time, position, created_by)
     SELECT s.brand_id, s.user_id, ?2, s.start_time, s.end_time, s.position, ?3
     FROM shifts s JOIN user_brands ub ON ub.user_id = s.user_id AND ub.brand_id = s.brand_id
     WHERE s.brand_id = ?1 AND s.shift_date = date(?2, '-7 days')
       AND NOT EXISTS (SELECT 1 FROM shifts x WHERE x.brand_id = s.brand_id AND x.shift_date = ?2
                       AND x.user_id = s.user_id AND x.start_time = s.start_time AND x.end_time = s.end_time)`
  ).bind(brandId, date, c.get('user').id).run()
  return c.json({ success: true, copied: res.meta.changes })
})
