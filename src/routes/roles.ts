import { Hono } from 'hono'
import { requireAuth, requirePermission } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

export const roleRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Returns previewable roles and their permission sets so that privileged
// accounts (anyone with users.manage) can render a "view as" preview of
// another role's dashboard. This is a purely client-side rendering aid —
// it does not change the caller's real session or grant any real access;
// every protected route still authorizes against the actual logged-in user.
roleRoutes.get('/', requireAuth, requirePermission('users.manage'), async (c) => {
  const { results: roles } = await c.env.DB.prepare(
    `SELECT id, key, label FROM roles WHERE key != 'ownership' ORDER BY id`
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
      key: role.key,
      label: role.label,
      permissions: permissionsByRole.get(role.id) ?? [],
    })),
  })
})
