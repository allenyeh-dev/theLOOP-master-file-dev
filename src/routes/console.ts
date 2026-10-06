import { Hono } from 'hono'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { hashPassword } from '../lib/password'
import type { AuthUser } from '../lib/auth-db'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

// Back-office console API. Every route requires an Admin/Ownership session.
export const consoleRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

consoleRoutes.use('*', requireAuth, requireAdmin)

const SYSTEM_ROLE_KEYS = ['admin', 'ownership', 'executive', 'gm', 'manager', 'chef']
const SYSTEM_PERMISSION_KEYS = [
  'dashboard.view',
  'users.manage',
  'reports.view',
  'schedule.manage',
  'inventory.manage',
  'kitchen.manage',
]
const ROLE_KEY_RE = /^[a-z][a-z0-9_]{1,31}$/
const PERMISSION_KEY_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/

const fail = (c: any, error: string, status = 400) => c.json({ success: false, error }, status)
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const parseId = (v: string) => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}
const isUnique = (err: unknown) => (err as Error).message.includes('UNIQUE')

// Only an Ownership account may touch another Ownership account, so an Admin
// can neither demote nor lock out the top tier.
function canTouch(actor: AuthUser, targetRoleKey: string | null) {
  return targetRoleKey !== 'ownership' || actor.role.key === 'ownership'
}

/* ------------------------------- Users ------------------------------- */

async function assignableRole(db: D1Database, roleId: unknown) {
  if (typeof roleId !== 'number' || !Number.isInteger(roleId)) return null
  return db
    .prepare(`SELECT id FROM roles WHERE id = ? AND key != 'ownership'`)
    .bind(roleId)
    .first<{ id: number }>()
}

