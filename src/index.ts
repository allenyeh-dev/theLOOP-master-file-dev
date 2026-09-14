import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authRoutes } from './routes/auth'
import { roleRoutes } from './routes/roles'
import { announcementRoutes } from './routes/announcements'
import { adminUserRoutes } from './routes/admin-users'
import { requireAuth } from './middleware/auth'
import type { AuthUser } from './lib/auth-db'

type Bindings = {
  DB: D1Database
}

type Variables = {
  user: AuthUser
}

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

app.use(
  '/api/*',
  cors({
    origin: ['http://localhost:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
    credentials: true,
  })
)

app.get('/api/hello', (c) => {
  return c.json({
    message: 'Hello from Hono on Cloudflare Workers!',
    timestamp: new Date().toISOString(),
  })
})

app.get('/api/users', async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, name, email, created_at FROM users ORDER BY id'
    ).all()

    return c.json({ success: true, users: results })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

app.route('/api/auth', authRoutes)
app.route('/api/roles', roleRoutes)
app.route('/api/announcements', announcementRoutes)
app.route('/api/admin/users', adminUserRoutes)

// Any authenticated account, regardless of role, can see the staff directory.
app.get('/api/staff', requireAuth, async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.name, u.title, r.key as role, r.label as role_label
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.role_id IS NOT NULL
     ORDER BY u.name`
  ).all()
  return c.json({ success: true, staff: results })
})

export default app
