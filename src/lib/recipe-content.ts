// Fixed recipe format. Stored as JSON in recipes.content_json.
export interface RecipeIngredient {
  qty: string // "45"
  unit: string // "ml"
  name: string // "Gin"
}

export interface RecipeContent {
  name: string
  menu_category: string
  audience: string
  ingredients: RecipeIngredient[]
  steps: string[]
  garnish: string
  glassware: string
  notes: string
}

const s = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '')

// An ingredient is an object, or a "45 | ml | Gin" line (the template's strict format).
function ingredient(v: unknown): RecipeIngredient {
  if (typeof v === 'string') {
    const [qty = '', unit = '', ...rest] = v.split('|').map((x) => x.trim())
    return { qty: s(qty, 20), unit: s(unit, 20), name: s(rest.join(' | '), 200) }
  }
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  return { qty: s(o.qty, 20), unit: s(o.unit, 20), name: s(o.name, 200) }
}

const stepText = (v: unknown) => {
  const text = typeof v === 'object' && v ? (v as Record<string, unknown>).action : v
  return s(text, 1000).replace(/^\d+[.)]\s*/, '')
}

export function normalizeRecipe(raw: unknown): RecipeContent {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const list = (v: unknown) => (Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : [])
  return {
    name: s(r.name, 120),
    menu_category: s(r.menu_category, 100),
    audience: s(r.audience, 200),
    ingredients: list(r.ingredients).slice(0, 60).map(ingredient).filter((i) => i.name || i.qty || i.unit),
    steps: list(r.steps).slice(0, 50).map(stepText).filter(Boolean),
    garnish: s(r.garnish, 300),
    glassware: s(r.glassware, 200),
    notes: s(r.notes, 4000),
  }
}

// Required fields to save a recipe as published. Returns the missing items as [zh, en] pairs.
export function missingRecipeFields(c: RecipeContent): [string, string][] {
  const out: [string, string][] = []
  if (!c.name) out.push(['品項名稱', 'item name'])
  if (c.ingredients.length === 0) out.push(['至少一項食材', 'at least one ingredient'])
  else if (c.ingredients.some((i) => !i.name)) out.push(['每項食材都要有名稱', 'a name for every ingredient'])
  if (c.steps.length === 0) out.push(['至少一個步驟', 'at least one step'])
  return out
}
