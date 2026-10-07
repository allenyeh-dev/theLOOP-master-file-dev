import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { verifyPassword } from '../lib/password'
import {
  createSession,
  deleteSession,
  findUserByEmail,
  getBrandsForUser,
  getPermissionsForRole,
  toAuthUser,
  type AuthUser,
} from '../lib/auth-db'
import { requireAuth, SESSION_COOKIE_NAME } from '../middleware/auth'

type Bindings = { DB: D1Database }
type Variables = { user: AuthUser }

export const authRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

authRoutes.post('/login', async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>().catch(() => null)
  const email = body?.email?.trim().toLowerCase()
  const password = body?.password

  if (!email || !password) {
    return c.json({ success: false, error: 'Email and password are required' }, 400)
  }

  const row = await findUserByEmail(c.env.DB, email)
  if (!row || !row.is_active || !row.password_hash) {
    return c.json({ success: false, error: 'Invalid email or password' }, 401)
  }

  const valid = await verifyPassword(password, row.password_hash)
  if (!valid) {
    return c.json({ success: false, error: 'Invalid email or password' }, 401)
  }

  const session = await createSession(c.env.DB, row.id)
  setCookie(c, SESSION_COOKIE_NAME, session.id, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    expires: session.expiresAt,
  })

  const permissions = row.role_id ? await getPermissionsForRole(c.env.DB, row.role_id) : []
  const brands = await getBrandsForUser(c.env.DB, row.id)
  return c.json({ success: true, user: toAuthUser(row, permissions, brands) })
})

authRoutes.post('/logout', async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE_NAME)
  if (sessionId) {
    await deleteSession(c.env.DB, sessionId)
  }
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' })
  return c.json({ success: true })
})

authRoutes.get('/me', requireAuth, async (c) => {
  return c.json({ success: true, user: c.get('user') })
})
