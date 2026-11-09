import { useState } from 'react'
import { recipeApi } from '../api/recipes'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../i18n/LanguageContext'
import { ConfirmDialog, LangToggle, PageHead, useLoader } from './ui'
import { localizedTitle } from '../sop/sopLang'
import { RecipeFormPage } from '../sop/RecipeFormPage'

const STATUS = { draft: 'Draft', published: 'Published' }

// All recipes in one place: create, edit, publish or delete.
export function RecipeManagePage() {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const isAdmin = user.role.key === 'admin' // deleting stays an admin-only action
  const [editId, setEditId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [del, setDel] = useState(null)
  const [q, setQ] = useState('')
  const { data, error, reload } = useLoader(() => recipeApi.list(), (r) => r.recipes)

  if (creating) return <RecipeFormPage onBack={() => { setCreating(false); reload() }} />
  if (editId) return <RecipeFormPage editId={editId} onBack={() => { setEditId(null); reload() }} />

  // Recipes carry `name` / `name_alt`; reuse the SOP title picker by mapping them onto title columns.
  const nameOf = (r) => localizedTitle({ lang: r.lang, title: r.name, title_alt: r.name_alt, content_alt: r.content_alt && { title: r.content_alt.name } }, lang)
  const rows = (data ?? []).filter((r) => !q.trim() || `${r.code ?? ''} ${nameOf(r)} ${r.brand_label ?? ''} ${r.content.menu_category}`.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div className="recipe-list">
      <PageHead
        title={t('Recipes')}
        subtitle={t('Create, edit and publish recipes.')}
        action={<div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}><LangToggle /><button type="button" className="cs-btn cs-btn--primary" onClick={() => setCreating(true)}>{t('+ Create')}</button></div>}
      />
      {error && <p className="cs-error">{error}</p>}
      {!data && !error && <p className="cs-muted">{t('Loading…')}</p>}
      {data && (
        <>
          <div className="cs-toolbar">
            <input className="recipe-search" type="search" placeholder={t('Search number, name, brand or category')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
                    <table className="cs-table">
            <thead><tr><th>{t('Code')}</th><th>{t('Item name')}</th><th>{t('Brand')}</th><th>{t('Menu category')}</th><th>{t('Status')}</th><th /></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} className="cs-muted">{q ? t('No matching recipes.') : t('No recipes yet.')}</td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.code ?? '—'}</td>
                  <td>{nameOf(r)}</td>
                  <td>{r.brand_label ?? t('All')}</td>
                  <td>{(r.lang === lang ? r.content : r.content_alt ?? r.content).menu_category || '—'}</td>
                  <td>{t(STATUS[r.status] ?? r.status)}</td>
                  <td>
                    {r.can_edit && <button type="button" className="cs-link" onClick={() => setEditId(r.id)}>{t('Edit')}</button>}{' '}
                    {isAdmin && <button type="button" className="cs-link cs-link--danger" onClick={() => setDel(r)}>{t('Delete')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Phones: a compact card per recipe instead of the table, so nothing is cut off or needs scrolling. */}
          <div className="recipe-cards">
            {rows.length === 0 && <p className="cs-muted">{q ? t('No matching recipes.') : t('No recipes yet.')}</p>}
            {rows.map((r) => (
              <div key={r.id} className="recipe-card">
                <div className="recipe-card-top">
                  <span className="recipe-card-code">{r.code ?? '—'}</span>
                  <span className={`recipe-card-status ${r.status === 'published' ? 'is-pub' : ''}`}>{t(STATUS[r.status] ?? r.status)}</span>
                </div>
                <strong className="recipe-card-name">{nameOf(r)}</strong>
                <div className="recipe-card-bottom">
                  <span className="recipe-card-sub">{[r.brand_label ?? t('All'), (r.lang === lang ? r.content : r.content_alt ?? r.content).menu_category].filter(Boolean).join(' · ')}</span>
                  <span>
                    {r.can_edit && <button type="button" className="cs-link" onClick={() => setEditId(r.id)}>{t('Edit')}</button>}{' '}
                    {isAdmin && <button type="button" className="cs-link cs-link--danger" onClick={() => setDel(r)}>{t('Delete')}</button>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {del && (
        <ConfirmDialog
          title={t('Delete recipe')}
          message={t('Permanently delete {name}? This cannot be undone.', { name: `${del.code ? `${del.code} · ` : ''}"${nameOf(del)}"` })}
          onClose={() => setDel(null)}
          onConfirm={async () => { await recipeApi.remove(del.id); reload() }}
        />
      )}
    </div>
  )
}
