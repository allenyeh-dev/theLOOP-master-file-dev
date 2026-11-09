import { Hono } from 'hono'
import { requireAuth, CONSOLE_ROLE_KEYS } from '../middleware/auth'
import type { AuthUser } from '../lib/auth-db'
import { asLang, type Lang } from '../lib/sop-content'
import { AiUnavailableError, type AiEnv } from '../lib/sop-ai'
import { missingRecipeFields, normalizeRecipe, type RecipeContent } from '../lib/recipe-content'
import { structureRecipe, translateRecipe } from '../lib/recipe-ai'

type Bindings = AiEnv & { DB: D1Database }
type Variables = { user: AuthUser }

// Admins, and roles holding recipe.manage (RECIPES tab in the main app). Non-admins only see and edit recipes of
// brands they belong to; all-brand recipes are read-only for them.
export const recipeRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()
recipeRoutes.use('*', requireAuth, async (c, next) => {
  const u = c.get('user')
  if (!isAdmin(u) && !u.permissions.includes('recipe.manage')) return c.json({ success: false, error: 'Forbidden' }, 403)
  await next()
})

// Messages are [zh, en] pairs picked by the X-Lang request header.
const reqLang = (c: any): Lang => (c.req.header('x-lang') === 'en' ? 'en' : 'zh')
const fail = (c: any, msg: string | [string, string], status = 400) =>
  c.json({ success: false, error: typeof msg === 'string' ? msg : msg[reqLang(c) === 'en' ? 1 : 0] }, status)
const bi = (zh: string, en: string): [string, string] => [zh, en]
const isAdmin = (u: AuthUser) => CONSOLE_ROLE_KEYS.includes(u.role.key)
const canEditBrand = (u: AuthUser, brandId: number | null) =>
  isAdmin(u) || (brandId !== null && u.brands.some((b) => b.id === brandId))
const forbidden = bi('你沒有這個品牌的食譜權限', 'You do not have access to this brand’s recipes')
const parseId = (v: string) => (/^\d+$/.test(v) ? Number(v) : null)

interface RecipeRow {
  id: number
  code: string | null
  brand_id: number | null
  brand_label: string | null
  brand_code: string | null
  status: 'draft' | 'published'
  lang: Lang
  name: string
  content_json: string
  name_alt: string | null
  content_alt_json: string | null
  created_by: number
  updated_at: string
  published_at: string | null
  editor_name: string | null
}

const SELECT = `
  SELECT r.id, r.code, r.brand_id, b.label AS brand_label, b.code AS brand_code, r.status, r.lang, r.name, r.content_json,
         r.name_alt, r.content_alt_json, r.created_by, r.updated_at, r.published_at, u.name AS editor_name
  FROM recipes r
  LEFT JOIN brands b ON b.id = r.brand_id
  LEFT JOIN users u ON u.id = COALESCE(r.updated_by, r.created_by)
`

// Non-admins see recipes of their own brands plus all-brand ones.
const visible = (u: AuthUser) =>
  isAdmin(u)
    ? { sql: '1=1', binds: [] as number[] }
    : { sql: `(r.brand_id IS NULL OR EXISTS (SELECT 1 FROM user_brands ub WHERE ub.brand_id = r.brand_id AND ub.user_id = ?))`, binds: [u.id] }

function hydrate(r: RecipeRow, u: AuthUser) {
  const { content_json, content_alt_json, brand_code: _bc, ...rest } = r
  return {
    ...rest,
    can_edit: canEditBrand(u, r.brand_id),
    content: normalizeRecipe(JSON.parse(content_json || '{}')),
    content_alt: content_alt_json ? normalizeRecipe(JSON.parse(content_alt_json)) : null,
  }
}

// ---------- AI helper (advisory only) ----------
recipeRoutes.post('/ai/structure', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const text = typeof body.text === 'string' ? body.text.trim() : ''
  if (text.length < 10) return fail(c, bi('請貼上多一點內容', 'Please paste more content'))
  try {
    return c.json({ success: true, ...(await structureRecipe(c.env, text)) })
  } catch (err) {
    if (err instanceof AiUnavailableError) return fail(c, bi(err.zh, err.en), 503)
    return fail(c, (err as Error).message, 502)
  }
})

recipeRoutes.post('/ai/translate', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  try {
    return c.json({ success: true, content: await translateRecipe(c.env, normalizeRecipe(body.content), asLang(body.target)) })
  } catch (err) {
    if (err instanceof AiUnavailableError) return fail(c, bi(err.zh, err.en), 503)
    return fail(c, (err as Error).message, 502)
  }
})

