import { Hono } from 'hono'
import { requireAuth, requirePermission, CONSOLE_ROLE_KEYS } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'
import { validBrandIds } from '../lib/brands'
import { asLang, missingFields, normalizeContent, type Lang } from '../lib/sop-content'
import { AiUnavailableError, checkContent, structureText, translateContent, type AiEnv } from '../lib/sop-ai'
import { enqueueEmail, flushOutbox, type MailEnv } from '../lib/mailer'

type Bindings = MailEnv & AiEnv
type Variables = { user: AuthUser }

export const sopRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()
sopRoutes.use('*', requireAuth)

// Messages are [zh, en] pairs picked by the X-Lang request header; plain strings are sent as-is.
const reqLang = (c: any): Lang => (c.req.header('x-lang') === 'en' ? 'en' : 'zh')
const fail = (c: any, msg: string | [string, string], status = 400) =>
  c.json({ success: false, error: typeof msg === 'string' ? msg : msg[reqLang(c) === 'en' ? 1 : 0] }, status)
const bi = (zh: string, en: string): [string, string] => [zh, en]
const parseId = (v: string) => (/^\d+$/.test(v) ? Number(v) : null)
const isAdmin = (u: AuthUser) => CONSOLE_ROLE_KEYS.includes(u.role.key)
// Editors cannot approve a version they edited/submitted — except admin/ownership on the step assigned to the
// admin role, so an admin-edited SOP can still be completed (they still cannot sign the manager/GM steps).
const selfOk = (u: AuthUser, editorId: number, stepRoleKey?: string) =>
  editorId !== u.id || (isAdmin(u) && stepRoleKey === 'admin')

// ---------- categories (any submitter may add one) ----------
sopRoutes.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT id, label FROM sop_categories ORDER BY id`).all()
  return c.json({ success: true, categories: results })
})

sopRoutes.post('/categories', requirePermission('sop.submit'), async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const label = typeof body.label === 'string' ? body.label.trim() : ''
  if (!label || label.length > 30) return fail(c, bi('類別名稱需為 1–30 字', 'Category name must be 1–30 characters'))
  const user = c.get('user')
  await c.env.DB.prepare(`INSERT OR IGNORE INTO sop_categories (label, created_by) VALUES (?, ?)`)
    .bind(label, user.id)
    .run()
  const row = await c.env.DB.prepare(`SELECT id, label FROM sop_categories WHERE label = ?`).bind(label).first()
  return c.json({ success: true, category: row })
})

sopRoutes.get('/departments', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT id, key, label FROM sop_departments ORDER BY sort_order, id`).all()
  return c.json({ success: true, departments: results })
})

