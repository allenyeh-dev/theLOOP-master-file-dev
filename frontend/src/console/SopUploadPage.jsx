import { useEffect, useState } from 'react'
import { consoleApi } from '../api/console'
import { sopApi, sopImageUrl, uploadSopImage } from '../api/sops'
import { Field, LangToggle, PageHead } from './ui'
import { useLang } from '../i18n/LanguageContext'
import { ManageOptionsModal } from './ManageOptionsModal'
import { SopVersionHistory } from './SopVersionHistory'

const MAX_STEP_IMAGES = 4
const EMPTY = { title: '', purpose: '', audience: '', tools: '', standards: [''], steps: [{ action: '', caution: '', images: [] }], mistakes: '', notes: '', effective_date: '' }
const LANGS = ['zh', 'en']
const norm = (c) => ({
  ...EMPTY, ...c,
  standards: c.standards?.length ? c.standards : EMPTY.standards,
  steps: c.steps?.length ? c.steps.map((st) => ({ ...st, images: st.images ?? [] })) : EMPTY.steps,
})
const emptyMeta = { lang: 'zh', category_id: '', department_id: '', owner_role_id: '', brand_sel: '' }

// A new SOP is written in Chinese if its text contains CJK characters, otherwise English.
const detectLang = (c) => (/[\u3400-\u9fff]/.test([c.title, c.purpose, ...c.standards, ...c.steps.map((st) => st.action)].join('')) ? 'zh' : 'en')

