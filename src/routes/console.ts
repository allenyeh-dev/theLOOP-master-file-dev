import { Hono } from 'hono'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { hashPassword } from '../lib/password'
import type { AuthUser } from '../lib/auth-db'
import { insertUserBrands, replaceUserBrands, validBrandIds, withBrands } from '../lib/brands'
import { pushConfigured, type PushEnv } from '../lib/webpush'
import { pushHappening } from '../lib/happening-push'

type Bindings = { DB: D1Database } & PushEnv
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
  'sop.submit',
  'sop.approve',
  'sop.manage',
  'sop.view_all',
]
const ROLE_KEY_RE = /^[a-z][a-z0-9_]{1,31}$/
const BRAND_KEY_RE = /^[a-z][a-z0-9_]{1,31}$/
const BRAND_CODE_RE = /^[A-Z0-9]{2,5}$/
const DEPT_KEY_RE = /^[A-Za-z][A-Za-z0-9_]{1,15}$/
const PERMISSION_KEY_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/

// A list of department ids (may be empty) -> de-duplicated ids, or null if any is invalid.
async function validDepartmentIds(db: D1Database, ids: unknown): Promise<number[] | null> {
  if (ids === undefined || ids === null) return []
  if (!Array.isArray(ids) || !ids.every((n) => Number.isInteger(n))) return null
  const unique = [...new Set(ids as number[])]
  if (unique.length === 0) return []
  const { results } = await db
    .prepare(`SELECT id FROM sop_departments WHERE id IN (${unique.map(() => '?').join(',')})`)
    .bind(...unique)
    .all<{ id: number }>()
  return results.length === unique.length ? unique : null
}

const replaceUserDepartments = (db: D1Database, userId: number, ids: number[]) => [
  db.prepare(`DELETE FROM user_departments WHERE user_id = ?`).bind(userId),
  ...ids.map((d) => db.prepare(`INSERT INTO user_departments (user_id, department_id) VALUES (?, ?)`).bind(userId, d)),
]

async function withDepartments<T extends { id: number }>(db: D1Database, users: T[]) {
  const { results } = await db
    .prepare(`SELECT ud.user_id, d.id, d.label FROM user_departments ud JOIN sop_departments d ON d.id = ud.department_id ORDER BY d.sort_order, d.id`)
    .all<{ user_id: number; id: number; label: string }>()
  const byUser = new Map<number, { id: number; label: string }[]>()
  for (const r of results) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), { id: r.id, label: r.label }])
  return users.map((u) => ({ ...u, departments: byUser.get(u.id) ?? [] }))
}

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
  ).all<{ id: number }>()
  return c.json({ success: true, users: await withDepartments(c.env.DB, await withBrands(c.env.DB, results)) })
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
  const brandIds = await validBrandIds(c.env.DB, body?.brand_ids)
  if (!brandIds) return fail(c, 'Select at least one valid brand')
  const departmentIds = await validDepartmentIds(c.env.DB, body?.department_ids)
  if (!departmentIds) return fail(c, 'Invalid department')

  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO users (name, email, password_hash, title, role_id, is_active) VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(name, email, await hashPassword(password), title, role.id, body?.is_active === false ? 0 : 1)
      .run()
    const userId = result.meta.last_row_id
    await c.env.DB.batch([...insertUserBrands(c.env.DB, userId, brandIds), ...replaceUserDepartments(c.env.DB, userId, departmentIds)])
    return c.json({ success: true, id: userId }, 201)
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
  let brandIds: number[] | null = null
  if (body.brand_ids !== undefined) {
    brandIds = await validBrandIds(c.env.DB, body.brand_ids)
    if (!brandIds) return fail(c, 'Select at least one valid brand')
  }
  let departmentIds: number[] | null = null
  if (body.department_ids !== undefined) {
    departmentIds = await validDepartmentIds(c.env.DB, body.department_ids)
    if (!departmentIds) return fail(c, 'Invalid department')
  }
  if (updates.length === 0 && !brandIds && !departmentIds) return fail(c, 'No changes provided')

  const stmts: D1PreparedStatement[] = []
  if (updates.length) stmts.push(c.env.DB.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...values, id))
  if (brandIds) stmts.push(...replaceUserBrands(c.env.DB, id, brandIds))
  if (departmentIds) stmts.push(...replaceUserDepartments(c.env.DB, id, departmentIds))
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

/* ------------------------------- Brands ------------------------------ */