// Roles a SOP can be owned by (shown as a plain choice list in the wizard).
sopRoutes.get('/roles', async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT id, label FROM roles ORDER BY id`).all()
  return c.json({ success: true, roles: results })
})

// Flags raised on published SOPs; admin/ownership only.
sopRoutes.get('/flags', async (c) => {
  if (!isAdmin(c.get('user'))) return fail(c, 'Forbidden', 403)
  const { results } = await c.env.DB.prepare(
    `SELECT f.id, f.sop_id, f.reason, f.status, f.created_at, u.name AS flagged_by, v.title, s.code
     FROM sop_flags f JOIN sops s ON s.id = f.sop_id JOIN sop_versions v ON v.id = f.version_id
     JOIN users u ON u.id = f.user_id
     WHERE f.status = 'open' ORDER BY f.id DESC`
  ).all()
  return c.json({ success: true, flags: results })
})

sopRoutes.post('/flags/:id/resolve', async (c) => {
  if (!isAdmin(c.get('user'))) return fail(c, 'Forbidden', 403)
  const id = parseId(c.req.param('id') ?? '')
  if (!id) return fail(c, 'Invalid id')
  await c.env.DB.prepare(`UPDATE sop_flags SET status = 'resolved', resolved_by = ?, resolved_at = datetime('now') WHERE id = ? AND status = 'open'`)
    .bind(c.get('user').id, id).run()
  return c.json({ success: true })
})

// ---------- AI helpers (advisory only) ----------
sopRoutes.post('/ai/structure', requirePermission('sop.submit'), async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (text.length < 10) return fail(c, bi('請貼上多一點內容', 'Please paste more content'))
  try {
    return c.json({ success: true, ...(await structureText(c.env, text)) })
  } catch (err) {
    if (err instanceof AiUnavailableError) return fail(c, bi(err.zh, err.en), 503)
    return fail(c, (err as Error).message, 502)
  }
})

sopRoutes.post('/ai/check', requirePermission('sop.submit'), async (c) => {
  const body = await c.req.json().catch(() => ({}))
  try {
    return c.json({ success: true, review: await checkContent(c.env, normalizeContent(body.content), reqLang(c)) })
  } catch (err) {
    if (err instanceof AiUnavailableError) return fail(c, bi(err.zh, err.en), 503)
    return fail(c, (err as Error).message, 502)
  }
})

sopRoutes.post('/ai/translate', requirePermission('sop.submit'), async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const target = asLang(body.target)
  try {
    return c.json({ success: true, content: await translateContent(c.env, normalizeContent(body.content), target) })
  } catch (err) {
    if (err instanceof AiUnavailableError) return fail(c, bi(err.zh, err.en), 503)
    return fail(c, (err as Error).message, 502)
  }
})

// ---------- shared queries ----------
interface VersionRow {
  id: number
  sop_id: number
  version_no: number
  title: string
  content_json: string
  status: string
  submitted_by: number | null
  submitted_at: string | null
  published_at: string | null
  ai_review_json: string | null
  lang: Lang
  title_alt: string | null
  content_alt_json: string | null
  category_id: number | null
  category_label: string | null
  code: string | null
  department_id: number | null
  dept_key: string | null
  dept_label: string | null
  owner_role_id: number | null
  owner_label: string | null
  created_by: number
  author_name: string
  editor_id: number
  editor_name: string
  published_version_id: number | null
}

// The version a SOP is "showing": its latest version overall.
const LATEST_SELECT = `
  SELECT v.id, v.sop_id, v.version_no, v.title, v.content_json, v.status, v.submitted_by, v.submitted_at,
         v.published_at, v.ai_review_json, v.lang, v.title_alt, v.content_alt_json, s.category_id, c.label AS category_label, s.created_by,
         u.name AS author_name, s.published_version_id, s.code, s.department_id, d.key AS dept_key,
         d.label AS dept_label, s.owner_role_id, orl.label AS owner_label,
         COALESCE(v.edited_by, s.created_by) AS editor_id, eu.name AS editor_name
  FROM sop_versions v
  JOIN sops s ON s.id = v.sop_id
  LEFT JOIN sop_categories c ON c.id = s.category_id
  LEFT JOIN sop_departments d ON d.id = s.department_id
  LEFT JOIN roles orl ON orl.id = s.owner_role_id
  JOIN users u ON u.id = s.created_by
  JOIN users eu ON eu.id = COALESCE(v.edited_by, s.created_by)
`

// Department scoping: roles with sop.view_all see everything; everyone else sees SOPs of their own
// departments plus general ones (no department, or a department flagged is_general).
const deptVisible = (u: AuthUser) =>
  u.permissions.includes('sop.view_all')
    ? { sql: '1=1', binds: [] as number[] }
    : {
        sql: `(s.department_id IS NULL
          OR EXISTS (SELECT 1 FROM sop_departments dd WHERE dd.id = s.department_id AND dd.is_general = 1)
          OR EXISTS (SELECT 1 FROM user_departments ud WHERE ud.user_id = ? AND ud.department_id = s.department_id))`,
        binds: [u.id],
      }

async function deptAllowed(db: D1Database, u: AuthUser, departmentId: number | null) {
  if (u.permissions.includes('sop.view_all') || !departmentId) return true
  if (u.departments.some((d) => d.id === departmentId)) return true
  const g = await db.prepare(`SELECT 1 AS ok FROM sop_departments WHERE id = ? AND is_general = 1`).bind(departmentId).first()
  return Boolean(g)
}

const brandVisible = `(
  NOT EXISTS (SELECT 1 FROM sop_brands sb WHERE sb.sop_id = s.id)
  OR EXISTS (SELECT 1 FROM sop_brands sb JOIN user_brands ub ON ub.brand_id = sb.brand_id
             WHERE sb.sop_id = s.id AND ub.user_id = ?)
)`

// Pending steps this user may act on: first undecided step of an in_review version, role matches
// (admins may act on any step) and the user shares a brand with the SOP.
const actionable = (adminAny: boolean) => `
  v.status = 'in_review'
  AND a.step_no = (SELECT MIN(a2.step_no) FROM sop_approvals a2 WHERE a2.version_id = v.id AND a2.decision IS NULL)
  AND a.decision IS NULL
  AND ${adminAny ? '1=1' : 'a.role_id = ?'}
  AND ${brandVisible}
  AND ${adminAny ? "(COALESCE(v.edited_by, s.created_by) != ? OR a.role_id = (SELECT id FROM roles WHERE key = 'admin'))" : 'COALESCE(v.edited_by, s.created_by) != ?'}`

function hydrate(r: VersionRow) {
  const { content_json, ai_review_json, content_alt_json, ...rest } = r
  return {
    ...rest,
    content: JSON.parse(content_json || '{}'),
    content_alt: content_alt_json ? JSON.parse(content_alt_json) : null,
    ai_review: ai_review_json ? JSON.parse(ai_review_json) : null,
  }
}

// Which of these versions has the user already marked as read?
async function readSet(db: D1Database, userId: number, versionIds: number[]) {
  if (versionIds.length === 0) return new Set<number>()
  const { results } = await db
    .prepare(`SELECT version_id FROM sop_reads WHERE user_id = ? AND version_id IN (${versionIds.map(() => '?').join(',')})`)
    .bind(userId, ...versionIds)
    .all<{ version_id: number }>()
  return new Set(results.map((r) => r.version_id))
}

async function brandsOf(db: D1Database, sopIds: number[]) {
  if (sopIds.length === 0) return new Map<number, { id: number; label: string; key: string; code: string | null }[]>()
  const { results } = await db
    .prepare(
      `SELECT sb.sop_id, b.id, b.label, b.key, b.code FROM sop_brands sb JOIN brands b ON b.id = sb.brand_id
       WHERE sb.sop_id IN (${sopIds.map(() => '?').join(',')}) ORDER BY b.sort_order`
    )
    .bind(...sopIds)
    .all<{ sop_id: number; id: number; label: string; key: string; code: string | null }>()
  const m = new Map<number, { id: number; label: string; key: string; code: string | null }[]>()
  for (const r of results) m.set(r.sop_id, [...(m.get(r.sop_id) ?? []), { id: r.id, label: r.label, key: r.key, code: r.code }])
  return m
}

// ---------- list ----------
// scope=published (default) | mine | pending
sopRoutes.get('/', async (c) => {
  const user = c.get('user')
  const scope = c.req.query('scope') ?? 'published'
  let rows: VersionRow[]

  if (scope === 'mine') {
    const r = await c.env.DB.prepare(
      `${LATEST_SELECT}
       WHERE (s.created_by = ? OR COALESCE(v.edited_by, s.created_by) = ?)
         AND v.version_no = (SELECT MAX(version_no) FROM sop_versions WHERE sop_id = s.id)
       ORDER BY v.id DESC`
    ).bind(user.id, user.id).all<VersionRow>()
    rows = r.results
  } else if (scope === 'pending') {
    if (!user.permissions.includes('sop.approve')) return fail(c, 'Forbidden', 403)
    const admin = isAdmin(user)
    const binds = admin ? [user.id, user.id] : [user.role.id, user.id, user.id]
    const r = await c.env.DB.prepare(
      `${LATEST_SELECT}
       JOIN sop_approvals a ON a.version_id = v.id
       WHERE ${actionable(admin)} AND ${deptVisible(user).sql}
       ORDER BY v.submitted_at`
    ).bind(...binds, ...deptVisible(user).binds).all<VersionRow>()
    rows = r.results
  } else {
    const r = await c.env.DB.prepare(
      `${LATEST_SELECT}
       WHERE v.id = s.published_version_id AND ${brandVisible} AND ${deptVisible(user).sql}
       ORDER BY v.published_at DESC`
    ).bind(user.id, ...deptVisible(user).binds).all<VersionRow>()
    rows = r.results
  }

  const brands = await brandsOf(c.env.DB, rows.map((r) => r.sop_id))
  const reads = await readSet(c.env.DB, user.id, rows.map((r) => r.id))
  return c.json({
    success: true,
    sops: rows.map((r) => ({ ...hydrate(r), brands: brands.get(r.sop_id) ?? [], is_read: reads.has(r.id) })),
  })
})

// ---------- detail ----------
async function loadSop(c: any, sopId: number) {
  const user: AuthUser = c.get('user')
  const row = await c.env.DB.prepare(
    `${LATEST_SELECT} WHERE s.id = ? ORDER BY v.version_no DESC LIMIT 1`
  ).bind(sopId).first() as VersionRow | null
  if (!row) return null
  const brands = (await brandsOf(c.env.DB, [sopId])).get(sopId) ?? []
  const { results: approvals } = await c.env.DB.prepare(
    `SELECT a.step_no, a.role_id, r.key AS role_key, r.label AS role_label, a.decision, a.comment, a.decided_at, u.name AS approver_name
     FROM sop_approvals a JOIN roles r ON r.id = a.role_id LEFT JOIN users u ON u.id = a.approver_id
     WHERE a.version_id = ? ORDER BY a.step_no`
  ).bind(row.id).all()

  const inBrand = brands.length === 0 || brands.some((b) => user.brands.some((ub) => ub.id === b.id))
  const isOwner = row.created_by === user.id
  const isEditor = row.editor_id === user.id
  const deptOk = await deptAllowed(c.env.DB, user, row.department_id)
  const canSeeLatest = isOwner || isEditor || isAdmin(user) || (user.permissions.includes('sop.approve') && inBrand && deptOk)
  // Anyone who can see a SOP may edit it (a published SOP gets a new version; the live one stays until approval).
  // A SOP that was never published is still a private draft: only its author/editor (or an admin) may touch it.
  const everPublished = row.published_version_id != null
  const canEdit =
    user.permissions.includes('sop.submit') &&
    row.status !== 'in_review' &&
    (everPublished ? (inBrand || isAdmin(user)) && deptOk : isOwner || isEditor || isAdmin(user))
  return { row, brands, approvals, inBrand, isOwner, isEditor, canSeeLatest, canEdit, deptOk }
}

sopRoutes.get('/:id', async (c) => {
  const id = parseId(c.req.param('id') ?? '')
  if (!id) return fail(c, 'Invalid id')
  const user = c.get('user')
  const found = await loadSop(c, id)
  if (!found) return fail(c, 'Not found', 404)
  let { row } = found

  if (!found.canSeeLatest) {
    // Everyone else only sees the currently published version, within their brands.
    if (!row.published_version_id || !found.inBrand || !found.deptOk) return fail(c, 'Not found', 404)
    if (row.id !== row.published_version_id) {
      const pub = await c.env.DB.prepare(`${LATEST_SELECT} WHERE v.id = ?`).bind(row.published_version_id).first<VersionRow>()
      if (!pub) return fail(c, 'Not found', 404)
      row = pub
    }
  }

  const step = found.approvals.find((a: any) => a.decision === null)
  const canAct =
    row.status === 'in_review' &&
    user.permissions.includes('sop.approve') &&
    selfOk(user, row.editor_id, step?.role_key) &&
    found.inBrand &&
    !!step &&
    (isAdmin(user) || step.role_id === user.role.id)

  const isPublished = row.status === 'published'
  const reads = isPublished ? await readSet(c.env.DB, user.id, [row.id]) : new Set<number>()
  const flagCount = isAdmin(user)
    ? ((await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM sop_flags WHERE sop_id = ? AND status = 'open'`).bind(id).first()) as { n: number }).n
    : 0

  return c.json({
    success: true,
    sop: {
      ...hydrate(row),
      brands: found.brands,
      is_read: reads.has(row.id),
      can_read: isPublished,
      flag_count: flagCount,
      approvals: row.id === found.row.id ? found.approvals : [],
      can_act: canAct,
      can_edit: found.canEdit,
      latest_status: found.row.status,
    },
  })
})

