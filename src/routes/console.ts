import { Hono } from 'hono'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { hashPassword } from '../lib/password'
import type { AuthUser } from '../lib/auth-db'
import { insertUserBrands, replaceUserBrands, validBrandIds, withBrands } from '../lib/brands'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

// Back-office console API. Every route requires an Admin session.
export const consoleRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

consoleRoutes.use('*', requireAuth, requireAdmin)

const SYSTEM_ROLE_KEYS = ['admin', 'executive', 'gm', 'manager', 'chef', 'foh', 'boh', 'bar']
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

/* ------------------------------- Users ------------------------------- */

async function assignableRole(db: D1Database, roleId: unknown) {
  if (typeof roleId !== 'number' || !Number.isInteger(roleId)) return null
  return db
    .prepare(`SELECT id FROM roles WHERE id = ?`)
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

  await c.env.DB.batch([
    c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(id),
    c.env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(id),
  ])
  return c.json({ success: true })
})

/* ------------------------------- Brands ------------------------------ */

// Home-page card look: logo path (served from /brands/ or an https URL), tile colour, optional sub-label.
function brandLook(body: any): { logo_url: string | null; bg_color: string | null; sub_label: string | null } | string {
  const logo = str(body?.logo_url)
  const bg = str(body?.bg_color)
  if (logo && !/^(\/[\w./-]+|https:\/\/\S+)$/.test(logo)) return 'Logo must be a /path or https:// URL'
  if (bg && !/^#[0-9a-fA-F]{6}$/.test(bg)) return 'Colour must look like #1a2b3c'
  return { logo_url: logo || null, bg_color: bg || null, sub_label: str(body?.sub_label).slice(0, 30) || null }
}

consoleRoutes.get('/brands', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT b.id, b.key, b.label, b.code, b.logo_url, b.bg_color, b.sub_label,
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
  const look = brandLook(body)
  if (typeof look === 'string') return fail(c, look)

  try {
    const result = await c.env.DB.prepare(
      `INSERT INTO brands (key, label, code, logo_url, bg_color, sub_label, sort_order) VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM brands))`
    )
      .bind(key, label, code, look.logo_url, look.bg_color, look.sub_label)
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
  const look = brandLook(body)
  if (typeof look === 'string') return fail(c, look)
  for (const k of ['logo_url', 'bg_color', 'sub_label'] as const) {
    if (body[k] !== undefined) {
      updates.push(`${k} = ?`)
      values.push(look[k])
    }
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
            h.tag_label_zh, h.title_zh, h.event_date_zh, h.detail_zh
     FROM brand_happenings h
     ORDER BY h.sort_order, h.id`
  ).all()
  return c.json({ success: true, happenings: results })
})

// Publishes an event card to a brand (or company-wide). Events are view-only: no notification is sent.
consoleRoutes.post('/happenings', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') return fail(c, 'Invalid request body')

  // brand_id 'all' = company-wide: every user sees it.
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

  return c.json({ success: true, id }, 201)
})

consoleRoutes.delete('/happenings/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid id')
  const res = await c.env.DB.prepare(`DELETE FROM brand_happenings WHERE id = ?`).bind(id).run()
  if (!res.meta.changes) return fail(c, 'Not found', 404)
  return c.json({ success: true })
})

/* ------------------------- HQ announcements ------------------------- */

const ANNOUNCEMENT_ACCENTS = ['gold', 'orange', 'red']
const TAG_VARIANTS = ['gold', 'orange', 'red']
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type Tag = { label: string; label_zh: string | null; variant: string }
type Content = {
  title: string
  body: string
  title_zh: string | null
  body_zh: string | null
  accent: string
  posted_by: string
  posted_at: string
  tags: Tag[]
}

// Shared by HQ announcements and brand notices: validates the text/tag fields.
function parseContent(body: any, defaultPostedBy: string): Content | string {
  if (!body || typeof body !== 'object') return 'Invalid request body'
  const title = str(body.title)
  const text = str(body.body)
  if (!title || !text) return 'Title and body are required'
  if (title.length > 120 || text.length > 600) return 'Text is too long'

  const posted_at = str(body.posted_at) || new Date().toISOString().slice(0, 10)
  if (!DATE_RE.test(posted_at)) return 'Invalid date'

  const tags: Tag[] = []
  for (const t of Array.isArray(body.tags) ? body.tags : []) {
    const label = str(t?.label)
    if (!label) continue
    if (label.length > 40) return 'Tag is too long'
    tags.push({ label, label_zh: str(t.label_zh) || null, variant: TAG_VARIANTS.includes(t.variant) ? t.variant : 'gold' })
  }
  if (tags.length > 4) return 'At most 4 tags'

  return {
    title,
    body: text,
    title_zh: str(body.title_zh) || null,
    body_zh: str(body.body_zh) || null,
    accent: ANNOUNCEMENT_ACCENTS.includes(body.accent) ? body.accent : 'gold',
    posted_by: str(body.posted_by).slice(0, 60) || defaultPostedBy,
    posted_at,
    tags,
  }
}

// ISO timestamp (from the browser) -> UTC 'YYYY-MM-DD HH:MM:SS', the format SQLite's datetime('now') compares against.
function parseWhen(v: unknown): string | null | undefined {
  const s = str(v)
  if (!s) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 19).replace('T', ' ')
}

type Announcement = Content & { starts_at: string | null; ends_at: string | null }

function parseAnnouncement(body: any, defaultPostedBy: string): Announcement | string {
  const content = parseContent(body, defaultPostedBy)
  if (typeof content === 'string') return content
  const starts_at = parseWhen(body.starts_at)
  const ends_at = parseWhen(body.ends_at)
  if (starts_at === undefined || ends_at === undefined) return 'Invalid publish time'
  if (starts_at && ends_at && ends_at <= starts_at) return 'Take-down time must be after the publish time'
  return { ...content, starts_at, ends_at }
}

const announcementTags = (db: D1Database, id: number, tags: Tag[]) => [
  db.prepare(`DELETE FROM announcement_tags WHERE announcement_id = ?`).bind(id),
  ...tags.map((t, i) =>
    db.prepare(`INSERT INTO announcement_tags (announcement_id, label, label_zh, variant, sort_order) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, t.label, t.label_zh, t.variant, i)),
]

consoleRoutes.get('/announcements', async (c) => {
  const [{ results: rows }, { results: tags }] = (await c.env.DB.batch([
    c.env.DB.prepare(`SELECT id, title, body, title_zh, body_zh, accent, posted_by, posted_at, starts_at, ends_at FROM announcements ORDER BY posted_at DESC, id DESC`),
    c.env.DB.prepare(`SELECT announcement_id, label, label_zh, variant FROM announcement_tags ORDER BY announcement_id, sort_order`),
  ])) as unknown as [{ results: { id: number }[] }, { results: any[] }]

  const tagMap = new Map<number, Tag[]>()
  for (const t of tags) tagMap.set(t.announcement_id, [...(tagMap.get(t.announcement_id) ?? []), { label: t.label, label_zh: t.label_zh, variant: t.variant }])
  return c.json({ success: true, announcements: rows.map((a) => ({ ...a, tags: tagMap.get(a.id) ?? [] })) })
})

consoleRoutes.post('/announcements', async (c) => {
  const user = c.get('user')
  const a = parseAnnouncement(await c.req.json().catch(() => null), user.title || user.name)
  if (typeof a === 'string') return fail(c, a)

  const res = await c.env.DB.prepare(
    `INSERT INTO announcements (title, body, title_zh, body_zh, accent, posted_by, posted_at, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(a.title, a.body, a.title_zh, a.body_zh, a.accent, a.posted_by, a.posted_at, a.starts_at, a.ends_at).run()
  const id = res.meta.last_row_id
  await c.env.DB.batch(announcementTags(c.env.DB, id, a.tags))
  return c.json({ success: true, id }, 201)
})

consoleRoutes.patch('/announcements/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid id')
  const user = c.get('user')
  const a = parseAnnouncement(await c.req.json().catch(() => null), user.title || user.name)
  if (typeof a === 'string') return fail(c, a)

  const res = await c.env.DB.prepare(
    `UPDATE announcements SET title = ?, body = ?, title_zh = ?, body_zh = ?, accent = ?, posted_by = ?, posted_at = ?, starts_at = ?, ends_at = ? WHERE id = ?`
  ).bind(a.title, a.body, a.title_zh, a.body_zh, a.accent, a.posted_by, a.posted_at, a.starts_at, a.ends_at, id).run()
  if (!res.meta.changes) return fail(c, 'Not found', 404)
  await c.env.DB.batch(announcementTags(c.env.DB, id, a.tags))
  return c.json({ success: true })
})

consoleRoutes.delete('/announcements/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid id')
  const res = await c.env.DB.prepare(`DELETE FROM announcements WHERE id = ?`).bind(id).run()
  if (!res.meta.changes) return fail(c, 'Not found', 404)
  return c.json({ success: true })
})

/* ------------------------- Brand notices ------------------------- */

const noticeBrand = (db: D1Database, v: unknown) =>
  Number.isInteger(v) ? db.prepare(`SELECT id FROM brands WHERE id = ?`).bind(v).first() : null

consoleRoutes.get('/brand-notices', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT n.id, n.brand_id, b.label AS brand, n.title, n.body, n.title_zh, n.body_zh, n.accent, n.tags, n.posted_by, n.posted_at
     FROM brand_notices n JOIN brands b ON b.id = n.brand_id
     ORDER BY n.posted_at DESC, n.id DESC`
  ).all<{ tags: string }>()
  return c.json({ success: true, notices: results.map((n) => ({ ...n, tags: JSON.parse(n.tags) })) })
})

consoleRoutes.post('/brand-notices', async (c) => {
  const user = c.get('user')
  const body = await c.req.json().catch(() => null)
  const n = parseContent(body, user.title || user.name)
  if (typeof n === 'string') return fail(c, n)
  if (!(await noticeBrand(c.env.DB, body.brand_id))) return fail(c, 'Choose a brand')

  const res = await c.env.DB.prepare(
    `INSERT INTO brand_notices (brand_id, title, body, title_zh, body_zh, accent, tags, posted_by, posted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(body.brand_id, n.title, n.body, n.title_zh, n.body_zh, n.accent, JSON.stringify(n.tags), n.posted_by, n.posted_at).run()
  return c.json({ success: true, id: res.meta.last_row_id }, 201)
})

consoleRoutes.patch('/brand-notices/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid id')
  const user = c.get('user')
  const body = await c.req.json().catch(() => null)
  const n = parseContent(body, user.title || user.name)
  if (typeof n === 'string') return fail(c, n)
  if (!(await noticeBrand(c.env.DB, body.brand_id))) return fail(c, 'Choose a brand')

  const res = await c.env.DB.prepare(
    `UPDATE brand_notices SET brand_id = ?, title = ?, body = ?, title_zh = ?, body_zh = ?, accent = ?, tags = ?, posted_by = ?, posted_at = ? WHERE id = ?`
  ).bind(body.brand_id, n.title, n.body, n.title_zh, n.body_zh, n.accent, JSON.stringify(n.tags), n.posted_by, n.posted_at, id).run()
  if (!res.meta.changes) return fail(c, 'Not found', 404)
  return c.json({ success: true })
})

consoleRoutes.delete('/brand-notices/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid id')
  const res = await c.env.DB.prepare(`DELETE FROM brand_notices WHERE id = ?`).bind(id).run()
  if (!res.meta.changes) return fail(c, 'Not found', 404)
  return c.json({ success: true })
})
