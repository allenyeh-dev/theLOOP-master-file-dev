import { pushConfigured, sendPush, type PushEnv } from './webpush'

export const SERVICE_TIERS = ['T1', 'T2', 'T3']
export const MIN_TIER_VALUES = [...SERVICE_TIERS, 'off']
// Alerts notify the owners of the business: Admin and Executive accounts.
export const NOTIFY_ROLE_KEYS = ['admin', 'executive']

export async function minServiceTier(db: D1Database): Promise<string> {
  const row = await db.prepare(`SELECT value FROM app_settings WHERE key = 'service_alert_min_tier'`).first<{ value: string }>()
  return row && MIN_TIER_VALUES.includes(row.value) ? row.value : 'T3'
}

export const tierNotifies = (tier: string, min: string) =>
  min !== 'off' && SERVICE_TIERS.indexOf(tier) >= SERVICE_TIERS.indexOf(min)

// OS push to every device of the active Admin / Executive accounts. Best effort: never throws.
export async function pushToOwners(env: { DB: D1Database } & PushEnv, payload: { title: string; body: string; tag: string }) {
  if (!pushConfigured(env)) return
  try {
    const { results: subs } = await env.DB.prepare(
      `SELECT s.endpoint, s.p256dh, s.auth FROM push_subscriptions s
       JOIN users u ON u.id = s.user_id AND u.is_active = 1
       JOIN roles r ON r.id = u.role_id
       WHERE r.key IN (${NOTIFY_ROLE_KEYS.map(() => '?').join(',')})`
    ).bind(...NOTIFY_ROLE_KEYS).all<{ endpoint: string; p256dh: string; auth: string }>()
    const outcomes = await Promise.all(subs.map(async (s) => ({ endpoint: s.endpoint, status: await sendPush(env, s, { ...payload, url: '/' }) })))
    const gone = outcomes.filter((o) => o.status === 'gone')
    if (gone.length) await env.DB.batch(gone.map((o) => env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).bind(o.endpoint)))
  } catch {
    // notification failure must never fail the alert itself
  }
}