// What the edit page loads: the latest draft/rejected version, or (for a published SOP) the published
// version as the starting point of a new one. Sop-level fields are locked once a SOP has been published,
// so an unapproved edit can never change who sees the live version.
sopRoutes.get('/:id/edit', requirePermission('sop.submit'), async (c) => {
  const id = parseId(c.req.param('id') ?? '')
  if (!id) return fail(c, 'Invalid id')
  const found = await loadSop(c, id)
  if (!found) return fail(c, 'Not found', 404)
  if (found.row.status === 'in_review') return fail(c, bi('新版本簽核中，暫時不能修改', 'A new version is awaiting approval and cannot be edited right now'), 409)
  if (!found.canEdit) return fail(c, 'Not found', 404)
  return c.json({
    success: true,
    sop: {
      ...hydrate(found.row),
      brands: found.brands,
      mode: found.row.status === 'published' ? 'revise' : 'draft',
      meta_locked: found.row.published_version_id != null,
    },
  })
})

// ---------- create / edit draft ----------
async function parseSopBody(c: any) {
  const body = await c.req.json().catch(() => ({}))
  const content = normalizeContent(body.content)
  const lang = asLang(body.lang)
  const alt = body.content_alt ? normalizeContent(body.content_alt) : null
  let brandIds: number[] = []
  if (Array.isArray(body.brand_ids) && body.brand_ids.length > 0) {
    const ok = await validBrandIds(c.env.DB, body.brand_ids)
    if (!ok) return { error: bi('品牌不正確', 'Invalid brand') }
    brandIds = ok
  }
  let categoryId: number | null = null
  if (body.category_id != null) {
    const cat = await c.env.DB.prepare(`SELECT id FROM sop_categories WHERE id = ?`).bind(body.category_id).first()
    if (!cat) return { error: bi('類別不存在', 'Category not found') }
    categoryId = body.category_id
  }
  let departmentId: number | null = null
  if (body.department_id != null) {
    const d = await c.env.DB.prepare(`SELECT id FROM sop_departments WHERE id = ?`).bind(body.department_id).first()
    if (!d) return { error: bi('部門不存在', 'Department not found') }
    departmentId = body.department_id
  }
  let ownerRoleId: number | null = null
  if (body.owner_role_id != null) {
    const r = await c.env.DB.prepare(`SELECT id FROM roles WHERE id = ?`).bind(body.owner_role_id).first()
    if (!r) return { error: bi('負責角色不存在', 'Owner role not found') }
    ownerRoleId = body.owner_role_id
  }
  return { content, lang, alt, brandIds, categoryId, departmentId, ownerRoleId }
}