// Create mode (no editId) or edit mode: load an existing SOP, change it (e.g. add images) and publish the new version.
// A SOP holds up to two language versions; the page language (EN / 中文 toggle) picks which one the form shows and edits.
export function SopUploadPage({ editId = null, onBack = null }) {
  const { t, lang, setLang } = useLang()
  const [refs, setRefs] = useState({ brands: [], categories: [], departments: [], roles: [] })
  const [source, setSource] = useState('')
  const [docs, setDocs] = useState({ zh: null, en: null })
  const [dirty, setDirty] = useState({ zh: false, en: false })
  const content = docs[lang] ?? EMPTY
  const setContent = (fn) => {
    setDocs((d) => ({ ...d, [lang]: fn(d[lang] ?? EMPTY) }))
    setDirty((d) => ({ ...d, [lang]: true }))
  }
  const [meta, setMeta] = useState(emptyMeta)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)
  const [locked, setLocked] = useState(false)
  const [manage, setManage] = useState(false)
  const [rev, setRev] = useState(0) // bumped after a restore to reload the form and the history
  const [keptBrands, setKeptBrands] = useState([]) // brands of an existing multi-brand SOP, which one dropdown cannot show

  useEffect(() => {
    Promise.all([consoleApi.listBrands(), consoleApi.listSopCategories(), sopApi.departments(), sopApi.roles()])
      .then(([b, c, d, r]) => setRefs({ brands: b.brands, categories: c.categories, departments: d.departments, roles: r.roles }))
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!editId) return
    sopApi.edit(editId)
      .then(({ sop }) => {
        setDocs({ zh: null, en: null, [sop.lang]: norm(sop.content), ...(sop.content_alt && { [sop.lang === 'en' ? 'zh' : 'en']: norm(sop.content_alt) }) })
        setDirty({ zh: false, en: false })
        setMeta({
          lang: sop.lang, category_id: sop.category_id ?? '', department_id: sop.department_id ?? '',
          owner_role_id: sop.owner_role_id ?? '',
          brand_sel: sop.brands.length === 0 ? 'all' : sop.brands.length === 1 ? String(sop.brands[0].id) : 'keep',
        })
        setKeptBrands(sop.brands)
        setLocked(sop.meta_locked)
      })
      .catch((e) => setError(e.message))
  }, [editId, rev])

  // Reload the category list after the Manage dialog changed it; drop a selection that no longer exists.
  async function reloadLists() {
    const { categories } = await consoleApi.listSopCategories()
    setRefs((r) => ({ ...r, categories }))
    setMeta((m) => ({ ...m, category_id: categories.some((x) => String(x.id) === String(m.category_id)) ? m.category_id : '' }))
  }

  const setC = (patch) => setContent((c) => ({ ...c, ...patch }))
  const setStep = (i, patch) => setC({ steps: content.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  const setStandard = (i, v) => setC({ standards: content.standards.map((x, j) => (j === i ? v : x)) })
  const num = (v) => (v === '' ? null : Number(v))

  async function pickFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSource(await file.text())
    if (!content.title) setC({ title: file.name.replace(/\.[^.]+$/, '') })
    e.target.value = ''
  }

  async function addImages(i, e) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (!files.length) return
    setBusy(`img${i}`); setError(null)
    try {
      const ids = []
      for (const f of files.slice(0, MAX_STEP_IMAGES - content.steps[i].images.length)) ids.push(await uploadSopImage(f))
      setStep(i, { images: [...content.steps[i].images, ...ids] })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function structure() {
    setBusy('ai'); setError(null)
    try {
      const r = await sopApi.aiStructure(source)
      setDocs((d) => ({ ...d, [r.lang]: norm(r.content) }))
      setDirty((d) => ({ ...d, [r.lang]: true }))
      setMeta((m) => ({ ...m, lang: r.lang }))
      setLang(r.lang)
    } catch (err) {
      setError(`${err.message} — ${t('you can still fill in the form below by hand.')}`)
    } finally {
      setBusy(null)
    }
  }

  async function save(publish) {
    setBusy(publish ? 'publish' : 'save'); setError(null)
    try {
      // The author's language is kept as is; the other one is sent only if it can still be trusted
      // (edited itself, or the original was not touched) — otherwise it is re-translated on publish.
      const filled = LANGS.filter((l) => docs[l]?.title.trim())
      const primary = editId ? meta.lang : filled.length === 1 ? detectLang(docs[filled[0]]) : filled.includes(lang) ? lang : filled[0]
      const other = primary === 'en' ? 'zh' : 'en'
      const alt = filled.length > 1 && docs[other]?.title.trim() && (dirty[other] || !dirty[primary]) ? docs[other] : null
      const payload = {
        content: docs[primary], content_alt: alt, lang: primary,
        category_id: num(meta.category_id), department_id: num(meta.department_id), owner_role_id: num(meta.owner_role_id),
        brand_ids: meta.brand_sel === 'keep' ? keptBrands.map((b) => b.id) : meta.brand_sel && meta.brand_sel !== 'all' ? [Number(meta.brand_sel)] : [],
      }
      const id = editId ? (await sopApi.update(editId, payload), editId) : (await sopApi.create(payload)).id
      if (publish) await sopApi.publish(id)
      if (editId) { onBack(); return }
      setDone({ id, published: publish })
      setDocs({ zh: null, en: null }); setDirty({ zh: false, en: false }); setMeta(emptyMeta); setSource('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const canSave = editId ? Boolean(docs[meta.lang]?.title.trim()) : LANGS.some((l) => docs[l]?.title.trim())

  return (
    <>
      {editId
        ? <PageHead title={t('SOP · Edit')} subtitle={t('Change the content or add images, then publish. Publishing replaces the live version.')} action={<div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}><LangToggle /><button type="button" className="cs-btn" onClick={onBack}>{t('← Back')}</button></div>} />
        : <PageHead title={t('SOP · Create')} subtitle="" action={<div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}><LangToggle />{onBack && <button type="button" className="cs-btn" onClick={onBack}>{t('← Back')}</button>}</div>} />}
      {done && !editId && (
        <p className="cs-muted">
          {done.published ? t('Saved SOP #{id} and published it — it is live on the SOP page now.', { id: done.id }) : t('Saved SOP #{id} as a draft. It is not visible to anyone until you publish it.', { id: done.id })}
        </p>
      )}

      <div className="cs-form" style={{ maxWidth: '52rem' }}>
        {!docs[lang] && LANGS.some((l) => docs[l]) && <p className="cs-muted">{t('No version in this language yet — fill it in, or leave it empty to have it translated when you publish.')}</p>}
        <div className="cs-form-row">
          <Field label={t('Brand')} hint={t('Blank or All = company-wide.')}>
            <select disabled={locked} value={meta.brand_sel} onChange={(e) => setMeta({ ...meta, brand_sel: e.target.value })}>
              <option value="">—</option>
              <option value="all">{t('All')}</option>
              {keptBrands.length > 1 && <option value="keep">{keptBrands.map((b) => b.label).join(', ')}</option>}
              {refs.brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </Field>
          <Field label={t('Owner role')} hint={t('Blank = last approver role.')}>
            <select disabled={locked} value={meta.owner_role_id} onChange={(e) => setMeta({ ...meta, owner_role_id: e.target.value })}>
              <option value="">—</option>
              {refs.roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="cs-form-row">
          <Field label={t('Department')} hint={t('Required to publish; sets the SOP number and who sees it.')}>
            <select disabled={locked} value={meta.department_id} onChange={(e) => setMeta({ ...meta, department_id: e.target.value })}>
              <option value="">—</option>
              {[...refs.departments].sort((a, b) => (b.key === 'General') - (a.key === 'General')).map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </Field>
          <Field label={t('Category')}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <select style={{ flex: 1 }} disabled={locked} value={meta.category_id} onChange={(e) => setMeta({ ...meta, category_id: e.target.value })}>
                <option value="">—</option>
                {refs.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <button type="button" className="cs-link" onClick={() => setManage(true)}>{t('Manage')}</button>
            </div>
          </Field>
        </div>
        <Field label={t('Title')}><input value={content.title} onChange={(e) => setC({ title: e.target.value })} maxLength={120} /></Field>
        <Field label={t('Purpose')}><textarea rows={3} value={content.purpose} onChange={(e) => setC({ purpose: e.target.value })} /></Field>
        <Field label={t('Key standards')}>
          <div className="cs-form">
            {content.standards.map((x, i) => (
              <div key={i} className="cs-form-row" style={{ gridTemplateColumns: '2rem 1fr auto' }}>
                <span className="cs-muted">•</span>
                <input value={x} onChange={(e) => setStandard(i, e.target.value)} placeholder={t('Standard')} />
                <button type="button" className="cs-link cs-link--danger" disabled={content.standards.length === 1} onClick={() => setC({ standards: content.standards.filter((_, j) => j !== i) })}>{t('Remove')}</button>
              </div>
            ))}
            <div><button type="button" className="cs-link" onClick={() => setC({ standards: [...content.standards, ''] })}>{t('+ Add standard')}</button></div>
          </div>
        </Field>
        {content.tools && <Field label={t('Tools / ingredients')}><input value={content.tools} onChange={(e) => setC({ tools: e.target.value })} /></Field>}

        <Field label={t('Steps')}>
          <div className="cs-form">
            {content.steps.map((s, i) => (
              <div key={i}>
                <div className="cs-form-row" style={{ gridTemplateColumns: '2rem 2fr 1fr auto' }}>
                  <span className="cs-muted">{i + 1}.</span>
                  <input value={s.action} onChange={(e) => setStep(i, { action: e.target.value })} placeholder={t('Action')} />
                  <input value={s.caution} onChange={(e) => setStep(i, { caution: e.target.value })} placeholder={t('Caution (optional)')} />
                  <button type="button" className="cs-link cs-link--danger" disabled={content.steps.length === 1} onClick={() => setC({ steps: content.steps.filter((_, j) => j !== i) })}>{t('Remove')}</button>
                </div>
                <div className="cs-chips" style={{ marginLeft: '2rem', alignItems: 'center' }}>
                  {s.images.map((id) => (
                    <span key={id} style={{ position: 'relative' }}>
                      <img src={sopImageUrl(id)} alt="" style={{ height: '4.5rem', borderRadius: 6, display: 'block' }} />
                      <button type="button" className="cs-icon-btn" aria-label={t('Remove image')} style={{ position: 'absolute', top: 0, right: 0 }} onClick={() => setStep(i, { images: s.images.filter((x) => x !== id) })}>×</button>
                    </span>
                  ))}
                  {s.images.length < MAX_STEP_IMAGES && (
                    <label className="cs-link" style={{ cursor: 'pointer' }}>
                      {busy === `img${i}` ? t('Uploading…') : t('+ Add image')}
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={!!busy} onChange={(e) => addImages(i, e)} />
                    </label>
                  )}
                </div>
              </div>
            ))}
            <div><button type="button" className="cs-link" onClick={() => setC({ steps: [...content.steps, { action: '', caution: '', images: [] }] })}>{t('+ Add step')}</button></div>
          </div>
        </Field>
        {content.mistakes && <Field label={t('Common mistakes')}><textarea rows={2} value={content.mistakes} onChange={(e) => setC({ mistakes: e.target.value })} /></Field>}
        <Field label={t('Submission notes')} hint={t('Anything unclear, unsure, or marked NEEDS CONFIRMATION.')}>
          <textarea rows={2} value={content.notes} onChange={(e) => setC({ notes: e.target.value })} />
        </Field>


        {error && <p className="cs-error">{error}</p>}
        <div className="cs-toolbar">
          <button type="button" className="cs-btn" onClick={() => save(false)} disabled={busy || !canSave}>{busy === 'save' ? t('Saving…') : t('Save as draft')}</button>
          <button type="button" className="cs-btn cs-btn--primary" onClick={() => save(true)} disabled={busy || !canSave}>{busy === 'publish' ? t('Publishing…') : t('Save & publish')}</button>
        </div>
        {!editId && (
          <details className="cs-form">
            <summary style={{ cursor: 'pointer' }}>{t('Source text · Structure with AI')}</summary>
            <Field label={t('Source text')} hint={t('Optional. AI turns raw text into the fixed SOP format; you review everything before saving.')}>
              <textarea rows={8} value={source} onChange={(e) => setSource(e.target.value)} placeholder={t('Paste SOP text here…')} />
            </Field>
            <div className="cs-toolbar">
              <label className="cs-btn">
                {t('Choose file…')}
                <input type="file" accept=".md,.markdown,.txt,text/plain,text/markdown" onChange={pickFile} hidden />
              </label>
              <button type="button" className="cs-btn" onClick={structure} disabled={busy || source.trim().length < 10}>
                {busy === 'ai' ? t('Structuring…') : t('Structure with AI')}
              </button>
              <a className="cs-link" href="/sop-templates/sop-template-zh.md" download>Template (繁中)</a>
              <a className="cs-link" href="/sop-templates/sop-template-en.md" download>Template (EN)</a>
            </div>
          </details>
        )}
      </div>
      {editId && (
        <details style={{ maxWidth: '52rem', marginTop: '1.5rem' }}>
          <summary style={{ cursor: 'pointer' }}>{t('Version history')}</summary>
          <SopVersionHistory sopId={editId} refreshKey={rev} onRestored={() => setRev((r) => r + 1)} />
        </details>
      )}
      {manage && (
        <ManageOptionsModal
          title={t('Manage categories')} items={refs.categories} onClose={() => setManage(false)} onChanged={reloadLists}
          api={{ create: consoleApi.createSopCategory, update: consoleApi.updateSopCategory, remove: consoleApi.deleteSopCategory }}
        />
      )}
    </>
  )
}