// ---------- list / detail ----------
// Brands the caller may file a recipe under; only admins may pick "all brands".
recipeRoutes.get('/brands', async (c) => {
  const u = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT b.id, b.label FROM brands b
     WHERE ?1 = 1 OR EXISTS (SELECT 1 FROM user_brands ub WHERE ub.brand_id = b.id AND ub.user_id = ?2)
     ORDER BY b.sort_order, b.id`
  ).bind(isAdmin(u) ? 1 : 0, u.id).all()
  return c.json({ success: true, brands: results, can_all: isAdmin(u) })
})

recipeRoutes.get('/', async (c) => {
  const u = c.get('user')
  const v = visible(u)
  const { results } = await c.env.DB.prepare(`${SELECT} WHERE ${v.sql} ORDER BY r.id DESC`).bind(...v.binds).all<RecipeRow>()
  return c.json({ success: true, recipes: results.map((r) => hydrate(r, u)) })
})

recipeRoutes.get('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid id')
  const u = c.get('user')
  const v = visible(u)
  const row = await c.env.DB.prepare(`${SELECT} WHERE r.id = ? AND ${v.sql}`).bind(id, ...v.binds).first<RecipeRow>()
  if (!row) return fail(c, 'Not found', 404)
  return c.json({ success: true, recipe: hydrate(row, u) })
})

// ---------- create / update (always saves as a draft; publishing is a separate call) ----------
async function parseBody(c: any) {
  const body = await c.req.json().catch(() => ({}))
  const content = normalizeRecipe(body.content)
  const alt = body.content_alt ? normalizeRecipe(body.content_alt) : null
  let brandId: number | null = null
  if (body.brand_id != null) {
    const b = await c.env.DB.prepare(`SELECT id FROM brands WHERE id = ?`).bind(body.brand_id).first()
    if (!b) return { error: bi('品牌不正確', 'Invalid brand') }
    brandId = body.brand_id
  }
  const code = typeof body.code === 'string' ? body.code.trim().slice(0, 40) : ''
  return { content, alt, lang: asLang(body.lang), brandId, code: code || null }
}

const isDuplicateCode = (err: unknown) => /UNIQUE/i.test((err as Error)?.message ?? '')
const duplicateCode = bi('這個食譜編號已被使用', 'That recipe number is already in use')

recipeRoutes.post('/', async (c) => {
  const p = await parseBody(c)
  if ('error' in p) return fail(c, p.error as [string, string])
  if (!p.content.name) return fail(c, bi('請填寫品項名稱', 'Please enter the item name'))
  if (!canEditBrand(c.get('user'), p.brandId)) return fail(c, forbidden, 403)
  try {
    const row = await c.env.DB.prepare(
      `INSERT INTO recipes (code, brand_id, lang, name, content_json, name_alt, content_alt_json, created_by, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`
    )
      .bind(p.code, p.brandId, p.lang, p.content.name, JSON.stringify(p.content), p.alt?.name ?? null, p.alt ? JSON.stringify(p.alt) : null, c.get('user').id, c.get('user').id)
      .first<{ id: number }>()
    return c.json({ success: true, id: row!.id })
  } catch (err) {
    if (isDuplicateCode(err)) return fail(c, duplicateCode, 409)
    throw err
  }
})

recipeRoutes.put('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid id')
  const p = await parseBody(c)
  if ('error' in p) return fail(c, p.error as [string, string])
  if (!p.content.name) return fail(c, bi('請填寫品項名稱', 'Please enter the item name'))
  const u = c.get('user')
  const cur = await c.env.DB.prepare(`SELECT brand_id FROM recipes WHERE id = ?`).bind(id).first<{ brand_id: number | null }>()
  if (!cur) return fail(c, 'Not found', 404)
  // Both where it is now and where it is going must be the caller's brand.
  if (!canEditBrand(u, cur.brand_id) || !canEditBrand(u, p.brandId)) return fail(c, forbidden, 403)
  try {
    const res = await c.env.DB.prepare(
      `UPDATE recipes SET code = ?, brand_id = ?, lang = ?, name = ?, content_json = ?, name_alt = ?, content_alt_json = ?,
         status = 'draft', updated_by = ?, updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(p.code, p.brandId, p.lang, p.content.name, JSON.stringify(p.content), p.alt?.name ?? null, p.alt ? JSON.stringify(p.alt) : null, c.get('user').id, id)
      .run()
    if (!res.meta.changes) return fail(c, 'Not found', 404)
  } catch (err) {
    if (isDuplicateCode(err)) return fail(c, duplicateCode, 409)
    throw err
  }
  return c.json({ success: true, id })
})