sopRoutes.post('/', requirePermission('sop.submit'), async (c) => {
  const user = c.get('user')
  const p = await parseSopBody(c)
  if ('error' in p) return fail(c, p.error as [string, string])

  const sop = await c.env.DB.prepare(`INSERT INTO sops (category_id, department_id, owner_role_id, created_by) VALUES (?, ?, ?, ?) RETURNING id`)
    .bind(p.categoryId, p.departmentId, p.ownerRoleId, user.id)
    .first<{ id: number }>()
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO sop_versions (sop_id, version_no, title, content_json, lang, title_alt, content_alt_json, edited_by) VALUES (?, 1, ?, ?, ?, ?, ?, ?)`)
      .bind(sop!.id, p.content.title, JSON.stringify(p.content), p.lang, p.alt?.title ?? null, p.alt ? JSON.stringify(p.alt) : null, user.id),
    ...p.brandIds.map((b) => c.env.DB.prepare(`INSERT INTO sop_brands (sop_id, brand_id) VALUES (?, ?)`).bind(sop!.id, b)),
  ])
  return c.json({ success: true, id: sop!.id })
})

sopRoutes.put('/:id', requirePermission('sop.submit'), async (c) => {
  const id = parseId(c.req.param('id') ?? '')
  if (!id) return fail(c, 'Invalid id')
  const user = c.get('user')
  const found = await loadSop(c, id)
  if (!found) return fail(c, 'Not found', 404)
  if (found.row.status === 'in_review') return fail(c, bi('目前狀態不能修改', 'This SOP can no longer be edited'), 409)
  if (!found.canEdit) return fail(c, 'Not found', 404)
  const p = await parseSopBody(c)
  if ('error' in p) return fail(c, p.error as [string, string])
  const { row } = found
  const metaLocked = row.published_version_id != null

  // Published SOP: the edit becomes a new draft version; the live one stays until the new one is approved.
  if (row.status === 'published') {
    try {
      await c.env.DB.prepare(
        `INSERT INTO sop_versions (sop_id, version_no, title, content_json, lang, title_alt, content_alt_json, edited_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, row.version_no + 1, p.content.title, JSON.stringify(p.content), p.lang, p.alt?.title ?? null, p.alt ? JSON.stringify(p.alt) : null, user.id).run()
    } catch {
      return fail(c, bi('已有人正在修改這份 SOP，請重新整理', 'Someone else just started editing this SOP — please reload'), 409)
    }
    return c.json({ success: true, id })
  }

  await c.env.DB.batch([
    ...(metaLocked
      ? []
      : [
          c.env.DB.prepare(`UPDATE sops SET category_id = ?, department_id = ?, owner_role_id = ? WHERE id = ?`).bind(p.categoryId, p.departmentId, p.ownerRoleId, id),
          c.env.DB.prepare(`DELETE FROM sop_brands WHERE sop_id = ?`).bind(id),
          ...p.brandIds.map((b) => c.env.DB.prepare(`INSERT INTO sop_brands (sop_id, brand_id) VALUES (?, ?)`).bind(id, b)),
        ]),
    c.env.DB.prepare(`UPDATE sop_versions SET title = ?, content_json = ?, lang = ?, title_alt = ?, content_alt_json = ?, status = 'draft', ai_review_json = NULL, edited_by = ? WHERE id = ?`)
      .bind(p.content.title, JSON.stringify(p.content), p.lang, p.alt?.title ?? null, p.alt ? JSON.stringify(p.alt) : null, user.id, row.id),
    // A resubmitted rejected version starts a clean approval run.
    c.env.DB.prepare(`DELETE FROM sop_approvals WHERE version_id = ?`).bind(row.id),
  ])
  return c.json({ success: true, id })
})

