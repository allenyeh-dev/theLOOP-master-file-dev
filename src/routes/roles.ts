import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

export const roleRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Returns previewable roles and their permission sets so that privileged
// accounts (Admin and Executive, plus anyone with users.manage for the user-management panel) can render a "view as" preview of
// another role's dashboard. This is a purely client-side rendering aid —
// it does not change the caller's real session or grant any real access;
// every protected route still authorizes against the actual logged-in user.
const PREVIEW_ROLES = ['admin', 'executive']

roleRoutes.get('/', requireAuth, async (c) => {
  const u = c.get('user')
  if (!PREVIEW_ROLES.includes(u.role.key) && !u.permissions.includes('users.manage')) return c.json({ success: false, error: 'Forbidden' }, 403)
  const { results: roles } = await c.env.DB.prepare(
    `SELECT id, key, label FROM roles ORDER BY id`
  ).all<{ id: number; key: string; label: string }>()

  const { results: rolePermissions } = await c.env.DB.prepare(
    `SELECT rp.role_id, p.key
     FROM role_permissions rp
     JOIN permissions p ON p.id = rp.permission_id`
  ).all<{ role_id: number; key: string }>()

  const permissionsByRole = new Map<number, string[]>()
  for (const row of rolePermissions) {
    const list = permissionsByRole.get(row.role_id) ?? []
    list.push(row.key)
    permissionsByRole.set(row.role_id, list)
  }

  return c.json({
    success: true,
    roles: roles.map((role) => ({
      id: role.id,
      key: role.key,
      label: role.label,
      permissions: permissionsByRole.get(role.id) ?? [],
    })),
  })
})
