import { useEffect, useState } from 'react'
import { consoleApi } from '../api/console'
import { sopApi } from '../api/sops'
import { Field, PageHead } from './ui'

const EMPTY = { title: '', purpose: '', audience: '', tools: '', steps: [{ action: '', caution: '' }], mistakes: '', effective_date: '' }
const emptyMeta = { lang: 'zh', category_id: '', department_id: '', owner_role_id: '', brand_ids: [] }

export function SopUploadPage() {
  const [refs, setRefs] = useState({ brands: [], categories: [], departments: [], roles: [] })
  const [source, setSource] = useState('')
  const [content, setContent] = useState(EMPTY)
  const [meta, setMeta] = useState(emptyMeta)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)

  useEffect(() => {
    Promise.all([consoleApi.listBrands(), sopApi.categories(), sopApi.departments(), sopApi.roles()])
      .then(([b, c, d, r]) => setRefs({ brands: b.brands, categories: c.categories, departments: d.departments, roles: r.roles }))
      .catch((e) => setError(e.message))
  }, [])

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

  async function structure() {
    setBusy('ai'); setError(null)
    try {
      const r = await sopApi.aiStructure(source)
      setContent({ ...EMPTY, ...r.content, steps: r.content.steps.length ? r.content.steps : EMPTY.steps })
      setMeta((m) => ({ ...m, lang: r.lang }))
    } catch (err) {
      setError(`${err.message} — you can still fill in the form below by hand.`)
    } finally {
      setBusy(null)
    }
  }

  async function save(submit) {
    setBusy(submit ? 'submit' : 'save'); setError(null)
    try {
      const { id } = await sopApi.create({
        content, lang: meta.lang,
        category_id: num(meta.category_id), department_id: num(meta.department_id), owner_role_id: num(meta.owner_role_id),
        brand_ids: meta.brand_ids,
      })
      if (submit) await sopApi.submit(id)
      setDone({ id, submitted: submit })
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
      <PageHead title="SOP · Upload" subtitle="Upload a .md / .txt file or paste text, let AI fill the SOP format, then save it as a draft or send it for approval." />
      {done && (
        <p className="cs-muted">
          Saved SOP #{done.id} {done.submitted ? 'and sent for approval' : 'as a draft'}. It goes live once the approval chain finishes — open it from the SOP page.
        </p>
      )}

      <div className="cs-form" style={{ maxWidth: '52rem' }}>
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
        </div>

        <Field label="Title"><input value={content.title} onChange={(e) => setC({ title: e.target.value })} maxLength={120} /></Field>
        <Field label="Purpose"><textarea rows={3} value={content.purpose} onChange={(e) => setC({ purpose: e.target.value })} /></Field>
        <div className="cs-form-row">
          <Field label="Audience"><input value={content.audience} onChange={(e) => setC({ audience: e.target.value })} /></Field>
          <Field label="Tools / ingredients"><input value={content.tools} onChange={(e) => setC({ tools: e.target.value })} /></Field>
        </div>

        <Field label="Steps">
          <div className="cs-form">
            {content.steps.map((s, i) => (
              <div className="cs-form-row" key={i} style={{ gridTemplateColumns: '2rem 2fr 1fr auto' }}>
                <span className="cs-muted">{i + 1}.</span>
                <input value={s.action} onChange={(e) => setStep(i, { action: e.target.value })} placeholder="Action" />
                <input value={s.caution} onChange={(e) => setStep(i, { caution: e.target.value })} placeholder="Caution (optional)" />
                <button type="button" className="cs-link cs-link--danger" disabled={content.steps.length === 1} onClick={() => setC({ steps: content.steps.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            ))}
            <div><button type="button" className="cs-link" onClick={() => setC({ steps: [...content.steps, { action: '', caution: '' }] })}>+ Add step</button></div>
          </div>
        </Field>
        <Field label="Common mistakes"><textarea rows={2} value={content.mistakes} onChange={(e) => setC({ mistakes: e.target.value })} /></Field>

        <div className="cs-form-row">
          <Field label="Department" hint="Required to submit; sets the SOP number and who sees it.">
            <select value={meta.department_id} onChange={(e) => setMeta({ ...meta, department_id: e.target.value })}>
              <option value="">—</option>
              {refs.departments.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select value={meta.category_id} onChange={(e) => setMeta({ ...meta, category_id: e.target.value })}>
              <option value="">—</option>
              {refs.categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="cs-form-row">
          <Field label="Language of the text">
            <select value={meta.lang} onChange={(e) => setMeta({ ...meta, lang: e.target.value })}>
              <option value="zh">繁體中文</option>
              <option value="en">English</option>
            </select>
          </Field>
          <Field label="Owner role" hint="Blank = last approver role.">
            <select value={meta.owner_role_id} onChange={(e) => setMeta({ ...meta, owner_role_id: e.target.value })}>
              <option value="">—</option>
              {refs.roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Brands" hint="None selected = company-wide.">
          <div className="cs-chips">
            {refs.brands.map((b) => (
              <label key={b.id} className="cs-chip" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={meta.brand_ids.includes(b.id)} onChange={() => toggleBrand(b.id)} /> {b.label}
              </label>
            ))}
          </div>
        </Field>

        {error && <p className="cs-error">{error}</p>}
        <div className="cs-toolbar">
          <button type="button" className="cs-btn" onClick={() => save(false)} disabled={busy || !content.title.trim()}>{busy === 'save' ? 'Saving…' : 'Save as draft'}</button>
          <button type="button" className="cs-btn cs-btn--primary" onClick={() => save(true)} disabled={busy || !content.title.trim()}>{busy === 'submit' ? 'Submitting…' : 'Save & submit for approval'}</button>
        </div>
      </div>
    </>
  )
}
