import { Hono } from 'hono'
import { asLang, missingFields, normalizeContent } from '../lib/sop-content'
import { AiUnavailableError, translateContent, type AiEnv } from '../lib/sop-ai'
import { publishStatements } from './sops'

// Public SOP ingestion API for external AI agents. No login session: the spec is readable by anyone,
// writing requires `Authorization: Bearer <SOP_INGEST_KEY>` (a Worker secret). Fails closed when the
// secret is not configured. By default a SOP lands as a DRAFT for an admin to review; `publish: true`
// publishes it immediately (same as the admin upload path).
type Bindings = AiEnv & { DB: D1Database; SOP_INGEST_KEY?: string; SOP_INGEST_USER_ID?: string }

export const publicSopRoutes = new Hono<{ Bindings: Bindings }>()

const err = (c: any, error: string, status = 400, extra: Record<string, unknown> = {}) =>
  c.json({ success: false, error, ...extra }, status)

// Constant-time-ish comparison so the key cannot be probed byte by byte.
function sameKey(a: string, b: string) {
  const ea = new TextEncoder().encode(a)
  const eb = new TextEncoder().encode(b)
  let diff = ea.length ^ eb.length
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0)
  return diff === 0
}

async function reference(db: D1Database) {
  const [brands, departments, categories] = await Promise.all([
    db.prepare(`SELECT key, label, code FROM brands ORDER BY sort_order, id`).all(),
    db.prepare(`SELECT key, label FROM sop_departments ORDER BY sort_order, id`).all(),
    db.prepare(`SELECT label FROM sop_categories ORDER BY id`).all(),
  ])
  return { brands: brands.results, departments: departments.results, categories: categories.results }
}

const SPEC = {
  endpoint: 'POST /api/public/sops',
  auth: 'Authorization: Bearer <SOP_INGEST_KEY>',
  content_type: 'application/json',
  body: {
    lang: "'zh' | 'en' — language `content` is written in (required)",
    content: {
      title: 'string, required, ≤120 chars',
      purpose: 'string, required, ≤4000 chars',
      audience: 'string, ≤200 chars — role(s) this applies to',
      tools: 'string — tools / ingredients needed, "" if none',
      standards: 'string[] — one key standard per item, no bullet characters, ≤50 items',
      steps: '{ action: string (required, ≤4000), caution: string (≤1000, "" if none) }[] — at least 1, ≤100, in order',
      mistakes: 'string — common mistakes, "" if none',
      notes: 'string — anything unclear / NEEDS CONFIRMATION, "" if none',
      effective_date: 'string, e.g. "2026-06" (optional)',
    },
    content_alt: 'optional — same shape as `content`, in the OTHER language. Step count must match. If omitted, a translation is drafted automatically when possible.',
    brands: "string[] of brand `key`s (see `reference.brands`), or [] / omitted for company-wide",
    department: 'string, required — a department `key` or `label` (see `reference.departments`)',
    category: 'string, optional — category label; created if it does not exist',
    publish: 'boolean, default false. false = saved as a draft for admin review; true = published immediately',
  },
  response: '{ success: true, id: number, status: "draft" | "published", code: string | null, translated: boolean }',
  errors: '400 invalid/missing fields (message lists them) · 401 missing/invalid key · 503 ingestion not configured',
  not_supported: 'Step images are not accepted by this endpoint.',
}

publicSopRoutes.get('/spec', async (c) => c.json({ success: true, spec: SPEC, reference: await reference(c.env.DB) }))

