import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'
import { pushConfigured, type PushEnv } from '../lib/webpush'

type Bindings = { DB: D1Database } & PushEnv
type Variables = { user: AuthUser }

export const pushRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()

pushRoutes.use('*', requireAuth)

pushRoutes.get('/public-key', (c) => {
  if (!pushConfigured(c.env)) return c.json({ success: false, error: 'Push notifications are not configured' }, 503)
  return c.json({ success: true, publicKey: c.env.VAPID_PUBLIC_KEY })
})

pushRoutes.post('/subscribe', async (c) => {
  const body = await c.req.json().catch(() => null)
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const auth = body?.keys?.auth
  if (![endpoint, p256dh, auth].every((v) => typeof v === 'string' && v)) {
    return c.json({ success: false, error: 'Invalid subscription' }, 400)
  }
  if (!/^https:\/\//.test(endpoint)) return c.json({ success: false, error: 'Invalid subscription' }, 400)
  const lang = body.lang === 'zh' ? 'zh' : 'en'

  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, lang) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh,
       auth = excluded.auth, lang = excluded.lang`
  ).bind(c.get('user').id, endpoint, p256dh, auth, lang).run()
  return c.json({ success: true })
})

// Scoped to the caller so one user can't drop another's device.
pushRoutes.post('/unsubscribe', async (c) => {
  const body = await c.req.json().catch(() => null)
  if (typeof body?.endpoint !== 'string') return c.json({ success: false, error: 'Invalid subscription' }, 400)
  await c.env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?`)
    .bind(body.endpoint, c.get('user').id).run()
  return c.json({ success: true })
})
