import { readDocxRows, TEMPLATE_ROWS } from './templateDocx'

// Reads an uploaded, filled-in Word template (see templateDocx.js) into the form shape, with no AI.
// Returns null when the file has no recognisable template table, so callers can fall back to AI for free text.
// Throws Error('not-docx') when the file is not a .docx at all.

// First-column label (English + 中文 lines joined) -> field. The first match wins.
const FIELD_RULES = [
  ['code', /sop number|recipe number|^(sop|食譜)\s*編號/i],
  ['brand', /^brand|品牌/i],
  ['department', /^department|部門/i],
  ['menu_category', /menu category|菜單分類/i],
  ['audience', /audience|適用對象/i],
  ['name', /item name|品項名稱/i],
  ['title', /^title|標題/i],
  ['purpose', /purpose|目的/i],
  ['standards', /standards|準則/i],
  ['ingredients', /ingredients|食材/i],
  ['steps', /steps|method|步驟|做法/i],
  ['garnish', /garnish|裝飾/i],
  ['glassware', /glassware|杯具/i],
  ['notes', /notes|備註/i],
]
const fieldOf = (label) => FIELD_RULES.find(([, re]) => re.test(label))?.[0] ?? null

const MARK = /[☒☑✔✓✅]/
const BOX = /[☐☒☑✔✓✅]/g

// A choice cell: the ticked option; else the only option left; else (untouched option list) nothing;
// else whatever text the user typed instead.
function resolveChoice(lines, labels) {
  if (!lines.length) return ''
  const sorted = [...labels].sort((a, b) => b.length - a.length)
  const has = (text, l) => text.toLowerCase().includes(l.toLowerCase())
  for (const line of lines) {
    if (!MARK.test(line)) continue
    const hit = sorted.find((l) => has(line, l))
    if (hit) return hit
  }
  let rest = lines.join('\n').toLowerCase()
  const present = []
  for (const l of sorted) {
    if (rest.includes(l.toLowerCase())) {
      present.push(l)
      rest = rest.replace(l.toLowerCase(), ' ')
    }
  }
  if (present.length === 1) return present[0]
  if (present.length > 1) return ''
  return lines.join(' ').replace(BOX, '').trim()
}

const stripStep = (x) => x.replace(/^\d+\s*[.)、]\s*/, '').trim()
const stripBullet = (x) => x.replace(/^[•·\-*]\s*/, '').trim()

// Parse a filled template. kind: 'sop' | 'recipe'. options = { brands: string[], departments: string[] } (the labels offered).
// -> { en, zh, meta: { code, brand, department }, warnings } with en / zh SopContent / RecipeContent-shaped
//    (null when that column has no title / name), or null when the file is not the template.
export async function parseTemplate(file, kind, options = {}) {
  const table = readDocxRows(await file.arrayBuffer())
  const examples = new Map(TEMPLATE_ROWS[kind].map((r) => [r.field, r.ex]))
  const rows = []
  for (const cells of table) {
    if (cells.length < 3) continue
    const field = fieldOf(cells[0].join(' '))
    if (field) rows.push({ field, en: cells[1], zh: cells[2] })
  }
  if (!rows.some((r) => r.field === (kind === 'sop' ? 'title' : 'name'))) return null

  const warnings = []
  // A cell left exactly as the grey example counts as empty.
  const val = (field, col) =>
    rows.filter((r) => r.field === field).flatMap((r) => {
      const ex = examples.get(field)?.[col === 'en' ? 0 : 1] ?? []
      return r[col].join('\n') === ex.join('\n') ? [] : r[col]
    })

  const choice = (field, labels) => resolveChoice(val(field, 'en'), labels ?? []) || resolveChoice(val(field, 'zh'), labels ?? [])
  const meta = {
    code: val('code', 'en')[0] ?? val('code', 'zh')[0] ?? '',
    brand: choice('brand', options.brands),
    department: choice('department', options.departments),
  }

  const side = (col) => {
    const one = (f) => val(f, col).join(' ').trim()
    if (kind === 'sop') {
      const title = one('title')
      if (!title) return null
      return {
        title, purpose: val('purpose', col).join('\n'), audience: one('audience'), tools: '', mistakes: '', effective_date: '',
        standards: val('standards', col).map(stripBullet).filter(Boolean),
        steps: val('steps', col).map(stripStep).filter(Boolean).map((action) => ({ action, caution: '', images: [] })),
        notes: val('notes', col).join('\n'),
      }
    }
    const name = one('name')
    if (!name) return null
    return {
      name, menu_category: one('menu_category'), audience: one('audience'),
      ingredients: val('ingredients', col).map((line) => {
        const p = line.split('|').map((x) => x.trim())
        if (p.length === 3) return { qty: p[0], unit: p[1], name: p[2] }
        warnings.push({ code: 'ingredient_format', detail: line })
        return { qty: '', unit: '', name: line }
      }).filter((i) => i.name),
      steps: val('steps', col).map(stripStep).filter(Boolean),
      garnish: one('garnish'), glassware: one('glassware'), notes: val('notes', col).join('\n'),
    }
  }

  const en = side('en')
  const zh = side('zh')
  if (!en && !zh) return null
  if (en && zh) {
    if (en.steps.length !== zh.steps.length) warnings.push({ code: 'steps_mismatch', detail: `${en.steps.length} / ${zh.steps.length}` })
    if (kind === 'sop' && en.standards.length !== zh.standards.length) warnings.push({ code: 'standards_mismatch', detail: `${en.standards.length} / ${zh.standards.length}` })
    if (kind === 'recipe' && en.ingredients.length !== zh.ingredients.length) warnings.push({ code: 'ingredients_mismatch', detail: `${en.ingredients.length} / ${zh.ingredients.length}` })
  }
  return { en, zh, meta, warnings }
}

// Match the chosen text ("SPC", "BOH") to the user's own options by key / code / label.
export function matchOption(text, options) {
  const q = (text ?? '').trim().toLowerCase()
  if (!q) return null
  return (
    options.find((o) => [o.key, o.code, o.label].some((v) => v && String(v).toLowerCase() === q)) ??
    options.find((o) => [o.key, o.code, o.label].some((v) => v && q.includes(String(v).toLowerCase()))) ??
    null
  )
}

// Warning codes -> a short message in the user's language (t = the page's translate function).
export function warningText(w, t) {
  const m = {
    steps_mismatch: t('English and 中文 have different numbers of steps ({n})', { n: w.detail }),
    standards_mismatch: t('English and 中文 have different numbers of standards ({n})', { n: w.detail }),
    ingredients_mismatch: t('English and 中文 have different numbers of ingredients ({n})', { n: w.detail }),
    ingredient_format: t('Ingredient not in “quantity | unit | name” format: {line}', { line: w.detail }),
  }
  return m[w.code] ?? w.code
}