publicSopRoutes.post('/', async (c) => {
  const configured = c.env.SOP_INGEST_KEY
  if (!configured) return err(c, 'SOP ingestion is not configured', 503)
  const m = /^Bearer (.+)$/.exec(c.req.header('authorization') ?? '')
  if (!m || !sameKey(m[1], configured)) return err(c, 'Invalid or missing API key', 401)

  const body = await c.req.json().catch(() => null)
  if (!body || typeof body !== 'object') return err(c, 'Body must be a JSON object')

  const lang = asLang(body.lang)
  const content = normalizeContent(body.content)
  const alt = body.content_alt ? normalizeContent(body.content_alt) : null
  const problems = missingFields(content).map((p) => p[1])
  if (alt && alt.steps.length !== content.steps.length) problems.push('content_alt.steps count must match content.steps')

  const db = c.env.DB

  // department
  const deptName = typeof body.department === 'string' ? body.department.trim() : ''
  const dept = deptName
    ? await db.prepare(`SELECT id, key FROM sop_departments WHERE lower(key) = lower(?1) OR lower(label) = lower(?1)`).bind(deptName).first<{ id: number; key: string }>()
    : null
  if (!dept) problems.push(deptName ? `unknown department "${deptName}"` : 'department')

  // brands (keys). Unknown key is an error rather than silently widening a SOP to company-wide.
  const brandKeys: string[] = Array.isArray(body.brands) ? body.brands.filter((k: unknown): k is string => typeof k === 'string') : []
  let brands: { id: number; key: string; code: string | null }[] = []
  if (brandKeys.length) {
    const { results } = await db
      .prepare(`SELECT id, key, code FROM brands WHERE lower(key) IN (${brandKeys.map(() => '?').join(',')})`)
      .bind(...brandKeys.map((k) => k.toLowerCase()))
      .all<{ id: number; key: string; code: string | null }>()
    const found = new Set(results.map((r) => r.key.toLowerCase()))
    for (const k of brandKeys) if (!found.has(k.toLowerCase())) problems.push(`unknown brand "${k}"`)
    brands = results
  }

  if (problems.length) return err(c, `Invalid: ${problems.join('; ')}`, 400)

  // The SOP needs an owner row; use the configured user, else the first active admin.
  const owner = c.env.SOP_INGEST_USER_ID && /^\d+$/.test(c.env.SOP_INGEST_USER_ID)
    ? await db.prepare(`SELECT id FROM users WHERE id = ? AND is_active = 1`).bind(Number(c.env.SOP_INGEST_USER_ID)).first<{ id: number }>()
    : await db.prepare(`SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.key = 'admin' AND u.is_active = 1 ORDER BY u.id LIMIT 1`).first<{ id: number }>()
  if (!owner) return err(c, 'No active admin account to own the SOP', 503)

  let categoryId: number | null = null
  const catLabel = typeof body.category === 'string' ? body.category.trim().slice(0, 30) : ''
  if (catLabel) {
    await db.prepare(`INSERT OR IGNORE INTO sop_categories (label, created_by) VALUES (?, ?)`).bind(catLabel, owner.id).run()
    categoryId = (await db.prepare(`SELECT id FROM sop_categories WHERE label = ?`).bind(catLabel).first<{ id: number }>())!.id
  }

  const publish = body.publish === true
  let finalAlt = alt
  if (publish && !finalAlt) {
    try {
      finalAlt = await translateContent(c.env, content, lang === 'en' ? 'zh' : 'en')
    } catch (e) {
      if (!(e instanceof AiUnavailableError)) console.error('sop ingest translate failed', e)
    }
  }

  const sop = await db
    .prepare(`INSERT INTO sops (category_id, department_id, created_by) VALUES (?, ?, ?) RETURNING id`)
    .bind(categoryId, dept!.id, owner.id)
    .first<{ id: number }>()
  const version = await db
    .prepare(
      `INSERT INTO sop_versions (sop_id, version_no, title, content_json, lang, title_alt, content_alt_json, edited_by, submitted_by, submitted_at)
       VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ${publish ? "datetime('now')" : 'NULL'}) RETURNING id`
    )
    .bind(sop!.id, content.title, JSON.stringify(content), lang, finalAlt?.title ?? null, finalAlt ? JSON.stringify(finalAlt) : null, owner.id, publish ? owner.id : null)
    .first<{ id: number }>()
  const stmts = [
    ...brands.map((b) => db.prepare(`INSERT INTO sop_brands (sop_id, brand_id) VALUES (?, ?)`).bind(sop!.id, b.id)),
    ...(publish ? publishStatements(db, { id: version!.id, sop_id: sop!.id, dept_key: dept!.key } as any, brands) : []),
  ]
  if (stmts.length) await db.batch(stmts as [D1PreparedStatement, ...D1PreparedStatement[]])

  const row = await db.prepare(`SELECT code FROM sops WHERE id = ?`).bind(sop!.id).first<{ code: string | null }>()
  return c.json({ success: true, id: sop!.id, status: publish ? 'published' : 'draft', code: row?.code ?? null, translated: Boolean(finalAlt) }, 201)
})
