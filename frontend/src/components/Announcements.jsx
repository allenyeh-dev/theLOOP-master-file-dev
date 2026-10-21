import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fetchAnnouncements } from '../api/data'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './icons'
import { useLang } from '../i18n/LanguageContext'
import './Announcements.css'

const PAGE_SIZE = 2

function formatDate(isoDate, lang) {
  const d = new Date(`${isoDate}T00:00:00`)
  return d.toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

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
  const { t, lang } = useLang()
  const [announcements, setAnnouncements] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [viewerIndex, setViewerIndex] = useState(null)
  const listRef = useRef(null)
  const sectionRef = useRef(null)
  const [progress, setProgress] = useState(0)
  const pages = []
  for (let i = 0; i < announcements.length; i += PAGE_SIZE) pages.push(announcements.slice(i, i + PAGE_SIZE))

  // The list is exactly as tall as the page currently in view, so a lone card leaves no extra space.
  function fitListHeight() {
    const list = listRef.current
    const slide = list?.children[activePageRef.current]
    if (slide) list.style.height = `${slide.offsetHeight}px`
  }

  // Every card shares the height of the tallest one, measured from its natural (unfixed) height.
  useLayoutEffect(() => {
    const section = sectionRef.current
    if (!section) return
    function measure() {
      section.style.setProperty('--announcement-card-h', 'auto')
      const cards = section.querySelectorAll('.announcement-list .announcement-card')
      const max = Math.max(0, ...Array.from(cards, (c) => c.offsetHeight))
      if (max) section.style.setProperty('--announcement-card-h', `${max}px`)
      fitListHeight()
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [announcements, lang])

  const activePage = Math.round(progress * (pages.length - 1))
  const activePageRef = useRef(0)
  activePageRef.current = activePage
  useLayoutEffect(fitListHeight, [activePage, announcements])

  function handleListScroll() {
    const el = listRef.current
    const max = el ? el.scrollWidth - el.clientWidth : 0
    if (el) setProgress(max > 0 ? el.scrollLeft / max : 0)
  }

  function goToPage(i) {
    const el = listRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  useEffect(() => {
    fetchAnnouncements()
      .then((data) => setAnnouncements(data.announcements))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="announcements" ref={sectionRef}>
      <p className="section-label">{t('ANNOUNCEMENTS')}</p>

      {loading && <p className="muted">{t('Loading…')}</p>}
      {error && <p className="error-text">{t('Error: {msg}', { msg: t(error) })}</p>}

      <div className="announcement-list" ref={listRef} onScroll={handleListScroll}>
        {pages.map((group, p) => (
          <div key={p} className="announcement-slide">
            {group.map((a, j) => (
              <AnnouncementCard key={a.id} a={a} onClick={() => setViewerIndex(p * PAGE_SIZE + j)} />
            ))}
          </div>
        ))}
      </div>

      {pages.length > 1 && (
        <div className="announcement-progress" aria-hidden="true">
          <div
            className="announcement-progress-thumb"
            style={{ width: `${100 / pages.length}%`, left: `${progress * (100 - 100 / pages.length)}%` }}
          />
        </div>
      )}

      {viewerIndex !== null && (
        <AnnouncementViewer announcements={announcements} startIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      )}
    </section>
  )
}
