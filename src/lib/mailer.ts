// Notification emails go through email_outbox so a slow/failed provider never blocks approvals.
// Provider is pluggable; with no provider key configured, mail stays 'pending' (nothing is sent).
export interface MailEnv {
  DB: D1Database
  RESEND_API_KEY?: string
  MAIL_FROM?: string
}

const MAX_ATTEMPTS = 3

export function enqueueEmail(db: D1Database, to: string, subject: string, body: string) {
  return db
    .prepare(`INSERT INTO email_outbox (to_email, subject, body) VALUES (?, ?, ?)`)
    .bind(to, subject, body)
}

async function send(env: MailEnv, to: string, subject: string, body: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text: body }),
  })
  if (!res.ok) throw new Error(`mail provider ${res.status}`)
}

export async function flushOutbox(env: MailEnv): Promise<void> {
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) return
  const { results } = await env.DB.prepare(
    `SELECT id, to_email, subject, body FROM email_outbox WHERE status = 'pending' AND attempts < ? ORDER BY id LIMIT 20`
  )
    .bind(MAX_ATTEMPTS)
    .all<{ id: number; to_email: string; subject: string; body: string }>()
  for (const m of results) {
    try {
      await send(env, m.to_email, m.subject, m.body)
      await env.DB.prepare(`UPDATE email_outbox SET status='sent', sent_at=datetime('now'), attempts=attempts+1 WHERE id=?`)
        .bind(m.id)
        .run()
    } catch (err) {
      await env.DB.prepare(
        `UPDATE email_outbox SET attempts=attempts+1, last_error=?, status=CASE WHEN attempts+1 >= ? THEN 'failed' ELSE 'pending' END WHERE id=?`
      )
        .bind((err as Error).message, MAX_ATTEMPTS, m.id)
        .run()
    }
  }
}
