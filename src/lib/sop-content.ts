// Fixed SOP format. Stored as JSON in sop_versions.content_json.
export interface SopContent {
  title: string
  purpose: string
  audience: string
  tools: string
  steps: { action: string; caution: string }[]
  mistakes: string
  effective_date: string
}

const s = (v: unknown, max = 2000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export function normalizeContent(raw: unknown): SopContent {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const steps = Array.isArray(r.steps) ? r.steps : []
  return {
    title: s(r.title, 120),
    purpose: s(r.purpose, 4000),
    audience: s(r.audience, 200),
    tools: s(r.tools),
    steps: steps
      .slice(0, 100)
      .map((x) => {
        const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
        return { action: s(o.action, 4000), caution: s(o.caution, 1000) }
      })
      .filter((x) => x.action || x.caution),
    mistakes: s(r.mistakes),
    effective_date: s(r.effective_date, 20),
  }
}

export type Lang = 'zh' | 'en'
export const asLang = (v: unknown): Lang => (v === 'en' ? 'en' : 'zh')

// Required fields to submit. Returns the missing items as [zh, en] pairs.
export function missingFields(c: SopContent): [string, string][] {
  const out: [string, string][] = []
  if (!c.title) out.push(['標題', 'title'])
  if (!c.purpose) out.push(['目的', 'purpose'])
  if (c.steps.length === 0) out.push(['至少一個步驟', 'at least one step'])
  else if (c.steps.some((st) => !st.action)) out.push(['每個步驟都要有動作說明', 'an action for every step'])
  return out
}
