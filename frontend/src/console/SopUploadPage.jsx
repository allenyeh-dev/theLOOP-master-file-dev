import { useEffect, useState } from 'react'
import { consoleApi } from '../api/console'
import { sopApi, sopImageUrl, uploadSopImage } from '../api/sops'
import { Field, PageHead } from './ui'

const MAX_STEP_IMAGES = 4
const EMPTY = { title: '', purpose: '', audience: '', tools: '', steps: [{ action: '', caution: '', images: [] }], mistakes: '', effective_date: '' }
const emptyMeta = { lang: 'zh', category_id: '', department_id: '', owner_role_id: '', brand_ids: [] }

// Create mode (no editId) or edit mode: load an existing SOP, change it (e.g. add images) and publish the new version.
export function SopUploadPage({ editId = null, onBack = null }) {
  const [refs, setRefs] = useState({ brands: [], categories: [], departments: [], roles: [] })
  const [source, setSource] = useState('')
  const [content, setContent] = useState(EMPTY)
  const [meta, setMeta] = useState(emptyMeta)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    Promise.all([consoleApi.listBrands(), sopApi.categories(), sopApi.departments(), sopApi.roles()])
      .then(([b, c, d, r]) => setRefs({ brands: b.brands, categories: c.categories, departments: d.departments, roles: r.roles }))
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!editId) return
    sopApi.edit(editId)
      .then(({ sop }) => {
        setContent({ ...EMPTY, ...sop.content, steps: sop.content.steps?.length ? sop.content.steps.map((st) => ({ ...st, images: st.images ?? [] })) : EMPTY.steps })
        setMeta({
          lang: sop.lang, category_id: sop.category_id ?? '', department_id: sop.department_id ?? '',
          owner_role_id: sop.owner_role_id ?? '', brand_ids: sop.brands.map((b) => b.id),
        })
        setLocked(sop.meta_locked)
      })
      .catch((e) => setError(e.message))
  }, [editId])

  const setC = (patch) => setContent((c) => ({ ...c, ...patch }))
  const setStep = (i, patch) => setC({ steps: content.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
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
      setContent({ ...EMPTY, ...r.content, steps: r.content.steps.length ? r.content.steps.map((st) => ({ ...st, images: st.images ?? [] })) : EMPTY.steps })
      setMeta((m) => ({ ...m, lang: r.lang }))
    } catch (err) {
      setError(`${err.message} — you can still fill in the form below by hand.`)
    } finally {
      setBusy(null)
    }
  }

  async function save(publish) {
    setBusy(publish ? 'publish' : 'save'); setError(null)
    try {
      const payload = {
        content, lang: meta.lang,
        category_id: num(meta.category_id), department_id: num(meta.department_id), owner_role_id: num(meta.owner_role_id),
        brand_ids: meta.brand_ids,
      }
      const id = editId ? (await sopApi.update(editId, payload), editId) : (await sopApi.create(payload)).id
      if (publish) await sopApi.publish(id)
      if (editId) { onBack(); return }
      setDone({ id, published: publish })
      setContent(EMPTY); setMeta(emptyMeta); setSource('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  const toggleBrand = (id) => setMeta((m) => ({ ...m, brand_ids: m.brand_ids.includes(id) ? m.brand_ids.filter((b) => b !== id) : [...m.brand_ids, id] }))

  return (
    <>
      {editId
        ? <PageHead title="SOP · Edit" subtitle="Change the content or add images, then publish. Publishing replaces the live version." action={<button type="button" className="cs-btn" onClick={onBack}>← Back</button>} />
        : <PageHead title="SOP · Upload" subtitle="Upload a .md / .txt file or paste text, let AI fill the SOP format, then publish it right away or save it as a draft." />}
      {done && !editId && (
        <p className="cs-muted">
          Saved SOP #{done.id} {done.published ? 'and published it — it is live on the SOP page now.' : 'as a draft. It is not visible to anyone until you publish it.'}
        </p>
      )}

      <div className="cs-form" style={{ maxWidth: '52rem' }}>
        {!editId && <>
        <Field label="Source text" hint="Optional. AI turns raw text into the fixed SOP format; you review everything before saving.">
          <textarea rows={8} value={source} onChange={(e) => setSource(e.target.value)} placeholder="Paste SOP text here…" />
        </Field>
        <div className="cs-toolbar">
          <label className="cs-btn">
            Choose file…
            <input type="file" accept=".md,.markdown,.txt,text/plain,text/markdown" onChange={pickFile} hidden />
          </label>
          <button type="button" className="cs-btn" onClick={structure} disabled={busy || source.trim().length < 10}>
            {busy === 'ai' ? 'Structuring…' : 'Structure with AI'}
          </button>
          <a className="cs-link" href="/sop-templates/sop-template-zh.md" download>Template (繁中)</a>
          <a className="cs-link" href="/sop-templates/sop-template-en.md" download>Template (EN)</a>
        </div>

        </>}
        <Field label="Title"><input value={content.title} onChange={(e) => setC({ title: e.target.value })} maxLength={120} /></Field>
        <Field label="Purpose"><textarea rows={3} value={content.purpose} onChange={(e) => setC({ purpose: e.target.value })} /></Field>
        <div className="cs-form-row">
          <Field label="Audience"><input value={content.audience} onChange={(e) => setC({ audience: e.target.value })} /></Field>
          <Field label="Tools / ingredients"><input value={content.tools} onChange={(e) => setC({ tools: e.target.value })} /></Field>
        </div>

        <Field label="Steps">
          <div className="cs-form">
            {content.steps.map((s, i) => (
              <div key={i}>
                <div className="cs-form-row" style={{ gridTemplateColumns: '2rem 2fr 1fr auto' }}>
                  <span className="cs-muted">{i + 1}.</span>
                  <input value={s.action} onChange={(e) => setStep(i, { action: e.target.value })} placeholder="Action" />
                  <input value={s.caution} onChange={(e) => setStep(i, { caution: e.target.value })} placeholder="Caution (optional)" />
                  <button type="button" className="cs-link cs-link--danger" disabled={content.steps.length === 1} onClick={() => setC({ steps: content.steps.filter((_, j) => j !== i) })}>Remove</button>
                </div>
                <div className="cs-chips" style={{ marginLeft: '2rem', alignItems: 'center' }}>
                  {s.images.map((id) => (
                    <span key={id} style={{ position: 'relative' }}>
                      <img src={sopImageUrl(id)} alt="" style={{ height: '4.5rem', borderRadius: 6, display: 'block' }} />
                      <button type="button" className="cs-icon-btn" aria-label="Remove image" style={{ position: 'absolute', top: 0, right: 0 }} onClick={() => setStep(i, { images: s.images.filter((x) => x !== id) })}>×</button>
                    </span>
                  ))}
                  {s.images.length < MAX_STEP_IMAGES && (
                    <label className="cs-link" style={{ cursor: 'pointer' }}>
                      {busy === `img${i}` ? 'Uploading…' : '+ Add image'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden disabled={!!busy} onChange={(e) => addImages(i, e)} />
                    </label>
                  )}
                </div>
              </div>
            ))}
            <div><button type="button" className="cs-link" onClick={() => setC({ steps: [...content.steps, { action: '', caution: '', images: [] }] })}>+ Add step</button></div>
          </div>
        </Field>
        <Field label="Common mistakes"><textarea rows={2} value={content.mistakes} onChange={(e) => setC({ mistakes: e.target.value })} /></Field>

        <div className="cs-form-row">
          <Field label="Department" hint="Required to publish; sets the SOP number and who sees it.">
            <select disabled={locked} value={meta.department_id} onChange={(e) => setMeta({ ...meta, department_id: e.target.value })}>
              <option value="">—</option>
              {refs.departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select disabled={locked} value={meta.category_id} onChange={(e) => setMeta({ ...meta, category_id: e.target.value })}>
              <option value="">—</option>
              {refs.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="cs-form-row">
          <Field label="Language of the text">
            <select disabled={!!editId} value={meta.lang} onChange={(e) => setMeta({ ...meta, lang: e.target.value })}>
              <option value="zh">繁體中文</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label="Owner role" hint="Blank = last approver role.">
            <select disabled={locked} value={meta.owner_role_id} onChange={(e) => setMeta({ ...meta, owner_role_id: e.target.value })}>
              <option value="">—</option>
              {refs.roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Brands" hint="None selected = company-wide.">
          <div className="cs-chips">
            {refs.brands.map((b) => (
              <label key={b.id} className="cs-chip" style={{ cursor: 'pointer' }}>
                <input type="checkbox" disabled={locked} checked={meta.brand_ids.includes(b.id)} onChange={() => toggleBrand(b.id)} /> {b.label}
              </label>
            ))}
          </div>
        </Field>

        {error && <p className="cs-error">{error}</p>}
        <div className="cs-toolbar">
          <button type="button" className="cs-btn" onClick={() => save(false)} disabled={busy || !content.title.trim()}>{busy === 'save' ? 'Saving…' : 'Save as draft'}</button>
          <button type="button" className="cs-btn cs-btn--primary" onClick={() => save(true)} disabled={busy || !content.title.trim()}>{busy === 'publish' ? 'Publishing…' : 'Save & publish'}</button>
        </div>
      </div>
    </>
  )
}
