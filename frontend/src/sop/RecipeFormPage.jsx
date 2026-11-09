import { useEffect, useState } from 'react'
import { recipeApi } from '../api/recipes'
import { sopApi } from '../api/sops'
import { useLang } from '../i18n/LanguageContext'
import './sop.css'

// Create / edit recipes. Same bilingual layout as the SOP form, used by both the main app (RECIPES tab)
// and the admin console: one column per language, rows paired across the two, AI translate, several at a time.
// Keys are English source text: the zh dictionary translates them, English falls back to the key itself.

const LANGS = ['en', 'zh']
const LANG_LABEL = { en: 'English', zh: '中文' }
const emptyIng = () => ({ qty: '', unit: '', name: '' })
const emptySide = () => ({ name: '', menu_category: '', audience: '', ingredients: [emptyIng()], steps: [''], garnish: '', glassware: '', notes: '' })
const filled = (s) => Boolean(s.name.trim() || s.ingredients.some((i) => i.name.trim()) || s.steps.some((x) => x.trim()))

const toContent = (s) => ({
  name: s.name.trim(), menu_category: s.menu_category.trim(), audience: s.audience.trim(),
  ingredients: s.ingredients.map((i) => ({ qty: i.qty.trim(), unit: i.unit.trim(), name: i.name.trim() })).filter((i) => i.name || i.qty || i.unit),
  steps: s.steps.map((x) => x.trim()).filter(Boolean),
  garnish: s.garnish.trim(), glassware: s.glassware.trim(), notes: s.notes.trim(),
})
const fromContent = (c) => ({
  name: c.name ?? '', menu_category: c.menu_category ?? '', audience: c.audience ?? '',
  ingredients: c.ingredients?.length ? c.ingredients.map((i) => ({ qty: i.qty ?? '', unit: i.unit ?? '', name: i.name ?? '' })) : [emptyIng()],
  steps: c.steps?.length ? c.steps : [''],
  garnish: c.garnish ?? '', glassware: c.glassware ?? '', notes: c.notes ?? '',
})
const blank = (field) => (field === 'ingredients' ? emptyIng() : '')
const padded = (list, n, field) => [...list, ...Array.from({ length: Math.max(0, n - list.length) }, () => blank(field))]
// After a translation or a load the two lists can differ in length: pad the shorter so the rows line up.
const aligned = (it) => {
  const out = { ...it }
  for (const field of ['ingredients', 'steps']) {
    const n = Math.max(it.en[field].length, it.zh[field].length)
    for (const l of LANGS) out[l] = { ...out[l], [field]: padded(out[l][field], n, field) }
  }
  return out
}

let nextKey = 1
const newItem = () => ({ key: nextKey++, brandSel: '', code: '', en: emptySide(), zh: emptySide(), last: null, status: 'idle', error: null, id: null })

