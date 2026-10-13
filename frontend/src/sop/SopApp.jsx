import { useCallback, useEffect, useState } from 'react'
import { sopApi } from '../api/sops'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../i18n/LanguageContext'
import { localized } from './sopLang'
import { SopDetail } from './SopDetail'
import './sop.css'

const STATUS_KEYS = { draft: '草稿', in_review: '簽核中', rejected: '被退回', published: '已發布', superseded: '舊版' }
const ADMIN_ROLES = ['admin', 'ownership']

// Search across both language versions of a SOP.
function matches(s, q) {
  const parts = [s.code, s.content, s.content_alt].flatMap((c) =>
    !c ? [] : typeof c === 'string' ? [c] : [c.title, c.purpose, c.tools, c.mistakes, ...(c.steps ?? []).flatMap((st) => [st.action, st.caution])]
  )
  return parts.some((p) => p && p.toLowerCase().includes(q))
}

// Read-only side of SOP: browse published SOPs, mark read / flag, and approve. Creating and editing lives in SopEditApp.
export function SopApp({ onExit, onEditSop, query = '', onClearQuery }) {
  const { user, hasPermission } = useAuth()
  const { lang, t } = useLang()
  const canApprove = hasPermission('sop.approve')
  const isAdmin = ADMIN_ROLES.includes(user.role.key)
  const [tab, setTab] = useState('published')
  const [view, setView] = useState({ name: 'list' })
  const [list, setList] = useState(null)
  const [flags, setFlags] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [categories, setCategories] = useState([])
  const [departments, setDepartments] = useState([])
  // Roles that see everything start on their own department (when they have exactly one).
  const myDepts = user.departments ?? []
  const [dept, setDept] = useState(hasPermission('sop.view_all') && myDepts.length === 1 ? myDepts[0].id : 'all')
  const [openSecs, setOpenSecs] = useState({})
  const [error, setError] = useState(null)

  const loadList = useCallback(() => {
    setList(null)
    if (tab === 'flags') {
      sopApi.flags().then((r) => setFlags(r.flags)).catch((e) => setError(t(e.message))).finally(() => setList([]))
      return
    }
    sopApi.list(tab).then((r) => setList(r.sops)).catch((e) => setError(t(e.message)))
  }, [tab, t])
  const loadPending = useCallback(() => {
    if (canApprove) sopApi.list('pending').then((r) => setPendingCount(r.sops.length)).catch(() => {})
  }, [canApprove])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => { loadPending() }, [loadPending])
  useEffect(() => {
    sopApi.categories().then((r) => setCategories(r.categories)).catch(() => {})
    sopApi.departments().then((r) => setDepartments(r.departments)).catch(() => {})
  }, [])

  if (view.name === 'detail') {
    return (
      <div className="sop">
        <SopDetail
          id={view.id}
          onBack={() => { setView({ name: 'list' }); loadList(); loadPending() }}
          onEdit={(sop) => onEditSop(sop.sop_id)}
          onChanged={loadPending}
        />
      </div>
    )
  }

  const q = query.trim().toLowerCase()
  const filtered = list && tab !== 'flags' ? list.filter((s) => (!q || matches(s, q)) && (tab !== 'published' || dept === 'all' || s.department_id === dept)) : []

  const tabs = [
    ['published', t('已發布')],
    ...(canApprove ? [['pending', `${t('待我簽核')}${pendingCount ? ` (${pendingCount})` : ''}`]] : []),
    ...(isAdmin ? [['flags', t('被標記')]] : []),
  ]

  // Published tab: group by section (category), in category order; uncategorized last.
  const sections = []
  if (tab === 'published') {
    for (const c of categories) {
      const items = filtered.filter((s) => s.category_id === c.id)
      if (items.length) sections.push({ id: c.id, label: c.label, items })
    }
    const rest = filtered.filter((s) => !categories.some((c) => c.id === s.category_id))
    if (rest.length) sections.push({ id: 0, label: t('未分類'), items: rest })
  }
  const isOpen = (i, id) => q || (openSecs[id] ?? i === 0)

  return (
    <div className="sop">
      <div className="sop-head">
        <button type="button" className="sop-link" onClick={onExit}>{t('← 首頁')}</button>
        <h1 className="sop-title">SOP</h1>
      </div>

      <div className="sop-tabs">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'is-active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'published' && (
        <div className="sop-chips">
          {[{ id: 'all', label: t('全部') }, ...departments.filter((d) => list?.some((s) => s.department_id === d.id))].map((d) => (
            <button key={d.id} type="button" className={`sop-chip ${dept === d.id ? 'is-active' : ''}`} onClick={() => setDept(d.id)}>{d.label}</button>
          ))}
        </div>
      )}

      {query && (
        <p className="sop-notice">
          {t('搜尋：{q}', { q: query })} <button type="button" className="sop-link" onClick={onClearQuery}>{t('清除')}</button>
        </p>
      )}
      {error && <p className="sop-error">{error}</p>}
      {!list && !error && <p className="sop-sub">{t('載入中…')}</p>}

      {tab === 'flags' && list && (
        flags.length === 0 ? <p className="sop-sub">{t('目前沒有資料')}</p> : flags.map((f) => (
          <div key={f.id} className="sop-card">
            <button type="button" className="sop-link" onClick={() => setView({ name: 'detail', id: f.sop_id })}>{f.code ? `${f.code} · ` : ''}{f.title}</button>
            <span>{t('標記者：{name}', { name: f.flagged_by })}</span>
            <p>{f.reason}</p>
            <button type="button" className="sop-btn" onClick={() => sopApi.resolveFlag(f.id).then(loadList)}>{t('標為已處理')}</button>
          </div>
        ))
      )}

      {list && tab !== 'flags' && filtered.length === 0 && <p className="sop-sub">{query ? t('找不到符合的 SOP') : t('目前沒有資料')}</p>}

      {tab === 'published' && sections.map((sec, i) => {
        const read = sec.items.filter((s) => s.is_read).length
        const open = isOpen(i, sec.id)
        return (
          <div key={sec.id} className="sop-sec">
            <button type="button" className="sop-sec-head" onClick={() => setOpenSecs({ ...openSecs, [sec.id]: !open })}>
              <span className="sop-sec-caret">{open ? '⌄' : '›'}</span>
              <span className="sop-sec-no">{String(i + 1).padStart(2, '0')}</span>
              <strong>{sec.label}</strong>
              <span className="sop-bar"><i style={{ width: `${(read / sec.items.length) * 100}%` }} /></span>
              <span className="sop-sec-count">{read}/{sec.items.length}</span>
            </button>
            {open && sec.items.map((s) => (
              <button type="button" key={s.id} className="sop-row" onClick={() => setView({ name: 'detail', id: s.sop_id })}>
                <span className="sop-code">{s.code ?? '—'}</span>
                <span className="sop-row-title">{localized(s, lang).title}</span>
                {s.dept_label && <span className="sop-tag">{s.dept_label}</span>}
                <span className={`sop-done ${s.is_read ? 'is-done' : ''}`}>{s.is_read ? t('已讀') : t('未讀')}</span>
              </button>
            ))}
          </div>
        )
      })}

      {tab === 'pending' && filtered.map((s) => (
        <button type="button" key={s.id} className="sop-card" onClick={() => setView({ name: 'detail', id: s.sop_id })}>
          <strong>{localized(s, lang).title || t('（未命名）')}</strong>
          <span>
            {t(STATUS_KEYS[s.status])} · v{s.version_no} · {s.category_label ?? t('未分類')}
            {!s.content_alt && ` · ${t('僅單語')}`}
          </span>
        </button>
      ))}
    </div>
  )
}
