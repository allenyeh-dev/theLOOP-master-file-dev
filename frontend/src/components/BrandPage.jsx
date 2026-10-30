import { useEffect, useState } from 'react'
import { fetchBrandNotices, fetchBrandPopups, removePopupFromLog } from '../api/data'
import { useLang } from '../i18n/LanguageContext'
import { AnnouncementCard } from './Announcements'
import { ChevronRightIcon } from './icons'
import { OpsBoard } from './OpsBoard'
import './BrandPicker.css'

// A brand's own page (the OPS tab): its notices (always listed, re-readable), and the daily Ops Board.
export function BrandPage({ brand }) {
  const { t, lang, pick } = useLang()
  const [open, setOpen] = useState(null)
  const [popups, setPopups] = useState([])
  const [notices, setNotices] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBrandNotices(brand.id)
      .then((d) => setNotices(d.notices))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    fetchBrandPopups(brand.id).then((d) => setPopups(d.popups)).catch(() => {})
  }, [brand.id])

  const remove = (id) =>
    removePopupFromLog(id)
      .then(() => setPopups((list) => list.filter((p) => p.id !== id)))
      .catch(() => {})

  return (
    <div className="brand-page">
      <section className="brand-notices">
        <p className="section-label">{t('BRAND NOTICES')}</p>
        {loading && <p className="muted">{t('Loading…')}</p>}
        {error && <p className="error-text">{t('Error: {msg}', { msg: t(error) })}</p>}
        {!loading && !error && notices.length === 0 && <p className="muted">{t('No notices for this brand.')}</p>}
        <div className="announcement-list">
          {notices.map((n) => <AnnouncementCard key={n.id} a={n} />)}
        </div>
      </section>

      {popups.length > 0 && (
        <section className="brand-notices">
          <p className="section-label">{t('POP-UP LOG')}</p>
          <div className="popup-log">
            {popups.map((p) => (
              <div key={p.id} className="popup-row">
                <button type="button" className="popup-row-head" aria-expanded={open === p.id} onClick={() => setOpen(open === p.id ? null : p.id)}>
                  <span className={`popup-badge popup-badge--${p.accent}`}>{p.tags[0] ? pick(p.tags[0], 'label') : t('NOTICE')}</span>
                  <span className="popup-row-main">
                    <strong>{pick(p, 'title')}</strong>
                    <small>{p.posted_by} · {new Date(`${p.posted_at}T00:00:00`).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { month: 'short', day: 'numeric' })}</small>
                  </span>
                  <ChevronRightIcon className={open === p.id ? 'popup-chevron popup-chevron--open' : 'popup-chevron'} />
                </button>
                {open === p.id && (
                  <div className="popup-row-body">
                    <p>{pick(p, 'body')}</p>
                    {p.acked_at ? (
                      <button type="button" className="popup-delete" onClick={() => remove(p.id)}>{t('Delete')}</button>
                    ) : (
                      <small className="muted">{t('Acknowledge the pop-up first to delete it.')}</small>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <OpsBoard brand={brand} />
    </div>
  )
}
