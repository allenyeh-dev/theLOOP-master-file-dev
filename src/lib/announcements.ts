import { pushConfigured, sendPush, type PushEnv } from './webpush'

export const TARGET_TYPES = ['all', 'brand', 'role', 'user']
export const DISPLAY_MODES = ['feed', 'modal']

// SQL predicate: announcement `a` is addressed to user `u`. Both aliases must be in scope.
export const TARGETS_USER = `(
  a.target_type = 'all'
  OR (a.target_type = 'brand' AND a.target_id IN (SELECT brand_id FROM user_brands WHERE user_id = u.id))
  OR (a.target_type = 'role' AND a.target_id = u.role_id)
  OR (a.target_type = 'user' AND a.target_id = u.id)
)`

export const IS_LIVE = `(a.starts_at IS NULL OR a.starts_at <= datetime('now')) AND (a.ends_at IS NULL OR a.ends_at > datetime('now'))`

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

type Row = { id: number; title: string; body: string; title_zh: string | null; body_zh: string | null }
export type PushSummary = { configured: boolean; sent: number; failed: number }

// Delivers an OS notification for a 'modal' announcement to every subscribed device of its recipients.
export async function pushAnnouncement(env: { DB: D1Database } & PushEnv, id: number): Promise<PushSummary> {
  const summary: PushSummary = { configured: pushConfigured(env), sent: 0, failed: 0 }
  if (!summary.configured) return summary

  const a = await env.DB.prepare(`SELECT id, title, body, title_zh, body_zh FROM announcements WHERE id = ?`).bind(id).first<Row>()
  if (!a) return summary

  const { results: subs } = await env.DB.prepare(
    `SELECT DISTINCT s.endpoint, s.user_id, s.p256dh, s.auth, s.lang
     FROM announcements a
     JOIN users u ON u.is_active = 1
     JOIN push_subscriptions s ON s.user_id = u.id
     WHERE a.id = ? AND ${TARGETS_USER}`
  ).bind(id).all<{ endpoint: string; user_id: number; p256dh: string; auth: string; lang: string }>()

  const outcomes = await Promise.all(
    subs.map(async (sub) => {
      const zh = sub.lang === 'zh'
      const status = await sendPush(env, sub, {
        title: clip((zh && a.title_zh) || a.title, 100),
        body: clip((zh && a.body_zh) || a.body, 200),
        tag: `announcement-${a.id}`,
        url: '/',
      })
      return { endpoint: sub.endpoint, user_id: sub.user_id, status }
    })
  )

  if (outcomes.length) {
    await env.DB.batch(outcomes.map((o) =>
      env.DB.prepare(`INSERT OR REPLACE INTO announcement_push_deliveries (announcement_id, endpoint, user_id, status) VALUES (?, ?, ?, ?)`)
        .bind(id, o.endpoint, o.user_id, o.status)
    ))
  }
  const gone = outcomes.filter((o) => o.status === 'gone')
  if (gone.length) {
    await env.DB.batch(gone.map((o) => env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).bind(o.endpoint)))
  }
  summary.sent = outcomes.filter((o) => o.status === 'sent').length
  summary.failed = outcomes.length - summary.sent
  return summary
}