// ---------- submit ----------
// Most specific chain wins: brand+category > brand > category > default.
async function resolveChain(db: D1Database, brandIds: number[], categoryId: number | null) {
  const brandClause = brandIds.length ? `(brand_id IN (${brandIds.map(() => '?').join(',')}))` : '0'
  const { results } = await db
    .prepare(
      `SELECT id,
         (CASE WHEN brand_id IS NOT NULL THEN 2 ELSE 0 END) + (CASE WHEN category_id IS NOT NULL THEN 1 ELSE 0 END) AS score
       FROM approval_chains
       WHERE (brand_id IS NULL OR ${brandClause})
         AND (category_id IS NULL OR category_id = ?)
       ORDER BY score DESC, id LIMIT 1`
    )
    .bind(...brandIds, categoryId ?? -1)
    .all<{ id: number }>()
  if (!results[0]) return []
  const { results: steps } = await db
    .prepare(`SELECT step_no, role_id FROM approval_chain_steps WHERE chain_id = ? ORDER BY step_no`)
    .bind(results[0].id)
    .all<{ step_no: number; role_id: number }>()
  return steps
}

async function approverEmails(db: D1Database, roleId: number, brandIds: number[], excludeUserId: number) {
  const brandSql = brandIds.length
    ? `AND EXISTS (SELECT 1 FROM user_brands ub WHERE ub.user_id = u.id AND ub.brand_id IN (${brandIds.map(() => '?').join(',')}))`
    : ''
  const { results } = await db
    .prepare(`SELECT u.email FROM users u WHERE u.role_id = ? AND u.is_active = 1 AND u.id != ? ${brandSql}`)
    .bind(roleId, excludeUserId, ...brandIds)
    .all<{ email: string }>()
  return results.map((r) => r.email)
}