// ---------- publish ----------
// Translates into the other language when none was supplied (a failure never blocks publishing) and assigns
// a number such as KOR-RCP-004 on first publish when the admin did not type one.
recipeRoutes.post('/:id/publish', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid id')
  const row = await c.env.DB.prepare(`${SELECT} WHERE r.id = ?`).bind(id).first<RecipeRow>()
  if (!row) return fail(c, 'Not found', 404)
  if (!canEditBrand(c.get('user'), row.brand_id)) return fail(c, forbidden, 403)

  const content = normalizeRecipe(JSON.parse(row.content_json || '{}'))
  const missing = missingRecipeFields(content)
  if (missing.length) return fail(c, bi(`還缺：${missing.map((m) => m[0]).join('、')}`, `Missing: ${missing.map((m) => m[1]).join(', ')}`))

  let alt: RecipeContent | null = row.content_alt_json ? normalizeRecipe(JSON.parse(row.content_alt_json)) : null
  if (!alt) {
    try {
      alt = await translateRecipe(c.env, content, row.lang === 'en' ? 'zh' : 'en')
    } catch {
      alt = null
    }
  }

  const prefix = `${(row.brand_code || 'ALL').toUpperCase()}-RCP`
  try {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE recipes SET status = 'published', published_at = datetime('now'), updated_by = ?, updated_at = datetime('now'),
           name_alt = ?, content_alt_json = ? WHERE id = ?`
      ).bind(c.get('user').id, alt?.name ?? null, alt ? JSON.stringify(alt) : null, id),
      c.env.DB.prepare(
        `UPDATE recipes SET code_prefix = ?1,
           code_seq = (SELECT COALESCE(MAX(code_seq), 0) + 1 FROM recipes WHERE code_prefix = ?1),
           code = ?1 || '-' || printf('%03d', (SELECT COALESCE(MAX(code_seq), 0) + 1 FROM recipes WHERE code_prefix = ?1))
         WHERE id = ?2 AND code IS NULL`
      ).bind(prefix, id),
    ])
  } catch (err) {
    if (isDuplicateCode(err)) return fail(c, bi('自動編號與現有編號重複，請手動輸入食譜編號', 'Auto-numbering collided with an existing number — please type a recipe number'), 409)
    throw err
  }
  return c.json({ success: true, translated: Boolean(alt) })
})

recipeRoutes.delete('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid id')
  if (!isAdmin(c.get('user'))) return fail(c, 'Forbidden', 403)
  await c.env.DB.prepare(`DELETE FROM recipes WHERE id = ?`).bind(id).run()
  return c.json({ success: true })
})

// ---------- read-only library for every signed-in user (RECIPES tab in the main app) ----------
// Published recipes of the caller's own brands plus all-brand ones, regardless of recipe.manage.
export const recipeViewRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>()
recipeViewRoutes.use('*', requireAuth)

// Viewers without recipe.manage never get edit rights, even on their own brand's recipes.
const forViewer = (r: RecipeRow, u: AuthUser) => ({
  ...hydrate(r, u),
  can_edit: (isAdmin(u) || u.permissions.includes('recipe.manage')) && canEditBrand(u, r.brand_id),
})

const ownBrands = `(r.brand_id IS NULL OR EXISTS (SELECT 1 FROM user_brands ub WHERE ub.brand_id = r.brand_id AND ub.user_id = ?))`

recipeViewRoutes.get('/', async (c) => {
  const u = c.get('user')
  const { results } = await c.env.DB.prepare(`${SELECT} WHERE r.status = 'published' AND ${ownBrands} ORDER BY r.code`)
    .bind(u.id).all<RecipeRow>()
  return c.json({ success: true, recipes: results.map((r) => forViewer(r, u)) })
})

recipeViewRoutes.get('/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (!id) return fail(c, 'Invalid id')
  const u = c.get('user')
  const row = await c.env.DB.prepare(`${SELECT} WHERE r.id = ? AND r.status = 'published' AND ${ownBrands}`).bind(id, u.id).first<RecipeRow>()
  if (!row) return fail(c, 'Not found', 404)
  return c.json({ success: true, recipe: forViewer(row, u) })
})
