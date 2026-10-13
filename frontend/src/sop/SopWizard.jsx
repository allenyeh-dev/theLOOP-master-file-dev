import { useState } from 'react'
import { sopApi } from '../api/sops'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../i18n/LanguageContext'
import { snap } from './sopLang'

const PAGES_ALL = ['title', 'brands', 'department', 'category', 'purpose', 'steps', 'mistakes', 'review']
// Once a SOP is published its brands / department / section / owner are fixed (they decide who sees the live version).
const PAGES_LOCKED = ['title', 'purpose', 'steps', 'mistakes', 'review']
const EMPTY = { title: '', purpose: '', audience: '', tools: '', steps: [{ action: '', caution: '' }], mistakes: '', effective_date: '' }

export function SopWizard({ sop, initial, initialLang, categories, departments, roles, onCategoryAdded, onDone, onCancel }) {
  const { user } = useAuth()
  const { lang: uiLang, t } = useLang()
  const locked = Boolean(sop?.meta_locked)
  const PAGES = locked ? PAGES_LOCKED : PAGES_ALL
  // The language the content is written in is fixed when the wizard starts.
  const [contentLang] = useState(sop?.lang ?? initialLang ?? uiLang)
  const otherLang = contentLang === 'zh' ? 'en' : 'zh'

  const [content, setContent] = useState(() => {
    const c = { ...EMPTY, ...(sop?.content ?? initial ?? {}) }
    if (!c.steps?.length) c.steps = [{ action: '', caution: '' }]
    return c
  })
  const [alt, setAlt] = useState(sop?.content_alt ?? null)
  const [altSource, setAltSource] = useState(() => (sop?.content_alt ? snap(sop.content) : null))
  const [brandIds, setBrandIds] = useState(sop?.brands?.map((b) => b.id) ?? [])
  const [categoryId, setCategoryId] = useState(sop?.category_id ?? null)
  const [departmentId, setDepartmentId] = useState(sop?.department_id ?? null)
  const [ownerRoleId, setOwnerRoleId] = useState(sop?.owner_role_id ?? null)
  const [page, setPage] = useState(initial ? 'review' : 'title')
  const [stepIdx, setStepIdx] = useState(0)
  const [newCat, setNewCat] = useState('')
  const [review, setReview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = (patch) => setContent((c) => ({ ...c, ...patch }))
  const setStep = (i, patch) => set({ steps: content.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const idx = PAGES.indexOf(page)

  const stepsFilled = content.steps.filter((s) => s.action.trim())
  const cleaned = { ...content, steps: stepsFilled }
  const altStale = Boolean(alt) && altSource !== snap(cleaned)
  const canNext =
    (page === 'title' && content.title.trim()) ||
    (page === 'department' && departmentId) ||
    (page === 'purpose' && content.purpose.trim()) ||
    (page === 'steps' && content.steps[stepIdx]?.action.trim()) ||
    ['brands', 'category', 'mistakes'].includes(page)

  function back() {
    setError(null)
    if (page === 'steps' && stepIdx > 0) return setStepIdx(stepIdx - 1)
    if (idx === 0) return onCancel()
    setPage(PAGES[idx - 1])
  }

  function next() {
    setError(null)
    if (page === 'steps') set({ steps: content.steps.filter((s) => s.action.trim() || s.caution.trim()) })
    setPage(PAGES[idx + 1])
  }

  async function addCategory() {
    if (!newCat.trim()) return
    try {
      const { category } = await sopApi.addCategory(newCat.trim())
      onCategoryAdded(category)
      setCategoryId(category.id)
      setNewCat('')
    } catch (e) {
      setError(e.message)
    }
  }

  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(t(e.message))
    }
    setBusy(false)
  }

  const runCheck = () => run(async () => setReview((await sopApi.aiCheck(cleaned)).review))
  const runTranslate = () =>
    run(async () => {
      const r = await sopApi.aiTranslate(cleaned, otherLang)
      setAlt({ ...r.content, steps: r.content.steps.length ? r.content.steps : [{ action: '', caution: '' }] })
      setAltSource(snap(cleaned))
    })

  async function save(submit) {
    setBusy(true)
    setError(null)
    const payload = {
      category_id: categoryId,
      department_id: departmentId,
      owner_role_id: ownerRoleId,
      brand_ids: brandIds,
      lang: contentLang,
      content: cleaned,
      content_alt: alt && !altStale ? alt : null,
    }
    try {
      const id = sop ? sop.sop_id : (await sopApi.create(payload)).id
      if (sop) await sopApi.update(id, payload)
      const res = submit ? await sopApi.submit(id, review) : null
      onDone(id, submit, res?.translated)
    } catch (e) {
      setError(t(e.message))
      setBusy(false)
    }
  }

  const toggleBrand = (id) => setBrandIds((b) => (b.includes(id) ? b.filter((x) => x !== id) : [...b, id]))

  return (
    <div className="sop-wizard">
      <p className="sop-progress">{t('第 {n} 頁 / 共 {m} 頁', { n: idx + 1, m: PAGES.length })}</p>
      {sop?.mode === 'revise' && <p className="sop-notice">{t('你正在修改已發布的 SOP：送出後需重新簽核，通過前仍顯示目前版本。')}</p>}

      {page === 'title' && (
        <Q label={t('這份 SOP 叫什麼名字？')} hint={t('例如：開店備料流程')}>
          <input className="sop-input" autoFocus value={content.title} onChange={(e) => set({ title: e.target.value })} />
        </Q>
      )}

      {page === 'brands' && (
        <Q label={t('哪些品牌要用？')} hint={t('不選＝全公司都適用')}>
          <div className="sop-choices">
            {user.brands.map((b) => (
              <button type="button" key={b.id} className={`sop-choice ${brandIds.includes(b.id) ? 'is-on' : ''}`} onClick={() => toggleBrand(b.id)}>
                {brandIds.includes(b.id) ? '✓ ' : ''}{b.label}
              </button>
            ))}
          </div>
        </Q>
      )}

      {page === 'department' && (
        <Q label={t('這是哪個部門的？')} hint={t('必選一個')}>
          <div className="sop-choices">
            {departments.map((d) => (
              <button type="button" key={d.id} className={`sop-choice ${departmentId === d.id ? 'is-on' : ''}`} onClick={() => setDepartmentId(d.id)}>
                {departmentId === d.id ? '✓ ' : ''}{d.label}
              </button>
            ))}
          </div>
        </Q>
      )}

      {page === 'category' && (
        <Q label={t('要放在哪個區塊？')} hint={t('找不到可以自己新增')}>
          <div className="sop-choices">
            {categories.map((c) => (
              <button type="button" key={c.id} className={`sop-choice ${categoryId === c.id ? 'is-on' : ''}`} onClick={() => setCategoryId(c.id)}>
                {categoryId === c.id ? '✓ ' : ''}{c.label}
              </button>
            ))}
          </div>
          <div className="sop-inline">
            <input className="sop-input" placeholder={t('新增類別')} value={newCat} onChange={(e) => setNewCat(e.target.value)} maxLength={30} />
            <button type="button" className="sop-btn" onClick={addCategory}>{t('新增')}</button>
          </div>
        </Q>
      )}

      {page === 'purpose' && (
        <Q label={t('為什麼要做這件事？')} hint={t('一兩句話就好')}>
          <textarea className="sop-input" rows={4} autoFocus value={content.purpose} onChange={(e) => set({ purpose: e.target.value })} />
        </Q>
      )}

      {page === 'steps' && (
        <Q label={t('第 {n} 步：要做什麼？', { n: stepIdx + 1 })} hint={t('一次只寫一個動作')}>
          <textarea className="sop-input" rows={3} autoFocus value={content.steps[stepIdx]?.action ?? ''} onChange={(e) => setStep(stepIdx, { action: e.target.value })} />
          <p className="sop-sub">{t('要特別小心的地方（可不填）')}</p>
          <textarea className="sop-input" rows={2} value={content.steps[stepIdx]?.caution ?? ''} onChange={(e) => setStep(stepIdx, { caution: e.target.value })} />
        </Q>
      )}

      {page === 'mistakes' && (
        <Q label={t('常見的錯誤有哪些？')} hint={t('沒有可以直接按下一頁')}>
          <textarea className="sop-input" rows={4} value={content.mistakes} onChange={(e) => set({ mistakes: e.target.value })} />
        </Q>
      )}

      {page === 'review' && (
        <div>
          <h2 className="sop-q">{t('請確認內容')}</h2>
          <Section title={t('名稱')} onEdit={() => setPage('title')} editLabel={t('修改')}>{content.title || '—'}</Section>
          {!locked && (
            <>
              <Section title={t('品牌')} onEdit={() => setPage('brands')} editLabel={t('修改')}>
                {brandIds.length ? user.brands.filter((b) => brandIds.includes(b.id)).map((b) => b.label).join('、') : t('全公司')}
              </Section>
              <Section title={t('部門')} onEdit={() => setPage('department')} editLabel={t('修改')}>{departments.find((d) => d.id === departmentId)?.label ?? '—'}</Section>
              <Section title={t('區塊')} onEdit={() => setPage('category')} editLabel={t('修改')}>{categories.find((c) => c.id === categoryId)?.label ?? '—'}</Section>
              <div className="sop-section">
                <strong>{t('負責人')}</strong>
                <select className="sop-input sop-input--sm" value={ownerRoleId ?? ''} onChange={(e) => setOwnerRoleId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">{t('由系統決定（最後一關簽核者）')}</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                </select>
              </div>
            </>
          )}
          <Section title={t('目的')} onEdit={() => setPage('purpose')} editLabel={t('修改')}>{content.purpose || '—'}</Section>
          <Section title={t('步驟')} onEdit={() => { setStepIdx(0); setPage('steps') }} editLabel={t('修改')}>
            <ol>{stepsFilled.map((s, i) => <li key={i}>{s.action}{s.caution && <em>{t('（注意：{c}）', { c: s.caution })}</em>}</li>)}</ol>
          </Section>
          <Section title={t('常見錯誤')} onEdit={() => setPage('mistakes')} editLabel={t('修改')}>{content.mistakes || '—'}</Section>

          <div className="sop-nav">
            <button type="button" className="sop-btn" onClick={runCheck} disabled={busy}>{busy ? t('檢查中…') : t('AI 幫我檢查')}</button>
            <button type="button" className="sop-btn" onClick={runTranslate} disabled={busy}>
              {busy ? t('翻譯中…') : otherLang === 'en' ? t('翻譯成英文') : t('翻譯成中文')}
            </button>
          </div>
          {review && <AiReview review={review} />}

          {!alt && <p className="sop-sub">{t('送出時會自動翻譯成另一種語言')}</p>}
          {altStale && <p className="sop-error">{t('內容已修改，請重新翻譯')}</p>}
          {alt && !altStale && (
            <div className="sop-alt">
              <h3 className="sop-sub"><strong>{otherLang === 'en' ? t('英文版本（請確認）') : t('中文版本（請確認）')}</strong></h3>
              <AltEditor alt={alt} onChange={setAlt} />
            </div>
          )}
        </div>
      )}

      {error && <p className="sop-error">{error}</p>}

      <div className="sop-nav">
        <button type="button" className="sop-btn" onClick={back} disabled={busy}>{t('← 上一頁')}</button>
        {page === 'steps' && (
          <button type="button" className="sop-btn" disabled={!canNext} onClick={() => { set({ steps: [...content.steps, { action: '', caution: '' }] }); setStepIdx(stepIdx + 1) }}>
            {t('＋ 再加一步')}
          </button>
        )}
        {page !== 'review' ? (
          <button type="button" className="sop-btn sop-btn--primary" disabled={!canNext} onClick={next}>
            {page === 'steps' ? t('沒有了，下一頁 →') : t('下一頁 →')}
          </button>
        ) : (
          <>
            <button type="button" className="sop-btn" onClick={() => save(false)} disabled={busy}>{t('存成草稿')}</button>
            <button type="button" className="sop-btn sop-btn--primary" onClick={() => save(true)} disabled={busy}>{busy ? t('送出中（翻譯中）…') : t('確認送出')}</button>
          </>
        )}
      </div>
    </div>
  )
}

function Q({ label, hint, children }) {
  return (
    <div>
      <h2 className="sop-q">{label}</h2>
      {hint && <p className="sop-sub">{hint}</p>}
      {children}
    </div>
  )
}

function Section({ title, onEdit, editLabel, children }) {
  return (
    <div className="sop-section">
      <div className="sop-section-head"><strong>{title}</strong><button type="button" className="sop-link" onClick={onEdit}>{editLabel}</button></div>
      <div>{children}</div>
    </div>
  )
}

// The translated copy is editable so the author can fix it before it is saved.
function AltEditor({ alt, onChange }) {
  const set = (patch) => onChange({ ...alt, ...patch })
  const setStep = (i, patch) => set({ steps: alt.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  return (
    <div>
      <input className="sop-input sop-input--sm" value={alt.title} onChange={(e) => set({ title: e.target.value })} />
      <textarea className="sop-input sop-input--sm" rows={2} value={alt.purpose} onChange={(e) => set({ purpose: e.target.value })} />
      {alt.steps.map((s, i) => (
        <div key={i}>
          <textarea className="sop-input sop-input--sm" rows={2} value={s.action} onChange={(e) => setStep(i, { action: e.target.value })} />
          <textarea className="sop-input sop-input--sm" rows={1} value={s.caution} onChange={(e) => setStep(i, { caution: e.target.value })} />
        </div>
      ))}
      <textarea className="sop-input sop-input--sm" rows={2} value={alt.mistakes} onChange={(e) => set({ mistakes: e.target.value })} />
    </div>
  )
}

export function AiReview({ review }) {
  const { t } = useLang()
  return (
    <div className="sop-ai">
      <p><strong>{t('AI 建議（僅供參考）')}</strong></p>
      {review.issues.length === 0 ? <p>{t('看起來沒有明顯問題')}</p> : (
        <ul>{review.issues.map((i, n) => <li key={n}><strong>{i.field}</strong>：{i.problem} → {i.suggestion}</li>)}</ul>
      )}
    </div>
  )
}