consoleRoutes.get('/users', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.email, u.title, u.is_active, u.created_at,
            r.id as role_id, r.key as role_key, r.label as role_label
     FROM users u LEFT JOIN roles r ON r.id = u.role_id
     ORDER BY u.id`
  ).all()
  return c.json({ success: true, users: results })
})

consoleRoutes.post('/users', async (c) => {
  const body = await c.req.json().catch(() => null)
  const name = str(body?.name)
  const email = str(body?.email).toLowerCase()
  const password = typeof body?.password === 'string' ? body.password : ''
  const title = str(body?.title) || null

  if (!name || !email || !password) return fail(c, 'Name, email, and password are required')
  if (!email.includes('@')) return fail(c, 'Email is invalid')
  if (password.length < 8) return fail(c, 'Password must be at least 8 characters')
  const role = await assignableRole(c.env.DB, body?.role_id)
  if (!role) return fail(c, 'A valid role is required')

  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO users (name, email, password_hash, title, role_id, is_active) VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(name, email, await hashPassword(password), title, role.id, body?.is_active === false ? 0 : 1)
      .run()
    return c.json({ success: true, id: result.meta.last_row_id }, 201)
  } catch (err) {
    return fail(c, isUnique(err) ? 'An account with that email already exists' : 'Failed to create account', 409)
  }
})

consoleRoutes.patch('/users/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid user id')
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') return fail(c, 'Invalid request body')

  const actor = c.get('user')
  const target = await c.env.DB.prepare(
    `SELECT u.id, r.key as role_key FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`
  )
    .bind(id)
    .first<{ id: number; role_key: string | null }>()
  if (!target) return fail(c, 'Account not found', 404)
  if (!canTouch(actor, target.role_key)) return fail(c, 'Only Ownership can modify an Ownership account', 403)

  const updates: string[] = []
  const values: unknown[] = []
  let resetSessions = false

  if (body.name !== undefined) {
    if (!str(body.name)) return fail(c, 'Name cannot be empty')
    updates.push('name = ?')
    values.push(str(body.name))
  }
  if (body.email !== undefined) {
    const email = str(body.email).toLowerCase()
    if (!email.includes('@')) return fail(c, 'Email is invalid')
    updates.push('email = ?')
    values.push(email)
  }
  if (body.title !== undefined) {
    updates.push('title = ?')
    values.push(str(body.title) || null)
  }
  if (body.role_id !== undefined) {
    if (id === actor.id) return fail(c, 'You cannot change your own role')
    const role = await assignableRole(c.env.DB, body.role_id)
    if (!role) return fail(c, 'A valid role is required')
    updates.push('role_id = ?')
    values.push(role.id)
  }
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') return fail(c, 'is_active must be a boolean')
    if (!body.is_active && id === actor.id) return fail(c, 'You cannot deactivate your own account')
    updates.push('is_active = ?')
    values.push(body.is_active ? 1 : 0)
    if (!body.is_active) resetSessions = true
  }
  if (typeof body.password === 'string' && body.password) {
    if (body.password.length < 8) return fail(c, 'Password must be at least 8 characters')
    updates.push('password_hash = ?')
    values.push(await hashPassword(body.password))
    resetSessions = id !== actor.id
  }
  if (updates.length === 0) return fail(c, 'No changes provided')

  const stmts = [c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values, id)]
  if (resetSessions) stmts.push(c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(id))
  try {
    await c.env.DB.batch(stmts)
  } catch (err) {
    return fail(c, isUnique(err) ? 'An account with that email already exists' : 'Failed to update account', 409)
  }
  return c.json({ success: true })
})

consoleRoutes.delete('/users/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid user id')
  const actor = c.get('user')
  if (id === actor.id) return fail(c, 'You cannot delete your own account')

  const target = await c.env.DB.prepare(
    `SELECT r.key as role_key FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id = ?`
  )
    .bind(id)
    .first<{ role_key: string | null }>()
  if (!target) return fail(c, 'Account not found', 404)
  if (!canTouch(actor, target.role_key)) return fail(c, 'Only Ownership can modify an Ownership account', 403)

  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(id),
  ])
  return c.json({ success: true })
})

/* ------------------------------- Roles ------------------------------- */

async function validPermissionIds(db: D1Database, ids: unknown): Promise<number[] | null> {
  if (!Array.isArray(ids) || !ids.every((n) => Number.isInteger(n))) return null
  const unique = [...new Set(ids as number[])]
  if (unique.length === 0) return []
  const { results } = await db
    .prepare(`SELECT id FROM permissions WHERE id IN (${unique.map(() => '?').join(',')})`)
    .bind(...unique)
    .all<{ id: number }>()
  return results.length === unique.length ? unique : null
}

consoleRoutes.get('/roles', async (c) => {
  const { results: roles } = await c.env.DB.prepare(
    `SELECT r.id, r.key, r.label,
            (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) as user_count
     FROM roles r ORDER BY r.id`
  ).all<{ id: number; key: string; label: string; user_count: number }>()
  const { results: links } = await c.env.DB.prepare(`SELECT role_id, permission_id FROM role_permissions`).all<{
    role_id: number
    permission_id: number
  }>()

  const byRole = new Map<number, number[]>()
  for (const l of links) byRole.set(l.role_id, [...(byRole.get(l.role_id) ?? []), l.permission_id])

  return c.json({
    success: true,
    roles: roles.map((r) => ({
      ...r,
      permission_ids: byRole.get(r.id) ?? [],
      is_system: SYSTEM_ROLE_KEYS.includes(r.key),
      is_locked: r.key === 'ownership',
    })),
  })
})

consoleRoutes.post('/roles', async (c) => {
  const body = await c.req.json().catch(() => null)
  const key = str(body?.key).toLowerCase()
  const label = str(body?.label)
  if (!ROLE_KEY_RE.test(key)) return fail(c, 'Key must be 2-32 chars: lowercase letters, digits, underscore, starting with a letter')
  if (!label) return fail(c, 'Label is required')
  const permissionIds = await validPermissionIds(c.env.DB, body?.permission_ids ?? [])
  if (!permissionIds) return fail(c, 'Invalid permission list')

  try {
    const result = await c.env.DB.prepare(`INSERT INTO roles (key, label) VALUES (?, ?)`).bind(key, label).run()
    const roleId = result.meta.last_row_id
    if (permissionIds.length) {
      await c.env.DB.batch(
        permissionIds.map((pid) =>
          c.env.DB.prepare(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`).bind(roleId, pid)
        )
      )
    }
    return c.json({ success: true, id: roleId }, 201)
  } catch (err) {
    return fail(c, isUnique(err) ? 'A role with that key already exists' : 'Failed to create role', 409)
  }
})

consoleRoutes.patch('/roles/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid role id')
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') return fail(c, 'Invalid request body')

  const role = await c.env.DB.prepare(`SELECT id, key FROM roles WHERE id = ?`).bind(id).first<{ id: number; key: string }>()
  if (!role) return fail(c, 'Role not found', 404)
  if (role.key === 'ownership') return fail(c, 'The Ownership role is locked', 403)

  const stmts: D1PreparedStatement[] = []
  if (body.label !== undefined) {
    if (!str(body.label)) return fail(c, 'Label cannot be empty')
    stmts.push(c.env.DB.prepare(`UPDATE roles SET label = ? WHERE id = ?`).bind(str(body.label), id))
  }
  if (body.key !== undefined && str(body.key).toLowerCase() !== role.key) {
    if (SYSTEM_ROLE_KEYS.includes(role.key)) return fail(c, 'System role keys cannot be changed')
    const key = str(body.key).toLowerCase()
    if (!ROLE_KEY_RE.test(key) || SYSTEM_ROLE_KEYS.includes(key)) return fail(c, 'Invalid or reserved role key')
    stmts.push(c.env.DB.prepare(`UPDATE roles SET key = ? WHERE id = ?`).bind(key, id))
  }
  if (body.permission_ids !== undefined) {
    const permissionIds = await validPermissionIds(c.env.DB, body.permission_ids)
    if (!permissionIds) return fail(c, 'Invalid permission list')
    stmts.push(c.env.DB.prepare(`DELETE FROM role_permissions WHERE role_id = ?`).bind(id))
    for (const pid of permissionIds) {
      stmts.push(c.env.DB.prepare(`INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)`).bind(id, pid))
    }
  }
  if (stmts.length === 0) return fail(c, 'No changes provided')

  try {
    await c.env.DB.batch(stmts)
  } catch (err) {
    return fail(c, isUnique(err) ? 'A role with that key already exists' : 'Failed to update role', 409)
  }
  return c.json({ success: true })
})

