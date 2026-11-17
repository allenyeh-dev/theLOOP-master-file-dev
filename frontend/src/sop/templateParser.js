// Reads a filled-in SOP / recipe template (the .md files in /public/sop-templates and /recipe-templates)
// straight into the form shape, with no AI. Returns null when the text does not look like the template,
// so callers can fall back to the AI "structure" step for free text.

const TEMPLATE_URLS = {
  sop: ['/sop-templates/sop-template-en.md', '/sop-templates/sop-template-zh.md'],
  recipe: ['/recipe-templates/recipe-template-en.md', '/recipe-templates/recipe-template-zh.md'],
}

export const templateLinks = {
  sop: { zh: TEMPLATE_URLS.sop[1], en: TEMPLATE_URLS.sop[0] },
  recipe: { zh: TEMPLATE_URLS.recipe[1], en: TEMPLATE_URLS.recipe[0] },
}

// First-column label -> field. Order matters: the first match wins.
const FIELD_RULES = [
  ['code', /sop number|recipe number|^(sop|食譜)\s*編號/i],
  ['brand', /venue|brand|據點|品牌/i],
  ['department', /department|部門/i],
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

const HEADING_STOP = /^#{1,6}\s*(example|範例|why this matters|為何這很重要)/i
const HEADING_NOTES = /^#{1,6}\s*\d*\.?\s*(submission notes|提交備註)/i
const BOILERPLATE = /^(anything unclear|任何不明確之處)/i

// A table row -> cells. "\|" is a literal pipe (ingredient format), "|" separates cells.
function cellsOf(line) {
  const parts = line.replace(/\\\|/g, '\u0000').split('|').map((x) => x.replaceAll('\u0000', '|').trim())
  if (parts[0] === '') parts.shift()
  if (parts[parts.length - 1] === '') parts.pop()
  return parts
}

// A cell -> its lines. <br> and newlines split; (parenthesised) lines are template instructions and dropped.
const linesOf = (cell) =>
  (cell ?? '')
    .split(/<br\s*\/?>|\n/i)
    .map((x) => x.trim())
    .filter((x) => x && !/^[(（].*[)）]$/.test(x))

// -> { rows: [{ field, en: string[], zh: string[] }], notes: string[] }. Stops before the worked example.
function readTable(text) {
  const rows = []
  const notes = []
  let inNotes = false
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (HEADING_STOP.test(line)) break
    if (/^#{1,6}\s/.test(line)) { inNotes = HEADING_NOTES.test(line); continue }
    if (inNotes) { if (line && !BOILERPLATE.test(line)) notes.push(line); continue }
    if (!line.startsWith('|') || /^\|[\s:|-]+\|?$/.test(line)) continue
    const cells = cellsOf(line)
    if (cells.length < 3) continue
    const field = fieldOf(cells[0])
    if (field) rows.push({ field, en: linesOf(cells[1]), zh: linesOf(cells[2]) })
  }
  return { rows, notes }
}

// The cells of the blank template itself, per field+column: a cell left exactly as downloaded counts as empty.
const untouched = new Map() // kind -> Set of "field|col|text"
const loading = new Map()
function loadUntouched(kind) {
  if (!loading.has(kind)) {
    loading.set(
      kind,
      Promise.all(
        TEMPLATE_URLS[kind].map((u) =>
          fetch(u).then((r) => (r.ok ? r.text() : '')).catch(() => '')
        )
      ).then((texts) => {
        const set = new Set()
        for (const txt of texts) for (const r of readTable(txt).rows) for (const col of ['en', 'zh']) set.add(`${r.field}|${col}|${r[col].join('\n')}`)
        untouched.set(kind, set)
      })
    )
  }
  return loading.get(kind)
}

const stripStep = (x) => x.replace(/^\d+\s*[.)、]\s*/, '').trim()
const stripBullet = (x) => x.replace(/^[•·\-*]\s*/, '').trim()

function ingredientOf(line, warn) {
  const parts = line.split('|').map((x) => x.trim())
  if (parts.length === 3) return { qty: parts[0], unit: parts[1], name: parts[2] }
  warn(line)
  return { qty: '', unit: '', name: line }
}

// Parse a filled template. kind: 'sop' | 'recipe'.
// -> { en, zh, meta, notes, warnings } where en / zh are SopContent / RecipeContent-shaped (or null if that
//    column has no title), or null when the text is not the template.
export async function parseTemplate(text, kind) {
  await loadUntouched(kind)
  const blank = untouched.get(kind) ?? new Set()
  const { rows, notes } = readTable(text)
  if (!rows.some((r) => r.field === (kind === 'sop' ? 'title' : 'name'))) return null

  const warnings = []
  const val = (field, col) => {
    const lines = rows.filter((r) => r.field === field).flatMap((r) => (blank.has(`${field}|${col}|${r[col].join('\n')}`) ? [] : r[col]))
    return lines
  }
  const meta = {
    code: val('code', 'en')[0] ?? val('code', 'zh')[0] ?? '',
    brand: (val('brand', 'en')[0] ?? val('brand', 'zh')[0] ?? '').trim(),
    department: (val('department', 'en')[0] ?? val('department', 'zh')[0] ?? '').trim(),
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
        notes: '',
      }
    }
    const name = one('name')
    if (!name) return null
    return {
      name, menu_category: one('menu_category'), audience: one('audience'),
      ingredients: val('ingredients', col).map((l) => ingredientOf(l, (bad) => warnings.push({ code: 'ingredient_format', detail: bad }))).filter((i) => i.name),
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
  // The submission note belongs to the submitter, not to a language: put it on both sides' notes.
  const note = notes.join('\n').trim()
  if (note) for (const s of [en, zh]) if (s) s.notes = [s.notes, note].filter(Boolean).join('\n')

  return { en, zh, meta, warnings }
}

// Match free text from the template ("SPC Kitchen", "Bar Operations") to the user's own options.
// Returns the option or null. Matches by key/code/label either way round.
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
