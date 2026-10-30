import { useEffect, useState } from 'react'
import { fetchPlaybook, setPlaybookRead } from '../api/data'
import { useLang } from '../i18n/LanguageContext'
import { PlaybookBody } from './PlaybookBody'
import './PlaybookPage.css'

export function PlaybookPage() {
  const { t, pick } = useLang()
  const [sections, setSections] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchPlaybook()
      .then((d) => setSections(d.sections))
      .catch((err) => setError(err.message))
  }, [])

  // Optimistic tick; put it back if the save fails.
  function toggleRead(s) {
    const set = (v) => setSections((list) => list.map((x) => (x.id === s.id ? { ...x, is_read: v } : x)))
    set(!s.is_read)
    setPlaybookRead(s.id, !s.is_read).catch(() => set(s.is_read))
  }

  if (error) return <p className="error-text">{t('Error: {msg}', { msg: t(error) })}</p>
  if (!sections) return <p className="muted">{t('Loading…')}</p>

  const readable = sections.filter((s) => s.kind !== 'heading')
  const readCount = readable.filter((s) => s.is_read).length
  let rule = 0

  return (
    <div className="playbook">
      <h1 className="playbook-title">{t('THE PLAYBOOK')}</h1>
      <p className="playbook-sub">{t('Hospitality Standard — All Venues')}</p>
      <p className="playbook-progress">{t('{n} of {total} sections read', { n: readCount, total: readable.length })}</p>

      {sections.map((s) => {
        if (s.kind === 'heading') return <p key={s.id} className="section-label playbook-heading">{pick(s, 'title')}</p>
        const behavior = s.kind === 'behavior'
        if (behavior) rule += 1
        return (
          <section key={s.id} className={`playbook-card${s.is_read ? ' is-read' : ''}`}>
            {behavior && <span className="playbook-num">{rule}</span>}
            {behavior && <h2>{pick(s, 'title')}</h2>}
            <PlaybookBody text={pick(s, 'body')} />
            {behavior && (s.good || s.miss) && (
              <div className="playbook-examples">
                {s.good && <p className="playbook-good">✓ {t('Good')}: {pick(s, 'good')}</p>}
                {s.miss && <p className="playbook-miss">✗ {t('Miss')}: {pick(s, 'miss')}</p>}
              </div>
            )}
            <label className="playbook-read">
              <input type="checkbox" checked={s.is_read} onChange={() => toggleRead(s)} />
              {t('Mark as read')}
            </label>
          </section>
        )
      })}
    </div>
  )
}
