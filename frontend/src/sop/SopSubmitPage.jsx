import { useEffect, useState } from 'react'
import { sopApi } from '../api/sops'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../i18n/LanguageContext'

const LANGS = ['en', 'zh']
const LANG_LABEL = { en: 'English', zh: '中文' }
const emptyStep = () => ({ action: '', caution: '', images: [] })
const emptySide = () => ({ title: '', purpose: '', standards: [''], steps: [emptyStep()], extra: {} })
const filled = (s) => Boolean(s.title.trim() || s.purpose.trim() || s.standards.some((x) => x.trim()) || s.steps.some((x) => x.action.trim()))

// Form side <-> SopContent (the shape the API stores and translates).
// Fields the form does not show (e.g. step images of a SOP being resent) ride along in `extra` / the step objects.
const toContent = (s) => ({
  audience: '', tools: '', mistakes: '', notes: '', effective_date: '', ...s.extra,
  title: s.title.trim(), purpose: s.purpose.trim(),
  standards: s.standards.map((x) => x.trim()).filter(Boolean),
  steps: s.steps.filter((st) => st.action.trim()).map((st) => ({ action: st.action.trim(), caution: st.caution, images: st.images })),
})
const fromContent = (c) => ({
  title: c.title ?? '', purpose: c.purpose ?? '',
  standards: c.standards?.length ? c.standards : [''],
  steps: c.steps?.length ? c.steps.map((st) => ({ action: st.action, caution: st.caution ?? '', images: st.images ?? [] })) : [emptyStep()],
  extra: { audience: c.audience ?? '', tools: c.tools ?? '', mistakes: c.mistakes ?? '', notes: c.notes ?? '', effective_date: c.effective_date ?? '' },
})

let nextKey = 1
// Brand / department default to the user's own; with exactly one there is nothing to choose.
const newItem = (user) => ({
  key: nextKey++,
  brandId: user.brands?.length === 1 ? user.brands[0].id : '',
  deptId: user.departments?.length === 1 ? user.departments[0].id : '',
  en: emptySide(), zh: emptySide(),
  last: null, // the side edited (or translated from) last: it is the original, the other one the translation
  status: 'idle', error: null, id: null,
})

