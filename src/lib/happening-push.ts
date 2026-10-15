import { pushConfigured, sendPush, type PushEnv } from './webpush'

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

type Happening = {
  id: number
  brand_id: number | null
  all_brands: number
  brand: string
  title: string
  detail: string
  event_date: string
  title_zh: string | null
  detail_zh: string | null
  event_date_zh: string | null
}

export type PushSummary = { requested: boolean; configured: boolean; sent: number; failed: number }

// Records a push (which makes the in-app "acknowledge" sheet appear for the brand's users)
// and delivers an OS notification to each of their subscribed devices.
export async function pushHappening(
  env: { DB: D1Database } & PushEnv,
  happeningId: number,
  sentBy: number
): Promise<PushSummary | null> {
  const h = await env.DB.prepare(
    `SELECT id, brand_id, all_brands, brand, title, detail, event_date, title_zh, detail_zh, event_date_zh
     FROM brand_happenings WHERE id = ?`
  ).bind(happeningId).first<Happening>()
  if (!h || (!h.brand_id && !h.all_brands)) return null

  await env.DB.prepare(`INSERT INTO happening_pushes (happening_id, sent_by) VALUES (?, ?)`).bind(h.id, sentBy).run()

  const summary: PushSummary = { requested: true, configured: pushConfigured(env), sent: 0, failed: 0 }
  if (!summary.configured) return summary

  const { results: subs } = await env.DB.prepare(
    `SELECT DISTINCT s.endpoint, s.p256dh, s.auth, s.lang
     FROM push_subscriptions s
     JOIN users u ON u.id = s.user_id AND u.is_active = 1
     WHERE ?1 = 1 OR s.user_id IN (SELECT user_id FROM user_brands WHERE brand_id = ?2)`
  ).bind(h.all_brands, h.brand_id).all<{ endpoint: string; p256dh: string; auth: string; lang: string }>()

  const outcomes = await Promise.all(
    subs.map(async (sub) => {
      const zh = sub.lang === 'zh'
      const title = (zh && h.title_zh) || h.title
      const detail = (zh && h.detail_zh) || h.detail
      const when = (zh && h.event_date_zh) || h.event_date
      const status = await sendPush(env, sub, {
        title: clip(`${h.brand} · ${title}`, 100),
        body: clip(`${when} — ${detail}`, 200),
        tag: `happening-${h.id}`,
        url: '/',
      })
      return { endpoint: sub.endpoint, status }
    })
  )

  const gone = outcomes.filter((o) => o.status === 'gone')
  if (gone.length) {
    await env.DB.batch(gone.map((o) => env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).bind(o.endpoint)))
  }
  summary.sent = outcomes.filter((o) => o.status === 'sent').length
  summary.failed = outcomes.length - summary.sent
  return summary
}
