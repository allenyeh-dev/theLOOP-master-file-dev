import { Hono } from 'hono'
import { requireAuth, requirePermission } from '../middleware/auth'
import { hashPassword } from '../lib/password'
import type { AuthUser } from '../lib/auth-db'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

export const adminUserRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Every route here requires the 'users.manage' permission — this is the
// account + role administration surface for accounts like Admin/Ownership.
adminUserRoutes.use('*', requireAuth, requirePermission('users.manage'))

// 'ownership' is the top-tier role seeded directly in the database; it must
// not be grantable through the admin API to avoid privilege escalation.
async function findAssignableRole(db: D1Database, roleId: unknown) {
  if (typeof roleId !== 'number' || !Number.isInteger(roleId)) return null
  return db
    .prepare(`SELECT id FROM roles WHERE id = ? AND key != 'ownership'`)
    .bind(roleId)
    .first<{ id: number }>()
}

adminUserRoutes.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.title, u.is_active,
            r.id as role_id, r.key as role, r.label as role_label
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     ORDER BY u.id`
  ).all()
  return c.json({ success: true, users: results })
})

adminUserRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const title = typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : null

  if (!name || !email || !password) {
    return c.json({ success: false, error: 'Name, email, and password are required' }, 400)
  }
  if (password.length < 8) {
    return c.json({ success: false, error: 'Password must be at least 8 characters' }, 400)
  }

  const role = await findAssignableRole(c.env.DB, body?.role_id)
  if (!role) {
    return c.json({ success: false, error: 'A valid role is required' }, 400)
  }

  const passwordHash = await hashPassword(password)

  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO users (name, email, password_hash, title, role_id, is_active) VALUES (?, ?, ?, ?, ?, 1)`
    )
      .bind(name, email, passwordHash, title, role.id)
      .run()

    return c.json({ success: true, id: result.meta.last_row_id }, 201)
  } catch (err) {
    const message = (err as Error).message.includes('UNIQUE')
      ? 'An account with that email already exists'
      : 'Failed to create account'
    return c.json({ success: false, error: message }, 409)
  }
})

adminUserRoutes.patch('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id)) {
    return c.json({ success: false, error: 'Invalid user id' }, 400)
  }

  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return c.json({ success: false, error: 'Invalid request body' }, 400)
  }

  const actor = c.get('user')
  const updates: string[] = []
  const values: unknown[] = []

  if (typeof body.name === 'string' && body.name.trim()) {
    updates.push('name = ?')
    values.push(body.name.trim())
  }

  if (typeof body.title === 'string' || body.title === null) {
    updates.push('title = ?')
    values.push(typeof body.title === 'string' ? body.title.trim() || null : null)
  }

  if (body.role_id !== undefined) {
    const role = await findAssignableRole(c.env.DB, body.role_id)
    if (!role) {
      return c.json({ success: false, error: 'A valid role is required' }, 400)
    }
    updates.push('role_id = ?')
    values.push(role.id)
  }

  if (typeof body.is_active === 'boolean') {
    if (!body.is_active && id === actor.id) {
      return c.json({ success: false, error: 'You cannot deactivate your own account' }, 400)
    }
    updates.push('is_active = ?')
    values.push(body.is_active ? 1 : 0)
  }

  if (typeof body.password === 'string' && body.password) {
    if (body.password.length < 8) {
      return c.json({ success: false, error: 'Password must be at least 8 characters' }, 400)
    }
    updates.push('password_hash = ?')
    values.push(await hashPassword(body.password))
  }

  if (updates.length === 0) {
    return c.json({ success: false, error: 'No changes provided' }, 400)
  }

  values.push(id)
  const result = await c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()

  if (result.meta.changes === 0) {
    return c.json({ success: false, error: 'Account not found' }, 404)
  }

  return c.json({ success: true })
})