export function RecipeFormPage({ onBack, editId = null }) {
  const { t } = useLang()
  const [items, setItems] = useState(() => [newItem()])
  const [brands, setBrands] = useState([])
  const [canAll, setCanAll] = useState(false) // only admins may file a recipe under every brand
  const [view, setView] = useState('both') // which language column(s) to show; remembered per account
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [source, setSource] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState(null)
  const shown = view === 'both' ? LANGS : [view]

  useEffect(() => {
    recipeApi.brands().then((b) => { setBrands(b.brands); setCanAll(b.can_all) }).catch((e) => setLoadError(t(e.message)))
    sopApi.myPrefs().then((r) => setView(r.form_view)).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!editId) return
    recipeApi.get(editId).then(({ recipe: r }) => {
      const other = r.lang === 'en' ? 'zh' : 'en'
      setItems([aligned({
        ...newItem(), id: editId, last: r.lang, code: r.code ?? '', brandSel: r.brand_id ? String(r.brand_id) : '',
        [r.lang]: fromContent(r.content), ...(r.content_alt && { [other]: fromContent(r.content_alt) }),
      })])
    }).catch((e) => setLoadError(t(e.message)))
  }, [editId]) // eslint-disable-line react-hooks/exhaustive-deps

  const chooseView = (v) => {
    setView(v)
    sopApi.setFormView(v).catch(() => {})
  }

  // A non-admin with a single brand has nothing to choose.
  const fixedBrand = !canAll && brands.length === 1 ? brands[0] : null
  const brandOf = (it) => (fixedBrand ? String(fixedBrand.id) : it.brandSel)

  const patch = (key, p) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)))
  const edit = (it, lang, p) => patch(it.key, { [lang]: { ...it[lang], ...p }, last: lang })
  const editList = (it, lang, field, i, v) => edit(it, lang, { [field]: it[lang][field].map((x, j) => (j === i ? v : x)) })
  // Quantity and unit are the same in both languages, so editing one side updates the other.
  const editIng = (it, lang, i, p) => {
    const both = 'name' in p ? {} : p
    patch(it.key, {
      last: lang,
      en: { ...it.en, ingredients: it.en.ingredients.map((x, j) => (j === i ? { ...x, ...both, ...(lang === 'en' ? p : {}) } : x)) },
      zh: { ...it.zh, ingredients: it.zh.ingredients.map((x, j) => (j === i ? { ...x, ...both, ...(lang === 'zh' ? p : {}) } : x)) },
    })
  }
  // Rows are paired across the two languages: adding or removing one does the same on the other side.
  const addRow = (it, field) => {
    const n = Math.max(it.en[field].length, it.zh[field].length) + 1
    patch(it.key, { en: { ...it.en, [field]: padded(it.en[field], n, field) }, zh: { ...it.zh, [field]: padded(it.zh[field], n, field) } })
  }
  const removeRow = (it, field, i) => {
    const n = Math.max(it.en[field].length, it.zh[field].length)
    const drop = (side) => {
      const rows = padded(side[field], n, field).filter((_, j) => j !== i)
      return { ...side, [field]: rows.length ? rows : [blank(field)] }
    }
    patch(it.key, { en: drop(it.en), zh: drop(it.zh) })
  }

  // The original is the only side with a name, or the one edited last.
  const primaryOf = (it) => {
    const have = LANGS.filter((l) => it[l].name.trim())
    return have.length === 1 ? have[0] : have.length === 0 ? null : it.last ?? 'zh'
  }

  const problem = (it, publish) => {
    const p = primaryOf(it)
    if (!p) return t('Please fill in the item name in at least one language')
    if (!canAll && !brandOf(it)) return t('Please choose a brand')
    if (!publish) return null
    const c = toContent(it[p])
    if (c.ingredients.length === 0) return t('Please add at least one ingredient')
    if (c.ingredients.some((i) => !i.name)) return t('Every ingredient needs a name')
    if (c.steps.length === 0) return t('Please add at least one step')
    return null
  }

  async function translate(it) {
    const from = filled(it.en) && filled(it.zh) ? it.last ?? 'zh' : filled(it.en) ? 'en' : filled(it.zh) ? 'zh' : null
    if (!from) return
    const to = from === 'en' ? 'zh' : 'en'
    if (filled(it[to]) && !window.confirm(t('The {lang} column already has content; translating will overwrite it. Continue?', { lang: LANG_LABEL[to] }))) return
    patch(it.key, { status: 'translating', error: null })
    try {
      const r = await recipeApi.aiTranslate(toContent(it[from]), to)
      patch(it.key, { ...aligned({ ...it, [to]: fromContent(r.content) }), last: from, status: 'idle' })
    } catch (err) {
      patch(it.key, { status: 'idle', error: t(err.message) })
    }
  }

  async function structure() {
    setAiBusy(true); setAiError(null)
    try {
      const r = await recipeApi.aiStructure(source)
      setItems((list) => {
        const last = list[list.length - 1]
        const target = last && !filled(last.en) && !filled(last.zh) && !last.id ? last : null
        const next = aligned({ ...(target ?? newItem()), [r.lang]: fromContent(r.content), last: r.lang })
        return target ? list.map((x) => (x.key === target.key ? next : x)) : [...list, next]
      })
      setSource('')
    } catch (err) {
      setAiError(`${t(err.message)} — ${t('you can still fill in the form below by hand.')}`)
    } finally {
      setAiBusy(false)
    }
  }

  async function saveAll(publish) {
    setBusy(true)
    for (const it of items) {
      if (it.status === 'done') continue
      const err = problem(it, publish)
      if (err) { patch(it.key, { status: 'error', error: err }); continue }
      patch(it.key, { status: 'sending', error: null })
      const primary = primaryOf(it)
      const other = primary === 'en' ? 'zh' : 'en'
      const sel = brandOf(it)
      const payload = {
        content: toContent(it[primary]), lang: primary,
        content_alt: it[other].name.trim() ? toContent(it[other]) : null,
        code: it.code, brand_id: sel && sel !== 'all' ? Number(sel) : null,
      }
      try {
        // A recipe saved by an earlier attempt is updated, not duplicated.
        const id = it.id ?? (await recipeApi.create(payload)).id
        if (it.id) await recipeApi.update(id, payload)
        patch(it.key, { id })
        if (publish) await recipeApi.publish(id)
        patch(it.key, { status: 'done', published: publish })
        if (editId) { onBack(); return }
      } catch (e) {
        patch(it.key, { status: 'error', error: t(e.message) })
      }
    }
    setBusy(false)
  }

  const pending = items.filter((it) => it.status !== 'done')
  const allDone = items.length > 0 && pending.length === 0
  const noScope = !editId && !canAll && brands.length === 0 && !loadError

  const listField = (it, lang, field, placeholder) => (
    <div className="sop-list">
      {it[lang][field].map((x, i) => (
        <div key={i} className="sop-list-row">
          <span className="sop-list-no">{field === 'steps' ? `${i + 1}.` : '•'}</span>
          {field === 'ingredients' ? (
            <>
              <input className="sop-input sop-input--sm sop-ing-qty" inputMode="decimal" maxLength={20} placeholder={t('Qty')} value={x.qty} onChange={(e) => editIng(it, lang, i, { qty: e.target.value })} />
              <input className="sop-input sop-input--sm sop-ing-unit" maxLength={20} placeholder={t('Unit')} value={x.unit} onChange={(e) => editIng(it, lang, i, { unit: e.target.value })} />
              <input className="sop-input sop-input--sm" maxLength={200} placeholder={placeholder} value={x.name} onChange={(e) => editIng(it, lang, i, { name: e.target.value })} />
            </>
          ) : (
            <input className="sop-input sop-input--sm" value={x} placeholder={placeholder} onChange={(e) => editList(it, lang, field, i, e.target.value)} />
          )}
          <button type="button" className="sop-link" onClick={() => removeRow(it, field, i)}>✕</button>
        </div>
      ))}
      <button type="button" className="sop-link" onClick={() => addRow(it, field)}>{t('＋ Add a row')}</button>
    </div>
  )

  const textRow = (it, label, field, locked, props = {}) => (
    <div className="sop-submit-row">
      <span>{label}</span>
      {shown.map((l) => <input key={l} className="sop-input sop-input--sm" disabled={locked} value={it[l][field]} onChange={(e) => edit(it, l, { [field]: e.target.value })} {...props} />)}
    </div>
  )

  return (
    <div className="sop">
      <button type="button" className="sop-link" onClick={onBack}>{t('← Back')}</button>
      <h2 className="sop-title">{editId ? t('Edit recipe') : t('New recipe')}</h2>
      {loadError && <p className="sop-error">{loadError}</p>}
      <p className="sop-sub">{t('Fill in one language, or both. Press “AI translate” to produce the other one. Save as a draft, or publish right away.')}</p>
      <div className="sop-chips" role="group" aria-label={t('Display language')}>
        {[['both', t('Bilingual')], ['en', 'English'], ['zh', '中文']].map(([v, label]) => (
          <button key={v} type="button" className={`sop-chip ${view === v ? 'is-active' : ''}`} onClick={() => chooseView(v)}>{label}</button>
        ))}
      </div>
      {noScope && <p className="sop-error">{t('Your account has no brand yet — please contact an admin.')}</p>}

      {!editId && (
        <details className="sop-ai-box">
          <summary>{t('Source text · Structure with AI')}</summary>
          <p className="sop-sub">{t('Optional. AI turns the filled-in template into the fixed recipe format; you review everything before saving.')}</p>
          <textarea className="sop-input sop-input--sm" rows={6} value={source} onChange={(e) => setSource(e.target.value)} placeholder={t('Paste recipe text here…')} />
          <div className="sop-nav">
            <label className="sop-btn sop-btn--sm sop-file">
              {t('Choose file…')}
              <input type="file" hidden accept=".md,.markdown,.txt,text/plain,text/markdown" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setSource(await f.text()) }} />
            </label>
            <button type="button" className="sop-btn sop-btn--sm" disabled={aiBusy || source.trim().length < 10} onClick={structure}>{aiBusy ? t('Structuring…') : t('Structure with AI')}</button>
            <a className="sop-link" href="/recipe-templates/recipe-template-zh.md" download>Template (繁中)</a>
            <a className="sop-link" href="/recipe-templates/recipe-template-en.md" download>Template (EN)</a>
          </div>
          {aiError && <p className="sop-error">{aiError}</p>}
        </details>
      )}

      {items.map((it, n) => {
        const done = it.status === 'done'
        const locked = done || it.status === 'sending' || it.status === 'translating'
        return (
          <section key={it.key} className={`sop-submit-card ${done ? 'is-done' : ''}`}>
            <div className="sop-section-head">
              <strong>{t('Recipe')} {n + 1}</strong>
              {done
                ? <span className="sop-done is-done">{it.published ? t('Published') : t('Saved as draft')}</span>
                : items.length > 1 && <button type="button" className="sop-link" disabled={locked} onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}>{t('Remove')}</button>}
            </div>

            {!done && (
              <>
                <div className="sop-submit-meta">
                  <label>{t('Recipe number')}
                    <input className="sop-input sop-input--sm" disabled={locked} maxLength={40} placeholder="KOR-RCP-045" value={it.code} onChange={(e) => patch(it.key, { code: e.target.value })} />
                    <small>{t('Existing number; leave blank to assign one when you publish.')}</small>
                  </label>
                  <label>{t('Brand')}
                    {fixedBrand
                      ? <span className="sop-fixed">{fixedBrand.label}</span>
                      : <select className="sop-input sop-input--sm" disabled={locked} value={it.brandSel} onChange={(e) => patch(it.key, { brandSel: e.target.value })}>
                          <option value="">{canAll ? t('All brands') : '—'}</option>
                          {brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                        </select>}
                  </label>
                </div>

                <div className={`sop-submit-table ${view === 'both' ? '' : 'sop-submit-table--single'}`}>
                  <div className="sop-submit-row sop-submit-row--head">
                    <span>{t('Field')}</span>{shown.map((l) => <span key={l}>{LANG_LABEL[l]}</span>)}
                  </div>
                  {textRow(it, t('Menu category'), 'menu_category', locked, { maxLength: 100, placeholder: 'Signature Cocktails' })}
                  {textRow(it, t('Audience'), 'audience', locked, { maxLength: 200, placeholder: 'Bartender, Bar Back' })}
                  {textRow(it, t('Item name'), 'name', locked, { maxLength: 120 })}
                  <div className="sop-submit-row">
                    <span>{t('Ingredients')}</span>
                    {shown.map((l) => <div key={l}>{listField(it, l, 'ingredients', t('Ingredient'))}</div>)}
                  </div>
                  <div className="sop-submit-row">
                    <span>{t('Method')}</span>
                    {shown.map((l) => <div key={l}>{listField(it, l, 'steps', t('Step'))}</div>)}
                  </div>
                  {textRow(it, t('Garnish'), 'garnish', locked, { maxLength: 300 })}
                  {textRow(it, t('Glassware'), 'glassware', locked, { maxLength: 200 })}
                  <div className="sop-submit-row">
                    <span>{t('Notes / source')}</span>
                    {shown.map((l) => <textarea key={l} className="sop-input sop-input--sm" rows={3} disabled={locked} value={it[l].notes} onChange={(e) => edit(it, l, { notes: e.target.value })} />)}
                  </div>
                </div>

                <div className="sop-nav">
                  <button type="button" className="sop-btn" disabled={locked || !(filled(it.en) || filled(it.zh))} onClick={() => translate(it)}>
                    {it.status === 'translating' ? t('Translating…') : t('AI translate')}
                  </button>
                  <span className="sop-sub">{t('Translates from the filled-in column to the other one')}</span>
                </div>
              </>
            )}
            {it.error && <p className="sop-error">{it.error}</p>}
          </section>
        )
      })}

      {allDone ? (
        <div className="sop-notice">
          {t('All saved.')} <button type="button" className="sop-link" onClick={onBack}>{t('Back to the recipe list')}</button>
        </div>
      ) : (
        <div className="sop-nav">
          {!editId && <button type="button" className="sop-btn" disabled={busy} onClick={() => setItems((l) => [...l, newItem()])}>{t('＋ Add another recipe')}</button>}
          <button type="button" className="sop-btn" disabled={busy || noScope || items.some((x) => x.status === 'translating')} onClick={() => saveAll(false)}>
            {busy ? t('Saving…') : t('Save {n} as draft', { n: pending.length })}
          </button>
          <button type="button" className="sop-btn sop-btn--primary" disabled={busy || noScope || items.some((x) => x.status === 'translating')} onClick={() => saveAll(true)}>
            {busy ? t('Publishing…') : t('Save & publish {n}', { n: pending.length })}
          </button>
        </div>
      )}
    </div>
  )
}