consoleRoutes.delete('/roles/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid role id')
  const role = await c.env.DB.prepare(`SELECT id, key FROM roles WHERE id = ?`).bind(id).first<{ id: number; key: string }>()
  if (!role) return fail(c, 'Role not found', 404)
  if (SYSTEM_ROLE_KEYS.includes(role.key)) return fail(c, 'System roles cannot be deleted', 403)

  const inUse = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM users WHERE role_id = ?`).bind(id).first<{ n: number }>()
  if (inUse && inUse.n > 0) return fail(c, `Role is assigned to ${inUse.n} user(s); reassign them first`, 409)

  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM role_permissions WHERE role_id = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM roles WHERE id = ?`).bind(id),
  ])
  return c.json({ success: true })
})

/* ---------------------------- Permissions ---------------------------- */

consoleRoutes.get('/permissions', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT p.id, p.key, p.description,
            (SELECT COUNT(*) FROM role_permissions rp WHERE rp.permission_id = p.id) as role_count
     FROM permissions p ORDER BY p.id`
  ).all<{ id: number; key: string; description: string; role_count: number }>()
  return c.json({
    success: true,
    permissions: results.map((p) => ({ ...p, is_system: SYSTEM_PERMISSION_KEYS.includes(p.key) })),
  })
})

consoleRoutes.post('/permissions', async (c) => {
  const body = await c.req.json().catch(() => null)
  const key = str(body?.key).toLowerCase()
  const description = str(body?.description)
  if (!PERMISSION_KEY_RE.test(key) || key.length > 64) return fail(c, 'Key must look like "area.action" (lowercase letters, digits, underscore, dots)')
  if (!description) return fail(c, 'Description is required')

  try {
    const result = await c.env.DB.prepare(`INSERT INTO permissions (key, description) VALUES (?, ?)`)
      .bind(key, description)
      .run()
    // Ownership is defined as holding every permission; keep that invariant.
    await c.env.DB.prepare(
      `INSERT INTO role_permissions (role_id, permission_id)
       SELECT id, ? FROM roles WHERE key = 'ownership'`
    )
      .bind(result.meta.last_row_id)
      .run()
    return c.json({ success: true, id: result.meta.last_row_id }, 201)
  } catch (err) {
    return fail(c, isUnique(err) ? 'A permission with that key already exists' : 'Failed to create permission', 409)
  }
})

consoleRoutes.patch('/permissions/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid permission id')
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') return fail(c, 'Invalid request body')

  const perm = await c.env.DB.prepare(`SELECT id, key FROM permissions WHERE id = ?`).bind(id).first<{ id: number; key: string }>()
  if (!perm) return fail(c, 'Permission not found', 404)

  const updates: string[] = []
  const values: unknown[] = []
  if (body.description !== undefined) {
    if (!str(body.description)) return fail(c, 'Description cannot be empty')
    updates.push('description = ?')
    values.push(str(body.description))
  }
  if (body.key !== undefined && str(body.key).toLowerCase() !== perm.key) {
    if (SYSTEM_PERMISSION_KEYS.includes(perm.key)) return fail(c, 'System permission keys cannot be changed')
    const key = str(body.key).toLowerCase()
    if (!PERMISSION_KEY_RE.test(key) || key.length > 64 || SYSTEM_PERMISSION_KEYS.includes(key)) {
      return fail(c, 'Invalid or reserved permission key')
    }
    updates.push('key = ?')
    values.push(key)
  }
  if (updates.length === 0) return fail(c, 'No changes provided')

  try {
    await c.env.DB.prepare(`UPDATE permissions SET ${updates.join(', ')} WHERE id = ?`).bind(...values, id).run()
  } catch (err) {
    return fail(c, isUnique(err) ? 'A permission with that key already exists' : 'Failed to update permission', 409)
  }
  return c.json({ success: true })
})

consoleRoutes.delete('/permissions/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid permission id')
  const perm = await c.env.DB.prepare(`SELECT id, key FROM permissions WHERE id = ?`).bind(id).first<{ id: number; key: string }>()
  if (!perm) return fail(c, 'Permission not found', 404)
  if (SYSTEM_PERMISSION_KEYS.includes(perm.key)) return fail(c, 'System permissions cannot be deleted', 403)

  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM role_permissions WHERE permission_id = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM permissions WHERE id = ?`).bind(id),
  ])
  return c.json({ success: true })
})