sopRoutes.post('/:id/submit', requirePermission('sop.submit'), async (c) => {
  const id = parseId(c.req.param('id') ?? '')
  if (!id) return fail(c, 'Invalid id')
  const user = c.get('user')
  const found = await loadSop(c, id)
  if (!found || !found.canEdit) return fail(c, 'Not found', 404)
  const { row, brands } = found
  if (row.status !== 'draft') return fail(c, bi('目前狀態不能送出', 'This SOP cannot be submitted right now'), 409)

  const content = normalizeContent(JSON.parse(row.content_json))
  const missing = missingFields(content)
  if (!row.department_id) missing.push(['部門', 'department'])
  if (missing.length) return fail(c, bi(`還缺：${missing.map((m) => m[0]).join('、')}`, `Missing: ${missing.map((m) => m[1]).join(', ')}`))

  const brandIds = brands.map((b) => b.id)
  const steps = await resolveChain(c.env.DB, brandIds, row.category_id)
  if (steps.length === 0) return fail(c, bi('找不到簽核流程，請聯絡管理員', 'No approval chain found — contact an admin'), 409)

  // Optional AI review result from the wizard (stored for approvers; never gates submission).
  const body = await c.req.json().catch(() => ({}))
  const aiReview = body.ai_review && typeof body.ai_review === 'object' ? JSON.stringify(body.ai_review) : null

  const emails = await approverEmails(c.env.DB, steps[0].role_id, brandIds, user.id)
  // Owner defaults to the role of the last approval step.
  if (!row.owner_role_id) {
    await c.env.DB.prepare(`UPDATE sops SET owner_role_id = ? WHERE id = ?`).bind(steps[steps.length - 1].role_id, row.sop_id).run()
  }
  // Auto-translate into the other language when the author did not supply one. A missing/failed
  // translation never blocks submission; readers then see the original with a notice.
  let alt = row.content_alt_json ? normalizeContent(JSON.parse(row.content_alt_json)) : null
  if (!alt) {
    try {
      alt = await translateContent(c.env, content, row.lang === 'en' ? 'zh' : 'en')
    } catch {
      alt = null
    }
  }
  const guard = await c.env.DB.prepare(
    `UPDATE sop_versions SET status = 'in_review', submitted_by = ?, edited_by = ?, submitted_at = datetime('now'), ai_review_json = ?,
       title_alt = ?, content_alt_json = ?
     WHERE id = ? AND status = 'draft'`
  ).bind(user.id, user.id, aiReview, alt?.title ?? null, alt ? JSON.stringify(alt) : null, row.id).run()
  if (!guard.meta.changes) return fail(c, bi('目前狀態不能送出', 'This SOP cannot be submitted right now'), 409)

  await c.env.DB.batch([
    ...steps.map((s) =>
      c.env.DB.prepare(`INSERT OR REPLACE INTO sop_approvals (version_id, step_no, role_id) VALUES (?, ?, ?)`).bind(row.id, s.step_no, s.role_id)
    ),
    ...emails.map((to) =>
      enqueueEmail(c.env.DB, to, `[THE LOOP] 待簽核 SOP / SOP awaiting approval: ${row.title}`, `${user.name} 送出了 SOP「${row.title}」，請登入系統簽核。\n${user.name} submitted the SOP "${row.title}". Please sign in to review it.`)
    ),
  ])
  c.executionCtx.waitUntil(flushOutbox(c.env))
  return c.json({ success: true, translated: Boolean(alt) })
})

