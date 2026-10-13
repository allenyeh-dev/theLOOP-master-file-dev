import { useEffect, useState } from 'react'
import { fetchAnnouncements } from '../api/data'
import { useLang } from '../i18n/LanguageContext'
import './Announcements.css'

function formatDate(isoDate, lang) {
  const d = new Date(`${isoDate}T00:00:00`)
  return d.toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function Announcements() {
  const { lang, t, pick } = useLang()
  const [announcements, setAnnouncements] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnnouncements()
      .then((data) => setAnnouncements(data.announcements))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="announcements">
      <p className="section-label">{t('ANNOUNCEMENTS')}</p>

      {loading && <p className="muted">{t('Loading…')}</p>}
      {error && <p className="error-text">{t('Error: {msg}', { msg: t(error) })}</p>}

      <div className="announcement-list">
        {announcements.map((a) => (
          <article key={a.id} className={`announcement-card accent-${a.accent}`}>
            <div className="announcement-tags">
              {a.tags.map((tag) => (
                <span key={tag.label} className={`tag tag-${tag.variant}`}>
                  {pick(tag, 'label')}
                </span>
              ))}
            </div>
            <h3>{pick(a, 'title')}</h3>
            <p className="announcement-body">{pick(a, 'body')}</p>
            <p className="announcement-footer">
              {a.posted_by} · {formatDate(a.posted_at, lang)}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