consoleRoutes.get('/brands', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT b.id, b.key, b.label, b.code,
            (SELECT COUNT(*) FROM user_brands ub WHERE ub.brand_id = b.id) as user_count
     FROM brands b ORDER BY b.sort_order, b.id`
  ).all()
  return c.json({ success: true, brands: results })
})

consoleRoutes.post('/brands', async (c) => {
  const body = await c.req.json().catch(() => null)
  const key = str(body?.key).toLowerCase()
  const label = str(body?.label)
  const code = str(body?.code).toUpperCase() || null
  if (code && !BRAND_CODE_RE.test(code)) return fail(c, 'Code must be 2-5 letters/digits')
  if (!BRAND_KEY_RE.test(key)) return fail(c, 'Key must be 2-32 chars: lowercase letters, digits, underscore, starting with a letter')
  if (!label) return fail(c, 'Label is required')

  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO brands (key, label, code, sort_order) VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM brands))`
    )
      .bind(key, label, code)
      .run()
    return c.json({ success: true, id: result.meta.last_row_id }, 201)
  } catch (err) {
    return fail(c, isUnique(err) ? 'A brand with that key already exists' : 'Failed to create brand', 409)
  }
})

consoleRoutes.patch('/brands/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid brand id')
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') return fail(c, 'Invalid request body')

  const updates: string[] = []
  const values: unknown[] = []
  if (body.label !== undefined) {
    if (!str(body.label)) return fail(c, 'Label cannot be empty')
    updates.push('label = ?')
    values.push(str(body.label))
  }
  if (body.key !== undefined) {
    const key = str(body.key).toLowerCase()
    if (!BRAND_KEY_RE.test(key)) return fail(c, 'Invalid brand key')
    updates.push('key = ?')
    values.push(key)
  }
  if (body.code !== undefined) {
    const code = str(body.code).toUpperCase()
    if (code && !BRAND_CODE_RE.test(code)) return fail(c, 'Code must be 2-5 letters/digits')
    updates.push('code = ?')
    values.push(code || null)
  }
  if (updates.length === 0) return fail(c, 'No changes provided')

  try {
    const result = await c.env.DB.prepare(`UPDATE brands SET ${updates.join(', ')} WHERE id = ?`).bind(...values, id).run()
    if (result.meta.changes === 0) return fail(c, 'Brand not found', 404)
  } catch (err) {
    return fail(c, isUnique(err) ? 'A brand with that key already exists' : 'Failed to update brand', 409)
  }
  return c.json({ success: true })
})

consoleRoutes.delete('/brands/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid brand id')
  const brand = await c.env.DB.prepare(`SELECT id FROM brands WHERE id = ?`).bind(id).first()
  if (!brand) return fail(c, 'Brand not found', 404)

  // Refuse if it would leave any user with no brand (they would see nothing).
  const orphaned = await c.env.DB.prepare(
    `SELECT COUNT(*) as n FROM user_brands ub
     WHERE ub.brand_id = ?
       AND (SELECT COUNT(*) FROM user_brands o WHERE o.user_id = ub.user_id) = 1`
  )
    .bind(id)
    .first<{ n: number }>()
  if (orphaned && orphaned.n > 0) {
    return fail(c, `${orphaned.n} user(s) belong only to this brand; assign them another brand first`, 409)
  }

  await c.env.DB.prepare(`DELETE FROM brands WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

/* --------------------------- SOP departments -------------------------- */

consoleRoutes.get('/sop-departments', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT d.id, d.key, d.label, d.is_general, (SELECT COUNT(*) FROM sops s WHERE s.department_id = d.id) AS sop_count
     FROM sop_departments d ORDER BY d.sort_order, d.id`
  ).all()
  return c.json({ success: true, departments: results })
})

consoleRoutes.post('/sop-departments', async (c) => {
  const body = await c.req.json().catch(() => null)
  const key = str(body?.key)
  const label = str(body?.label) || key
  const isGeneral = body?.is_general === true ? 1 : 0
  if (!DEPT_KEY_RE.test(key)) return fail(c, 'Key must be 2-16 chars: letters, digits, underscore, starting with a letter')
  try {
    const r = await c.env.DB.prepare(
      `INSERT INTO sop_departments (key, label, is_general, sort_order) VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM sop_departments))`
    ).bind(key, label, isGeneral).run()
    return c.json({ success: true, id: r.meta.last_row_id }, 201)
  } catch (err) {
    return fail(c, isUnique(err) ? 'A department with that key already exists' : 'Failed to create department', 409)
  }
})

consoleRoutes.patch('/sop-departments/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid department id')
  const body = await c.req.json().catch(() => null)
  const label = str(body?.label)
  if (!label) return fail(c, 'Label is required')
  // The key is part of issued SOP codes (e.g. SF-BOH-002), so only the display label can change.
  const isGeneral = body?.is_general === true ? 1 : 0
  const r = await c.env.DB.prepare(`UPDATE sop_departments SET label = ?, is_general = ? WHERE id = ?`).bind(label, isGeneral, id).run()
  if (r.meta.changes === 0) return fail(c, 'Department not found', 404)
  return c.json({ success: true })
})