// ---------- read receipts / flags ----------
const codePrefix = (brands: { key: string; code: string | null }[], deptKey: string | null) => {
  const b = brands.length === 1 ? (brands[0].code || brands[0].key.slice(0, 3)).toUpperCase() : 'ALL'
  return `${b}-${(deptKey || 'GEN').toUpperCase()}`
}

// The published version of a SOP the user may see (brand-scoped), or null.
async function visiblePublished(c: any, id: number) {
  const user: AuthUser = c.get('user')
  const row = (await c.env.DB.prepare(
    `${LATEST_SELECT} WHERE s.id = ? AND v.id = s.published_version_id AND ${brandVisible} AND ${deptVisible(user).sql}`
  ).bind(id, user.id, ...deptVisible(user).binds).first()) as VersionRow | null
  return row
}

sopRoutes.post('/:id/read', async (c) => {
  const id = parseId(c.req.param('id') ?? '')
  if (!id) return fail(c, 'Invalid id')
  const row = await visiblePublished(c, id)
  if (!row) return fail(c, 'Not found', 404)
  await c.env.DB.prepare(`INSERT OR IGNORE INTO sop_reads (user_id, version_id) VALUES (?, ?)`).bind(c.get('user').id, row.id).run()
  return c.json({ success: true })
})

sopRoutes.post('/:id/flag', async (c) => {
  const id = parseId(c.req.param('id') ?? '')
  if (!id) return fail(c, 'Invalid id')
  const user = c.get('user')
  const row = await visiblePublished(c, id)
  if (!row) return fail(c, 'Not found', 404)
  const body = await c.req.json().catch(() => ({}))
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 1000) : ''
  if (!reason) return fail(c, bi('請寫下哪裡有問題', 'Please describe the problem'))

  const { results: admins } = await c.env.DB.prepare(
    `SELECT u.email FROM users u JOIN roles r ON r.id = u.role_id WHERE r.key IN ('admin', 'ownership') AND u.is_active = 1`
  ).all<{ email: string }>()
  const label = `${row.code ?? ''} ${row.title}`.trim()
  await c.env.DB.batch([
    c.env.DB.prepare(`INSERT INTO sop_flags (sop_id, version_id, user_id, reason) VALUES (?, ?, ?, ?)`).bind(id, row.id, user.id, reason),
    ...admins.map((a) =>
      enqueueEmail(c.env.DB, a.email, `[THE LOOP] SOP 被標記 / SOP flagged: ${label}`, `${user.name} 標記了 SOP「${label}」。\n原因：${reason}\n\n${user.name} flagged the SOP "${label}".\nReason: ${reason}`)
    ),
  ])
  c.executionCtx.waitUntil(flushOutbox(c.env))
  return c.json({ success: true })
})

