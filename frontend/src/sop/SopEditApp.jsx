import { useCallback, useEffect, useState } from 'react'
import { sopApi } from '../api/sops'
import { useLang } from '../i18n/LanguageContext'
import { localized } from './sopLang'
import { SopWizard } from './SopWizard'
import './sop.css'

const STATUS_KEYS = { draft: '草稿', in_review: '簽核中', rejected: '被退回', published: '已發布', superseded: '舊版' }
const EDITABLE = ['draft', 'rejected']

function matches(s, q) {
  const parts = [s.code, s.content, s.content_alt].flatMap((c) =>
    !c ? [] : typeof c === 'string' ? [c] : [c.title, c.purpose, c.tools, c.mistakes, ...(c.steps ?? []).flatMap((st) => [st.action, st.caution])]
  )
  return parts.some((p) => p && p.toLowerCase().includes(q))
}

// Create / edit side of SOP. Anyone may edit any SOP they can see; every change still goes through approval.
// Reading SOPs lives in SopApp.
export function SopEditApp({ onExit, initialSopId = null }) {
  const { lang, t } = useLang()
  const [tab, setTab] = useState('mine')
  const [view, setView] = useState({ name: initialSopId ? 'loading' : 'list' })
  const [list, setList] = useState(null)
  const [categories, setCategories] = useState([])
  const [departments, setDepartments] = useState([])
  const [roles, setRoles] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [pasteText, setPasteText] = useState('')
  const [busy, setBusy] = useState(false)

  const loadList = useCallback(() => {
    setList(null)
    sopApi.list(tab === 'mine' ? 'mine' : 'published').then((r) => setList(r.sops)).catch((e) => setError(t(e.message)))
  }, [tab, t])

  useEffect(() => { loadList() }, [loadList])
  useEffect(() => {
    sopApi.categories().then((r) => setCategories(r.categories)).catch(() => {})
    sopApi.departments().then((r) => setDepartments(r.departments)).catch(() => {})
    sopApi.roles().then((r) => setRoles(r.roles)).catch(() => {})
  }, [])

  const openEditor = useCallback((sopId) => {
    setError(null)
    setView({ name: 'loading' })
    sopApi.edit(sopId)
      .then((r) => setView({ name: 'wizard', sop: r.sop }))
      .catch((e) => { setError(t(e.message)); setView({ name: 'list' }) })
  }, [t])

  useEffect(() => { if (initialSopId) openEditor(initialSopId) }, [initialSopId, openEditor])

  async function importText() {
    setBusy(true)
    setError(null)
    try {
      const { content, lang: contentLang } = await sopApi.aiStructure(pasteText)
      setView({ name: 'wizard', initial: content, initialLang: contentLang })
    } catch (e) {
      setError(t(e.message))
    }
    setBusy(false)
  }

  if (view.name === 'loading') return <div className="sop"><p className="sop-sub">{t('載入中…')}</p></div>

  if (view.name === 'wizard') {
    return (
      <div className="sop">
        <SopWizard
          sop={view.sop}
          initial={view.initial}
          initialLang={view.initialLang}
          categories={categories}
          departments={departments}
          roles={roles}
          onCategoryAdded={(c) => setCategories((cs) => (cs.some((x) => x.id === c.id) ? cs : [...cs, c]))}
          onCancel={() => setView({ name: 'list' })}
          onDone={(id, submitted, translated) => {
            setNotice(submitted ? t(translated ? '已送出，等待簽核 ✓' : '已送出，但尚未翻譯（AI 未設定或失敗）') : t('已存成草稿'))
            setTab('mine')
            setView({ name: 'list' })
            loadList()
          }}
        />
      </div>
    )
  }

  if (view.name === 'paste') {
    return (
      <div className="sop">
        <h2 className="sop-q">{t('貼上你的內容')}</h2>
        <p className="sop-sub">{t('把 LINE 訊息或筆記貼在這裡，AI 會幫你整理成固定格式，你再確認。')}</p>
        <textarea className="sop-input" rows={10} value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
        {error && <p className="sop-error">{error}</p>}
        <div className="sop-nav">
          <button type="button" className="sop-btn" onClick={() => { setError(null); setView({ name: 'list' }) }}>{t('← 返回')}</button>
          <button type="button" className="sop-btn sop-btn--primary" disabled={busy || pasteText.trim().length < 10} onClick={importText}>
            {busy ? t('整理中…') : t('請 AI 整理')}
          </button>
        </div>
      </div>
    )
  }

  const q = search.trim().toLowerCase()
  // "Mine" = my unfinished work; published SOPs are edited from the "All SOPs" tab.
  const shown = (list ?? []).filter((s) => (tab === 'mine' ? s.status !== 'published' && s.status !== 'superseded' : !q || matches(s, q)))

  return (
    <div className="sop">
      <div className="sop-head">
        <button type="button" className="sop-link" onClick={onExit}>{t('← 首頁')}</button>
        <h1 className="sop-title">{t('新增 / 編輯 SOP')}</h1>
      </div>

      <div className="sop-new">
        <button type="button" className="sop-btn sop-btn--primary sop-btn--big" onClick={() => setView({ name: 'wizard' })}>{t('＋ 新增 SOP（一步一步填）')}</button>
        <button type="button" className="sop-btn sop-btn--big" onClick={() => { setError(null); setView({ name: 'paste' }) }}>{t('貼上文字，讓 AI 整理')}</button>
      </div>

      {notice && <p className="sop-notice">{notice}</p>}

      <div className="sop-tabs">
        {[['mine', t('我的草稿與簽核')], ['all', t('修改現有 SOP')]].map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? 'is-active' : ''} onClick={() => { setNotice(null); setTab(id) }}>{label}</button>
        ))}
      </div>

      {tab === 'all' && (
        <>
          <p className="sop-sub">{t('任何人都可以修改 SOP，送出後一樣要經過簽核；通過前仍顯示目前版本。')}</p>
          <input className="sop-input" placeholder={t('搜尋 SOP')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </>
      )}

      {error && <p className="sop-error">{error}</p>}
      {!list && !error && <p className="sop-sub">{t('載入中…')}</p>}
      {list && shown.length === 0 && <p className="sop-sub">{q ? t('找不到符合的 SOP') : t('目前沒有資料')}</p>}

      {shown.map((s) => {
        const editable = tab === 'all' || EDITABLE.includes(s.status)
        const body = (
          <>
            <strong>{(s.code ? `${s.code} · ` : '') + (localized(s, lang).title || t('（未命名）'))}</strong>
            <span>
              {t(STATUS_KEYS[s.status])} · v{s.version_no} · {s.category_label ?? t('未分類')}
              {s.status === 'in_review' && ` · ${t('簽核中不能修改')}`}
            </span>
          </>
        )
        return editable ? (
          <button type="button" key={s.id} className="sop-card" onClick={() => openEditor(s.sop_id)}>{body}</button>
        ) : (
          <div key={s.id} className="sop-card sop-card--static">{body}</div>
        )
      })}
    </div>
  )
}