consoleRoutes.delete('/sop-departments/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid department id')
  const used = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM sops WHERE department_id = ?`).bind(id).first<{ n: number }>()
  if (used && used.n > 0) return fail(c, `${used.n} SOP(s) use this department`, 409)
  await c.env.DB.prepare(`DELETE FROM sop_departments WHERE id = ?`).bind(id).run()
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

/* ------------------------- Event announcements ------------------------- */

const HAPPENING_ACCENTS = ['gold', 'red', 'green', 'orange']
const HAPPENING_ICONS = ['music', 'people', 'calendar']

consoleRoutes.get('/happenings', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT h.id, h.brand, h.brand_id, h.all_brands, h.accent, h.icon, h.tag_label, h.title, h.event_date, h.detail,
            lp.id AS last_push_id, lp.created_at AS last_push_at,
            (SELECT COUNT(*) FROM happening_push_acks a WHERE a.push_id = lp.id) AS acked,
            (SELECT COUNT(*) FROM users u WHERE u.is_active = 1
               AND (h.all_brands = 1 OR u.id IN (SELECT user_id FROM user_brands WHERE brand_id = h.brand_id))) AS recipients
     FROM brand_happenings h
     LEFT JOIN happening_pushes lp ON lp.id = (SELECT MAX(id) FROM happening_pushes WHERE happening_id = h.id)
     ORDER BY h.sort_order, h.id`
  ).all()
  return c.json({ success: true, happenings: results, push_configured: pushConfigured(c.env) })
})

// Publishes an event card to a brand's dashboard and (optionally) pushes it to every
// subscribed device of that brand's users, so it surfaces on the lock screen.
consoleRoutes.post('/happenings', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') return fail(c, 'Invalid request body')

  // brand_id 'all' = company-wide: every active user sees it and is notified.
  const allBrands = body.brand_id === 'all'
  const brandId = Number.isInteger(body.brand_id) ? (body.brand_id as number) : null
  const found = brandId
    ? await c.env.DB.prepare(`SELECT id, label FROM brands WHERE id = ?`).bind(brandId).first<{ id: number; label: string }>()
    : null
  if (!allBrands && !found) return fail(c, 'Choose a brand')
  const brand = allBrands ? { id: null, label: 'All Brands' } : found!

  const tag_label = str(body.tag_label)
  const title = str(body.title)
  const event_date = str(body.event_date)
  const detail = str(body.detail)
  if (!tag_label || !title || !event_date || !detail) return fail(c, 'Tag, title, date and details are required')
  if (title.length > 120 || tag_label.length > 40 || event_date.length > 60 || detail.length > 300) return fail(c, 'Text is too long')

  const zh = (k: string) => str(body[k]) || null
  const accent = HAPPENING_ACCENTS.includes(body.accent) ? body.accent : 'gold'
  const icon = HAPPENING_ICONS.includes(body.icon) ? body.icon : 'calendar'

  const result = await c.env.DB.prepare(
    `INSERT INTO brand_happenings
       (brand, brand_id, all_brands, accent, icon, tag_label, title, event_date, detail,
        tag_label_zh, title_zh, event_date_zh, detail_zh, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
       (SELECT COALESCE(MIN(sort_order), 0) - 1 FROM brand_happenings))`
  )
    .bind(brand.label, brand.id, allBrands ? 1 : 0, accent, icon, tag_label, title, event_date, detail,
      zh('tag_label_zh'), zh('title_zh'), zh('event_date_zh'), zh('detail_zh'))
    .run()
  const id = result.meta.last_row_id

  const push = body.notify
    ? await pushHappening(c.env, id, c.get('user').id)
    : { requested: false, configured: pushConfigured(c.env), sent: 0, failed: 0 }
  return c.json({ success: true, id, push }, 201)
})

// Push an existing event again; everyone in the brand is asked to acknowledge it anew.
consoleRoutes.post('/happenings/:id/push', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid id')
  const push = await pushHappening(c.env, id, c.get('user').id)
  if (!push) return fail(c, 'Event not found or not attached to a brand', 404)
  return c.json({ success: true, push })
})

consoleRoutes.delete('/happenings/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid id')
  const res = await c.env.DB.prepare(`DELETE FROM brand_happenings WHERE id = ?`).bind(id).run()
  if (!res.meta.changes) return fail(c, 'Not found', 404)
  return c.json({ success: true })
})