// ---------- decide ----------
async function decide(c: any, decision: 'approved' | 'rejected') {
  const id = parseId(c.req.param('id') ?? '')
  if (!id) return fail(c, 'Invalid id')
  const user: AuthUser = c.get('user')
  const body = await c.req.json().catch(() => ({}))
  const comment = typeof body.comment === 'string' ? body.comment.trim().slice(0, 1000) : ''
  if (decision === 'rejected' && !comment) return fail(c, bi('退回請寫原因', 'Please give a reason for rejecting'))

  const found = await loadSop(c, id)
  if (!found) return fail(c, 'Not found', 404)
  const { row, brands, approvals } = found
  const step = approvals.find((a: any) => a.decision === null)
  const allowed =
    row.status === 'in_review' && step && found.inBrand && selfOk(user, row.editor_id, step.role_key) &&
    (isAdmin(user) || step.role_id === user.role.id)
  if (!allowed) return fail(c, bi('你現在不能簽核這份 SOP', 'You cannot approve this SOP right now'), 403)

  // Conditional update guards against two approvers racing on the same step.
  const upd = await c.env.DB.prepare(
    `UPDATE sop_approvals SET decision = ?, comment = ?, approver_id = ?, decided_at = datetime('now')
     WHERE version_id = ? AND step_no = ? AND decision IS NULL`
  ).bind(decision, comment || null, user.id, row.id, step.step_no).run()
  if (!upd.meta.changes) return fail(c, bi('這一關已被處理', 'This step was already handled'), 409)

  const author = (await c.env.DB.prepare(`SELECT email FROM users WHERE id = ?`).bind(row.editor_id).first()) as { email: string } | null
  const mails: D1PreparedStatement[] = []
  const stmts: D1PreparedStatement[] = []
  const notify = (to: string | undefined, subject: string, text: string) => {
    if (to) mails.push(enqueueEmail(c.env.DB, to, subject, text))
  }

  if (decision === 'rejected') {
    stmts.push(c.env.DB.prepare(`UPDATE sop_versions SET status = 'rejected' WHERE id = ?`).bind(row.id))
    notify(author?.email, `[THE LOOP] SOP 被退回 / SOP rejected: ${row.title}`, `${user.name} 退回了你的 SOP「${row.title}」。\n原因：${comment}\n\n${user.name} rejected your SOP "${row.title}".\nReason: ${comment}`)
  } else {
    const next = approvals.find((a: any) => a.decision === null && a.step_no > step.step_no)
    if (next) {
      const emails = await approverEmails(c.env.DB, next.role_id, brands.map((b: any) => b.id), row.editor_id)
      emails.forEach((to) => notify(to, `[THE LOOP] 待簽核 SOP / SOP awaiting approval: ${row.title}`, `SOP「${row.title}」已通過上一關，請登入系統簽核。\nThe SOP "${row.title}" passed the previous step. Please sign in to review it.`))
    } else {
      stmts.push(
        c.env.DB.prepare(`UPDATE sop_versions SET status = 'superseded' WHERE sop_id = ? AND status = 'published'`).bind(row.sop_id),
        c.env.DB.prepare(`UPDATE sop_versions SET status = 'published', published_at = datetime('now') WHERE id = ?`).bind(row.id),
        c.env.DB.prepare(`UPDATE sops SET published_version_id = ? WHERE id = ?`).bind(row.id, row.sop_id),
        // First publish only: SF-BOH-002 style code (brand code or ALL, department, running number).
        c.env.DB.prepare(
          `UPDATE sops SET code_prefix = ?1,
             code_seq = (SELECT COALESCE(MAX(code_seq), 0) + 1 FROM sops WHERE code_prefix = ?1),
             code = ?1 || '-' || printf('%03d', (SELECT COALESCE(MAX(code_seq), 0) + 1 FROM sops WHERE code_prefix = ?1))
           WHERE id = ?2 AND code IS NULL`
        ).bind(codePrefix(brands, row.dept_key), row.sop_id)
      )
      notify(author?.email, `[THE LOOP] SOP 已發布 / SOP published: ${row.title}`, `你的 SOP「${row.title}」已全部通過並發布。\nYour SOP "${row.title}" was fully approved and published.`)
    }
  }
  if (stmts.length || mails.length) await c.env.DB.batch([...stmts, ...mails])
  c.executionCtx.waitUntil(flushOutbox(c.env))
  return c.json({ success: true })
}

sopRoutes.post('/:id/approve', requirePermission('sop.approve'), (c) => decide(c, 'approved'))
sopRoutes.post('/:id/reject', requirePermission('sop.approve'), (c) => decide(c, 'rejected'))
