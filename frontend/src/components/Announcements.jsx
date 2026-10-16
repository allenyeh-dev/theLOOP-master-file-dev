import { useEffect, useRef, useState } from 'react'
import { fetchAnnouncements } from '../api/data'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './icons'
import { useLang } from '../i18n/LanguageContext'
import './Announcements.css'

function formatDate(isoDate, lang) {
  const d = new Date(`${isoDate}T00:00:00`)
  return d.toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const PREVIEW_COUNT = 2

export function AnnouncementCard({ a, onClick, expanded }) {
  const { lang, pick } = useLang()
  return (
    <article
      className={`announcement-card accent-${a.accent} ${expanded ? 'announcement-card--expanded' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
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
  )
}

// Full-screen viewer: every announcement is a snap-scrolled slide, so swiping moves to the next one.
function AnnouncementViewer({ announcements, startIndex, onClose: unmount }) {
  const { t } = useLang()
  const [closing, setClosing] = useState(false)
  const onClose = () => setClosing(true)
  useEffect(() => {
    if (!closing) return
    const timer = setTimeout(unmount, 300)
    return () => clearTimeout(timer)
  }, [closing])
  const trackRef = useRef(null)
  const [index, setIndex] = useState(startIndex)
  const indexRef = useRef(index)
  indexRef.current = index

  const goTo = (i, behavior = 'smooth') => {
    const el = trackRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior })
  }

  useEffect(() => {
    goTo(startIndex, 'instant')
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goTo(Math.max(0, indexRef.current - 1))
      if (e.key === 'ArrowRight') goTo(Math.min(announcements.length - 1, indexRef.current + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleScroll() {
    const el = trackRef.current
    if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth))
  }

  const last = announcements.length - 1
  return (
    <div className={`announcement-viewer ${closing ? 'is-closing' : ''}`} onClick={onClose}>
      <div className="announcement-viewer-frame" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="announcement-viewer-close" onClick={onClose} aria-label={t('Close')}>
          <CloseIcon />
        </button>

        <div className="announcement-viewer-track" ref={trackRef} onScroll={handleScroll}>
          {announcements.map((a) => (
            <div key={a.id} className="announcement-viewer-slide">
              <AnnouncementCard a={a} expanded />
            </div>
          ))}
        </div>

        {index > 0 && (
          <button type="button" className="announcement-viewer-nav announcement-viewer-nav--prev" onClick={() => goTo(index - 1)} aria-label={t('Previous')}>
            <ChevronLeftIcon />
          </button>
        )}
        {index < last && (
          <button type="button" className="announcement-viewer-nav announcement-viewer-nav--next" onClick={() => goTo(index + 1)} aria-label={t('Next')}>
            <ChevronRightIcon />
          </button>
        )}

        {announcements.length > 1 && (
          <p className="announcement-viewer-counter">
            {index + 1} / {announcements.length}
            {index === 0 && <span className="announcement-viewer-hint"> · {t('Swipe or tap the arrows for more')}</span>}
          </p>
        )}
      </div>
    </div>
  )
}

export function Announcements() {
  const { t } = useLang()
  const [announcements, setAnnouncements] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewerIndex, setViewerIndex] = useState(null)

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
        {announcements.slice(0, PREVIEW_COUNT).map((a, i) => (
          <AnnouncementCard key={a.id} a={a} onClick={() => setViewerIndex(i)} />
        ))}
      </div>

      {viewerIndex !== null && (
        <AnnouncementViewer announcements={announcements} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </section>
  )
}
