import { useState } from 'react'
import { useLang } from '../i18n/LanguageContext'
import { parseTemplate, templateLinks, warningText } from './templateParser'

// "Download the template, fill it in, upload it": the file goes straight into the form, no AI step.
// onParsed(result, fileName) fills the form and may return extra notes (strings) to show under the box.
// onText(text, fileName) is optional: called for a file that is not the template (free text), e.g. to hand it to AI.
// variant: 'sop' (staff pages) or 'cs' (admin console) only changes the CSS classes.
export function TemplateUpload({ kind, variant = 'sop', multiple = true, onParsed, onText }) {
  const { t } = useLang()
  const [msgs, setMsgs] = useState([])
  const [busy, setBusy] = useState(false)
  const links = templateLinks[kind]
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
      let text = ''
      try {
        text = await f.text()
      } catch {
        out.push({ ok: false, text: `${f.name}: ${t('Could not read this file')}` })
        continue
      }
      const r = await parseTemplate(text, kind).catch(() => null)
      if (r) {
        const extra = (await onParsed(r, f.name)) ?? []
        out.push({ ok: true, text: `${f.name}: ${t('Filled into the form — please check it before sending.')}`, notes: [...r.warnings.map((w) => warningText(w, t)), ...extra] })
      } else if (onText) {
        onText(text, f.name)
        out.push({ ok: false, text: `${f.name}: ${t('This is not the template, so its text was put in the AI box instead.')}` })
      } else {
        out.push({ ok: false, text: `${f.name}: ${t('This file does not look like the template. Download the template, fill it in and upload it again.')}` })
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
          <a className={cls.link} href={links.zh} download>{t('Download template')} (繁中)</a>
          <a className={cls.link} href={links.en} download>{t('Download template')} (EN)</a>
          <label className={`${cls.btn} ${variant === 'cs' ? '' : 'sop-file'}`}>
            {busy ? t('Reading…') : multiple ? t('Upload filled template(s)') : t('Upload filled template')}
            <input type="file" hidden multiple={multiple} disabled={busy} accept=".md,.markdown,.txt,text/plain,text/markdown" onChange={pick} />
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
