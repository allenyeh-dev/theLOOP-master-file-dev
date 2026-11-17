import { useState } from 'react'
import { useLang } from '../i18n/LanguageContext'
import { downloadTemplate, readDocxText } from './templateDocx'
import { parseTemplate, warningText } from './templateParser'

// "Download the Word template, fill it in, upload it": the file goes straight into the form, no AI step.
// brands / departments: the options offered to this user (objects with a `label`); defaultBrand: the label pre-ticked in the template.
// onParsed(result, fileName) fills the form and may return extra notes (strings) to show under the box.
// onText(text, fileName) is optional: called with the plain text of a Word file that is not the template, e.g. to hand it to AI.
// variant: 'sop' (staff pages) or 'cs' (admin console) only changes the CSS classes.
export function TemplateUpload({ kind, variant = 'sop', multiple = true, brands = [], defaultBrand, departments = [], onParsed, onText }) {
  const { t } = useLang()
  const [msgs, setMsgs] = useState([])
  const [busy, setBusy] = useState(false)
  const labels = { brands: brands.map((b) => b.label), departments: departments.map((d) => d.label) }
  const cls = variant === 'cs'
    ? { box: 'cs-form', btn: 'cs-btn', link: 'cs-link', note: 'cs-muted', err: 'cs-error' }
    : { box: 'sop-ai-box', btn: 'sop-btn sop-btn--sm', link: 'sop-link', note: 'sop-sub', err: 'sop-error' }

  async function pick(e) {
    const files = [...(e.target.files ?? [])]
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    const out = []
    for (const f of files) {
      let r = null
      try {
        r = await parseTemplate(f, kind, labels)
      } catch {
        out.push({ ok: false, text: `${f.name}: ${t('Please upload the Word template (.docx).')}` })
        continue
      }
      if (r) {
        const extra = (await onParsed(r, f.name)) ?? []
        out.push({ ok: true, text: `${f.name}: ${t('Filled into the form — please check it before sending.')}`, notes: [...r.warnings.map((w) => warningText(w, t)), ...extra] })
      } else if (onText) {
        onText(readDocxText(await f.arrayBuffer()), f.name)
        out.push({ ok: false, text: `${f.name}: ${t('The template was not filled in, so the document text was put in the AI box instead.')}` })
      } else {
        out.push({ ok: false, text: `${f.name}: ${t('Nothing to import — the template was not filled in. Replace the grey example text and upload it again.')}` })
      }
    }
    setMsgs(out)
    setBusy(false)
  }

  return (
    <>
      <details className={cls.box}>
        <summary style={{ cursor: 'pointer' }}>{t('Template · Upload')}</summary>
        <div className={variant === 'cs' ? 'cs-toolbar' : 'sop-nav'}>
          <button type="button" className={cls.link} onClick={() => downloadTemplate(kind, { brands: labels.brands, defaultBrand, departments: labels.departments })}>{t('Download template (Word)')}</button>
          <label className={`${cls.btn} ${variant === 'cs' ? '' : 'sop-file'}`}>
            {busy ? t('Reading…') : multiple ? t('Upload filled template(s)') : t('Upload filled template')}
            <input type="file" hidden multiple={multiple} disabled={busy} accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={pick} />
          </label>
        </div>
      </details>
      {/* Results stay outside the collapsed box so they are visible after an upload. */}
      {msgs.map((m, i) => (
        <div key={i}>
          <p className={m.ok ? cls.note : cls.err}>{m.text}</p>
          {m.notes?.length > 0 && <ul className={cls.note}>{m.notes.map((n, j) => <li key={j}>{n}</li>)}</ul>}
        </div>
      ))}
    </>
  )
}
