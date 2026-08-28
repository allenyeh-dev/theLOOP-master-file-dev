import type { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { findSessionUser, getPermissionsForRole, toAuthUser, type AuthUser } from '../lib/auth-db'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }
type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>

export const SESSION_COOKIE_NAME = 'loop_session'

export async function requireAuth(c: AppContext, next: Next) {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME)
  if (!sessionId) {
    return c.json({ success: false, error: 'Not authenticated' }, 401)
  }

  const row = await findSessionUser(c.env.DB, sessionId)
  if (!row || !row.is_active) {
    return c.json({ success: false, error: 'Not authenticated' }, 401)
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return c.json({ success: false, error: 'Session expired' }, 401)
  }

  const permissions = row.role_id ? await getPermissionsForRole(c.env.DB, row.role_id) : []
  c.set('user', toAuthUser(row, permissions))

  await next()
}

export function requirePermission(permission: string) {
  return async (c: AppContext, next: Next) => {
    const user = c.get('user')
    if (!user || !user.permissions.includes(permission)) {
      return c.json({ success: false, error: 'Forbidden' }, 403)
    }
    await next()
  }
}
