import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

export const taskRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

const PRIORITIES = ['high', 'med', 'low']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

const isMember = (db: D1Database, userId: number, brandId: number) =>
  db.prepare(`SELECT 1 FROM user_brands WHERE user_id = ? AND brand_id = ?`).bind(userId, brandId).first()

// Open tasks: high priority first, then by due date/time (undated last), then oldest first.
// Done tasks: most recently completed first.
const SELECT_TASKS = `
  SELECT t.id, t.brand_id, t.title, t.priority, t.due_date, t.due_time, t.assigned_to,
         t.created_at, t.completed_at, cu.name AS completed_by
  FROM tasks t LEFT JOIN users cu ON cu.id = t.completed_by`

taskRoutes.get('/', requireAuth, async (c) => {
  const brandId = Number(c.req.query('brand_id'))
  if (!Number.isInteger(brandId) || brandId < 1) return c.json({ success: false, error: 'Invalid id' }, 400)
  if (!(await isMember(c.env.DB, c.get('user').id, brandId))) {
    return c.json({ success: false, error: 'You do not have access to this brand' }, 403)
  }
  const { results } = await c.env.DB.prepare(
    `${SELECT_TASKS} WHERE t.brand_id = ?
     ORDER BY t.completed_at IS NOT NULL,
              CASE WHEN t.completed_at IS NULL THEN CASE t.priority WHEN 'high' THEN 0 WHEN 'med' THEN 1 ELSE 2 END END,
              CASE WHEN t.completed_at IS NULL THEN t.due_date IS NULL END,
              CASE WHEN t.completed_at IS NULL THEN t.due_date END,
              CASE WHEN t.completed_at IS NULL THEN t.due_time END,
              t.completed_at DESC, t.id`
  ).bind(brandId).all()
  return c.json({ success: true, tasks: results })
})

taskRoutes.post('/', requireAuth, async (c) => {
  const b: any = await c.req.json().catch(() => null)
  const brandId = Number(b?.brand_id)
  const title = s(b?.title, 200)
  if (!Number.isInteger(brandId) || brandId < 1) return c.json({ success: false, error: 'Invalid id' }, 400)
  if (!title) return c.json({ success: false, error: 'Title is required' }, 400)
  const dueDate = s(b.due_date, 10) || null
  const dueTime = s(b.due_time, 5) || null
  if (dueDate && !DATE_RE.test(dueDate)) return c.json({ success: false, error: 'Invalid due date' }, 400)
  if (dueTime && !TIME_RE.test(dueTime)) return c.json({ success: false, error: 'Invalid due time' }, 400)
  const user = c.get('user')
  if (!(await isMember(c.env.DB, user.id, brandId))) {
    return c.json({ success: false, error: 'You do not have access to this brand' }, 403)
  }
  const row = await c.env.DB.prepare(
    `INSERT INTO tasks (brand_id, title, priority, due_date, due_time, assigned_to, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
  ).bind(brandId, title, PRIORITIES.includes(b.priority) ? b.priority : 'med', dueDate, dueTime ? (dueDate ? dueTime : null) : null, s(b.assigned_to, 100), user.id)
    .first<{ id: number }>()
  const task = await c.env.DB.prepare(`${SELECT_TASKS} WHERE t.id = ?`).bind(row!.id).first()
  return c.json({ success: true, task })
})

// Clear every finished task of one brand. Registered before '/:id' so "completed" is not read as an id.
taskRoutes.delete('/completed', requireAuth, async (c) => {
  const brandId = Number(c.req.query('brand_id'))
  if (!Number.isInteger(brandId) || brandId < 1) return c.json({ success: false, error: 'Invalid id' }, 400)
  if (!(await isMember(c.env.DB, c.get('user').id, brandId))) {
    return c.json({ success: false, error: 'You do not have access to this brand' }, 403)
  }
  const res = await c.env.DB.prepare(`DELETE FROM tasks WHERE brand_id = ? AND completed_at IS NOT NULL`).bind(brandId).run()
  return c.json({ success: true, deleted: res.meta.changes })
})

// Loads a task the caller may touch (member of its brand), or null.
const accessibleTask = (db: D1Database, id: number, userId: number) =>
  db.prepare(
    `SELECT t.id FROM tasks t JOIN user_brands ub ON ub.brand_id = t.brand_id AND ub.user_id = ? WHERE t.id = ?`
  ).bind(userId, id).first()

// Tick / untick a task.
taskRoutes.patch('/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  const b: any = await c.req.json().catch(() => null)
  if (!Number.isInteger(id) || id < 1 || typeof b?.done !== 'boolean') return c.json({ success: false, error: 'Invalid request body' }, 400)
  const user = c.get('user')
  if (!(await accessibleTask(c.env.DB, id, user.id))) return c.json({ success: false, error: 'Not found' }, 404)
  await c.env.DB.prepare(
    b.done
      ? `UPDATE tasks SET completed_at = datetime('now'), completed_by = ? WHERE id = ?`
      : `UPDATE tasks SET completed_at = NULL, completed_by = ? WHERE id = ?`
  ).bind(b.done ? user.id : null, id).run()
  const task = await c.env.DB.prepare(`${SELECT_TASKS} WHERE t.id = ?`).bind(id).first()
  return c.json({ success: true, task })
})

// Delete one finished task. Open tasks can't be deleted this way: tick them first.
taskRoutes.delete('/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id < 1) return c.json({ success: false, error: 'Invalid id' }, 400)
  if (!(await accessibleTask(c.env.DB, id, c.get('user').id))) return c.json({ success: false, error: 'Not found' }, 404)
  const res = await c.env.DB.prepare(`DELETE FROM tasks WHERE id = ? AND completed_at IS NOT NULL`).bind(id).run()
  if (!res.meta.changes) return c.json({ success: false, error: 'Only completed tasks can be deleted' }, 400)
  return c.json({ success: true })
})
