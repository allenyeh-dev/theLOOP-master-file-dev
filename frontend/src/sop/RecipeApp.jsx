import { useEffect, useMemo, useState } from 'react'
import { recipeApi } from '../api/recipes'
import { useLang } from '../i18n/LanguageContext'
import { RecipeManagePage } from '../console/RecipeManagePage'
import { RecipeFormPage } from './RecipeFormPage'
import './sop.css'

// The language version to show: the author's own, or the confirmed translation when there is one.
function localizedRecipe(r, lang) {
  if (r.lang === lang) return { content: r.content, original: false }
  if (r.content_alt) return { content: r.content_alt, original: false }
  return { content: r.content, original: true }
}

const ingredientLine = (i) => [i.qty, i.unit].filter(Boolean).join(' ')

function Meta({ label, value }) {
  return <div className="sop-meta"><span>{label}</span><strong>{value}</strong></div>
}

function RecipeDetail({ id, onBack, onEdit }) {
  const { lang, t } = useLang()
  const [recipe, setRecipe] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    recipeApi.libraryGet(id).then((r) => setRecipe(r.recipe)).catch((e) => setError(t(e.message)))
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="sop-error">{error}</p>
  if (!recipe) return <p className="sop-sub">{t('Loading…')}</p>
  const { content: c, original } = localizedRecipe(recipe, lang)

  return (
    <div>
      <button type="button" className="sop-link" onClick={onBack}>{t('← Back')}</button>
      {recipe.code && <p className="sop-code sop-code--lg">{recipe.code}</p>}
      <h1 className="sop-title">{c.name}</h1>
      {original && <p className="sop-notice">{t('No translation yet — showing the original.')}</p>}

      <div className="sop-grid">
        <Meta label={t('Brand')} value={recipe.brand_label ?? t('All brands')} />
        <Meta label={t('Menu category')} value={c.menu_category || '—'} />
        <Meta label={t('Glassware')} value={c.glassware || '—'} />
        <Meta label={t('Garnish')} value={c.garnish || '—'} />
      </div>
      {c.audience && <p className="sop-sub">{t('Audience')}: {c.audience}</p>}

      <h3 className="sop-label">{t('Ingredients')}</h3>
      <ul className="recipe-ingredients">
        {c.ingredients.map((i, n) => (
          <li key={n}><span className="recipe-qty">{ingredientLine(i) || '—'}</span><span>{i.name}</span></li>
        ))}
      </ul>

      <h3 className="sop-label">{t('Method')}</h3>
      <div className="sop-full"><ol>{c.steps.map((s, n) => <li key={n}>{s}</li>)}</ol></div>

      {c.notes && <><h3 className="sop-label">{t('Notes / source')}</h3><p style={{ whiteSpace: 'pre-wrap' }}>{c.notes}</p></>}

      {recipe.can_edit && onEdit && (
        <button type="button" className="sop-btn sop-btn--wide" onClick={() => onEdit(recipe.id)}>{t('Edit recipe')}</button>
      )}
    </div>
  )
}

// RECIPES tab: browse published recipes (everyone), plus a Manage tab for people allowed to create / edit them.
export function RecipeApp({ canManage }) {
  const { lang, t } = useLang()
  const [tab, setTab] = useState('library')
  const [view, setView] = useState({ name: 'list' })
  const [list, setList] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [openSecs, setOpenSecs] = useState({})

  const load = () => recipeApi.library().then((r) => setList(r.recipes)).catch((e) => setError(t(e.message)))
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const query = q.trim().toLowerCase()
  const sections = useMemo(() => {
    const rows = (list ?? []).filter((r) => {
      if (!query) return true
      const text = [r.code, r.brand_label, ...[r.content, r.content_alt].flatMap((c) => (c ? [c.name, c.menu_category, c.audience, ...c.ingredients.map((i) => i.name)] : []))]
      return text.some((x) => x && x.toLowerCase().includes(query))
    })
    const map = new Map()
    for (const r of rows) {
      const cat = localizedRecipe(r, lang).content.menu_category || ''
      map.set(cat, [...(map.get(cat) ?? []), r])
    }
    // Named categories first (A–Z), uncategorized last.
    return [...map.entries()].sort(([a], [b]) => (a === '' ) - (b === '') || a.localeCompare(b)).map(([label, items]) => ({ label, items }))
  }, [list, query, lang])

  if (view.name === 'detail') {
    return (
      <div className="sop">
        <RecipeDetail id={view.id} onBack={() => setView({ name: 'list' })} onEdit={canManage ? (id) => setView({ name: 'edit', id }) : null} />
      </div>
    )
  }
  if (view.name === 'edit') {
    return <RecipeFormPage key={view.id} editId={view.id} onBack={() => { setView({ name: 'list' }); load() }} />
  }

  return (
    <div className="sop">
      {canManage && (
        <div className="sop-tabs">
          <button type="button" className={tab === 'library' ? 'is-active' : ''} onClick={() => { setTab('library'); load() }}>{t('Recipes')}</button>
          <button type="button" className={tab === 'manage' ? 'is-active' : ''} onClick={() => setTab('manage')}>{t('Manage')}</button>
        </div>
      )}

      {tab === 'manage' ? <RecipeManagePage /> : (
        <>
          <input className="recipe-search recipe-search--block" type="search" placeholder={t('Search number, name, brand or category')} value={q} onChange={(e) => setQ(e.target.value)} />
          {error && <p className="sop-error">{error}</p>}
          {!list && !error && <p className="sop-sub">{t('Loading…')}</p>}
          {list && sections.length === 0 && <p className="sop-sub">{query ? t('No matching recipes.') : t('No recipes yet.')}</p>}
          {sections.map((sec, i) => {
            const open = query || (openSecs[sec.label] ?? i === 0)
            return (
              <div key={sec.label} className="sop-sec">
                <button type="button" className="sop-sec-head" onClick={() => setOpenSecs({ ...openSecs, [sec.label]: !open })}>
                  <span className="sop-sec-caret">{open ? '⌄' : '›'}</span>
                  <span className="sop-sec-no">{String(i + 1).padStart(2, '0')}</span>
                  <strong>{sec.label || t('Uncategorized')}</strong>
                  <span className="sop-sec-count">{sec.items.length}</span>
                </button>
                {open && sec.items.map((r) => (
                  <button type="button" key={r.id} className="sop-row" onClick={() => setView({ name: 'detail', id: r.id })}>
                    <span className="sop-code">{r.code ?? '—'}</span>
                    <span className="sop-row-title">{localizedRecipe(r, lang).content.name}</span>
                    {r.brand_label && <span className="sop-tag">{r.brand_label}</span>}
                  </button>
                ))}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
