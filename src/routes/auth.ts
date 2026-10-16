import { Hono, type Context } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { verifyPassword } from '../lib/password'
import {
  createSession,
  deleteSession,
  findUserByEmail,
  getBrandsForUser,
  getPermissionsForRole,
  getDepartmentsForUser,
  toAuthUser,
  type AuthUser,
} from '../lib/auth-db'
import { requireAuth, SESSION_COOKIE_NAME } from '../middleware/auth'

type Bindings = {
  DB: D1Database
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  // Optional overrides, needed when the browser-facing origin differs from the
  // Worker's (e.g. Vite dev server on :5173 proxying /api to wrangler on :8787).
  GOOGLE_REDIRECT_URI?: string
  APP_URL?: string
}
type Variables = { user: AuthUser }
type AuthContext = Context<{ Bindings: Bindings; Variables: Variables }>

async function startSession(c: AuthContext, userId: number) {
  const session = await createSession(c.env.DB, userId)
  setCookie(c, SESSION_COOKIE_NAME, session.id, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    expires: session.expiresAt,
  })
}

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

  await startSession(c, row.id)

  const permissions = row.role_id ? await getPermissionsForRole(c.env.DB, row.role_id) : []
  const brands = await getBrandsForUser(c.env.DB, row.id)
  const departments = await getDepartmentsForUser(c.env.DB, row.id)
  return c.json({ success: true, user: toAuthUser(row, permissions, brands, departments) })
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

// ---- Google SSO (OAuth 2.0 authorization code flow) ----
// Sign-in only: the Google account's verified email must match an existing,
// active user. Accounts are never auto-created.

const GOOGLE_STATE_COOKIE = 'loop_google_state'
const GOOGLE_STATE_TTL_SECONDS = 600

function googleRedirectUri(c: AuthContext) {
  return c.env.GOOGLE_REDIRECT_URI || `${new URL(c.req.url).origin}/api/auth/google/callback`
}

function loginErrorRedirect(c: AuthContext, code: string) {
  deleteCookie(c, GOOGLE_STATE_COOKIE, { path: '/api/auth' })
  return c.redirect(`${c.env.APP_URL || ''}/?login_error=${code}`)
}

authRoutes.get('/google', (c) => {
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return loginErrorRedirect(c, 'google_not_configured')
  }

  const state = crypto.randomUUID()
  setCookie(c, GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax', // must be sent on the top-level redirect back from Google
    path: '/api/auth',
    maxAge: GOOGLE_STATE_TTL_SECONDS,
  })

  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(c),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
})

authRoutes.get('/google/callback', async (c) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = c.env
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return loginErrorRedirect(c, 'google_not_configured')
  }

  const expectedState = getCookie(c, GOOGLE_STATE_COOKIE)
  const state = c.req.query('state')
  const code = c.req.query('code')
  if (c.req.query('error') || !code) return loginErrorRedirect(c, 'google_cancelled')
  if (!expectedState || state !== expectedState) return loginErrorRedirect(c, 'google_failed')

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirectUri(c),
      grant_type: 'authorization_code',
    }),
  })
  const tokens = await tokenRes.json<{ id_token?: string }>().catch(() => null)
  if (!tokenRes.ok || !tokens?.id_token) return loginErrorRedirect(c, 'google_failed')

  // The ID token comes straight from Google's token endpoint over TLS, so its
  // signature need not be re-verified; we still check the claims.
  const claims = decodeJwtPayload(tokens.id_token)
  const validIssuer = claims?.iss === 'https://accounts.google.com' || claims?.iss === 'accounts.google.com'
  if (
    !claims ||
    !validIssuer ||
    claims.aud !== GOOGLE_CLIENT_ID ||
    typeof claims.exp !== 'number' ||
    claims.exp * 1000 < Date.now() ||
    claims.email_verified !== true ||
    typeof claims.email !== 'string'
  ) {
    return loginErrorRedirect(c, 'google_failed')
  }

  const row = await findUserByEmail(c.env.DB, claims.email.trim().toLowerCase())
  if (!row || !row.is_active) return loginErrorRedirect(c, 'google_no_account')

  await startSession(c, row.id)
  deleteCookie(c, GOOGLE_STATE_COOKIE, { path: '/api/auth' })
  return c.redirect(`${c.env.APP_URL || ''}/`)
})

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const part = jwt.split('.')[1]
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}