// Write SOPs in English and/or Chinese (one is enough, AI can translate), several at a time,
// and send them to your manager for approval.
export function SopSubmitPage({ onBack, editId = null }) {
  const { user } = useAuth()
  const { t } = useLang()
  const [items, setItems] = useState(() => [newItem(user)])
  const [approver, setApprover] = useState(undefined) // undefined = loading, null = nobody
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [view, setView] = useState('both') // which language column(s) to show; remembered per account
  const shown = view === 'both' ? LANGS : [view]
  const brands = user.brands ?? []
  const depts = user.departments ?? []

  // Editing a rejected SOP: load it into the single card. Brand and department stay as they were.
  useEffect(() => {
    if (!editId) return
    sopApi.edit(editId).then(({ sop }) => {
      const other = sop.lang === 'en' ? 'zh' : 'en'
      setItems([aligned({
        ...newItem(user), id: editId, last: sop.lang,
        [sop.lang]: fromContent(sop.content), ...(sop.content_alt && { [other]: fromContent(sop.content_alt) }),
        fixed: { brands: sop.brands, dept: sop.dept_label, deptId: sop.department_id },
      })])
    }).catch((e) => setLoadError(t(e.message)))
  }, [editId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    sopApi.myPrefs().then((r) => setView(r.form_view)).catch(() => {})
  }, [])

  const chooseView = (v) => {
    setView(v)
    sopApi.setFormView(v).catch(() => {})
  }

  useEffect(() => {
    sopApi.myApprover().then((r) => setApprover(r.approver)).catch(() => setApprover(null))
  }, [])

  const patch = (key, p) => setItems((list) => list.map((it) => (it.key === key ? { ...it, ...p } : it)))
  const edit = (it, lang, p) => patch(it.key, { [lang]: { ...it[lang], ...p }, last: lang })
  const blank = (field) => (field === 'steps' ? emptyStep() : '')
  const editList = (it, lang, field, i, v) => edit(it, lang, { [field]: it[lang][field].map((x, j) => (j === i ? (field === 'steps' ? { ...x, action: v } : v) : x)) })
  // Rows are paired across the two languages: adding or removing one does the same on the other side.
  // (Which side counts as the original is not changed by this.)
  const padded = (list, n, field) => [...list, ...Array.from({ length: Math.max(0, n - list.length) }, () => blank(field))]
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
  // After a translation or a load the two lists can differ in length: pad the shorter so the rows line up.
  const aligned = (it) => {
    const out = { ...it }
    for (const field of ['standards', 'steps']) {
      const n = Math.max(it.en[field].length, it.zh[field].length)
      for (const l of LANGS) out[l] = { ...out[l], [field]: padded(out[l][field], n, field) }
    }
    return out
  }

  // The original is the only side with content, or the one edited last.
  const primaryOf = (it) => {
    const have = LANGS.filter((l) => it[l].title.trim())
    return have.length === 1 ? have[0] : have.length === 0 ? null : it.last ?? 'zh'
  }

  const problem = (it) => {
    const p = primaryOf(it)
    if (!p) return t('請至少填寫一種語言的標題')
    const c = toContent(it[p])
    if (!c.purpose) return t('請填寫目的')
    if (c.steps.length === 0) return t('請至少填寫一個步驟')
    if (!it.fixed && !it.brandId) return t('請選擇品牌')
    if (!it.fixed && !it.deptId) return t('請選擇部門')
    return null
  }

  async function translate(it) {
    const from = filled(it.en) && filled(it.zh) ? it.last ?? 'zh' : filled(it.en) ? 'en' : filled(it.zh) ? 'zh' : null
    if (!from) return
    const to = from === 'en' ? 'zh' : 'en'
    if (filled(it[to]) && !window.confirm(t('{lang} 欄位已有內容，翻譯會覆蓋它，要繼續嗎？', { lang: LANG_LABEL[to] }))) return
    patch(it.key, { status: 'translating', error: null })
    try {
      const r = await sopApi.aiTranslate(toContent(it[from]), to)
      patch(it.key, { ...aligned({ ...it, [to]: fromContent(r.content) }), last: from, status: 'idle' })
    } catch (err) {
      patch(it.key, { status: 'idle', error: t(err.message) })
    }
  }

  async function sendAll() {
    setBusy(true)
    for (const it of items) {
      if (it.status === 'done') continue
      const err = problem(it)
      if (err) { patch(it.key, { status: 'error', error: err }); continue }
      patch(it.key, { status: 'sending', error: null })
      const primary = primaryOf(it)
      const other = primary === 'en' ? 'zh' : 'en'
      const payload = {
        content: toContent(it[primary]), lang: primary,
        content_alt: it[other].title.trim() ? toContent(it[other]) : null,
        category_id: null, owner_role_id: null,
        department_id: it.fixed ? it.fixed.deptId : Number(it.deptId),
        brand_ids: it.fixed ? it.fixed.brands.map((b) => b.id) : [Number(it.brandId)],
      }
      try {
        // A draft left over from a failed attempt is updated, not duplicated.
        const id = it.id ?? (await sopApi.create(payload)).id
        if (it.id) await sopApi.update(id, payload)
        patch(it.key, { id })
        await sopApi.submit(id, null, 'manager')
        patch(it.key, { status: 'done' })
      } catch (e) {
        patch(it.key, { status: 'error', error: t(e.message) })
      }
    }
    setBusy(false)
  }

  const pending = items.filter((it) => it.status !== 'done')
  const allDone = items.length > 0 && pending.length === 0
  const noScope = !editId && (brands.length === 0 || depts.length === 0)

  const listField = (it, lang, field, placeholder) => (
    <div className="sop-list">
      {it[lang][field].map((x, i) => (
        <div key={i} className="sop-list-row">
          <span className="sop-list-no">{field === 'steps' ? `${i + 1}.` : '•'}</span>
          <input className="sop-input sop-input--sm" value={field === 'steps' ? x.action : x} placeholder={placeholder} onChange={(e) => editList(it, lang, field, i, e.target.value)} />
          <button type="button" className="sop-link" onClick={() => removeRow(it, field, i)}>✕</button>
        </div>
      ))}
      <button type="button" className="sop-link" onClick={() => addRow(it, field)}>{t('＋ 新增一列')}</button>
    </div>
  )

  return (
    <div className="sop">
      <button type="button" className="sop-link" onClick={onBack}>{t('← 返回')}</button>
      <h2 className="sop-title">{editId ? t('修改並重新送審') : t('新增 SOP')}</h2>
      {loadError && <p className="sop-error">{loadError}</p>}
      <p className="sop-sub">
        {t('可只填一種語言，按「翻譯」由 AI 產生另一種語言。送出後交給：')}
        <strong>{approver === undefined ? '…' : approver ? approver.name : t('（找不到審核者，請聯絡管理員）')}</strong>
      </p>
      <div className="sop-chips" role="group" aria-label={t('顯示語言')}>
        {[['both', t('雙語')], ['en', 'English'], ['zh', '中文']].map(([v, label]) => (
          <button key={v} type="button" className={`sop-chip ${view === v ? 'is-active' : ''}`} onClick={() => chooseView(v)}>{label}</button>
        ))}
      </div>
      {noScope && <p className="sop-error">{t('你的帳號尚未設定品牌或部門，請聯絡管理員。')}</p>}

      {items.map((it, n) => {
        const done = it.status === 'done'
        const locked = done || it.status === 'sending' || it.status === 'translating'
        return (
          <section key={it.key} className={`sop-submit-card ${done ? 'is-done' : ''}`}>
            <div className="sop-section-head">
              <strong>SOP {n + 1}</strong>
              {done
                ? <span className="sop-done is-done">{t('已送出')}</span>
                : items.length > 1 && <button type="button" className="sop-link" disabled={locked} onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}>{t('移除')}</button>}
            </div>

            {!done && (
              <>
                <div className="sop-submit-meta">
                  {it.fixed ? (
                    <>
                      <label>{t('品牌')}<span className="sop-fixed">{it.fixed.brands.length ? it.fixed.brands.map((b) => b.label).join('、') : t('全公司')}</span></label>
                      <label>{t('部門')}<span className="sop-fixed">{it.fixed.dept ?? '—'}</span></label>
                    </>
                  ) : (<>
                  <label>{t('品牌')}
                    {brands.length === 1
                      ? <span className="sop-fixed">{brands[0].label}</span>
                      : <select className="sop-input sop-input--sm" disabled={locked} value={it.brandId} onChange={(e) => patch(it.key, { brandId: e.target.value })}>
                          <option value="">—</option>
                          {brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                        </select>}
                  </label>
                  <label>{t('部門')}
                    {depts.length === 1
                      ? <span className="sop-fixed">{depts[0].label}</span>
                      : <select className="sop-input sop-input--sm" disabled={locked} value={it.deptId} onChange={(e) => patch(it.key, { deptId: e.target.value })}>
                          <option value="">—</option>
                          {depts.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                        </select>}
                  </label>
                  </>)}
                </div>

                <div className={`sop-submit-table ${view === 'both' ? '' : 'sop-submit-table--single'}`}>
                  <div className="sop-submit-row sop-submit-row--head">
                    <span>{t('欄位')}</span>{shown.map((l) => <span key={l}>{l === 'en' ? 'English' : '中文'}</span>)}
                  </div>
                  <div className="sop-submit-row">
                    <span>{t('標題')}</span>
                    {shown.map((l) => <input key={l} className="sop-input sop-input--sm" maxLength={120} disabled={locked} value={it[l].title} onChange={(e) => edit(it, l, { title: e.target.value })} />)}
                  </div>
                  <div className="sop-submit-row">
                    <span>{t('目的')}</span>
                    {shown.map((l) => <textarea key={l} className="sop-input sop-input--sm" rows={3} disabled={locked} value={it[l].purpose} onChange={(e) => edit(it, l, { purpose: e.target.value })} />)}
                  </div>
                  <div className="sop-submit-row">
                    <span>{t('關鍵準則')}</span>
                    {shown.map((l) => <div key={l}>{listField(it, l, 'standards', t('準則'))}</div>)}
                  </div>
                  <div className="sop-submit-row">
                    <span>{t('步驟')}</span>
                    {shown.map((l) => <div key={l}>{listField(it, l, 'steps', t('步驟'))}</div>)}
                  </div>
                </div>

                <div className="sop-nav">
                  <button type="button" className="sop-btn" disabled={locked || !(filled(it.en) || filled(it.zh))} onClick={() => translate(it)}>
                    {it.status === 'translating' ? t('翻譯中…') : t('AI 翻譯')}
                  </button>
                  <span className="sop-sub">{t('由有內容的一側翻譯到另一側')}</span>
                </div>
              </>
            )}
            {it.error && <p className="sop-error">{it.error}</p>}
          </section>
        )
      })}

      {allDone ? (
        <div className="sop-notice">
          {t('全部已送出，等待審核。')} <button type="button" className="sop-link" onClick={onBack}>{t('回到 SOP 列表')}</button>
        </div>
      ) : (
        <div className="sop-nav">
          {!editId && <button type="button" className="sop-btn" disabled={busy} onClick={() => setItems((l) => [...l, newItem(user)])}>{t('＋ 新增一筆 SOP')}</button>}
          <button type="button" className="sop-btn sop-btn--primary" disabled={busy || noScope || !approver || items.some((x) => x.status === 'translating')} onClick={sendAll}>
            {busy ? t('送出中…') : t('送出 {n} 筆給審核者', { n: pending.length })}
          </button>
        </div>
      )}
    </div>
  )
}
