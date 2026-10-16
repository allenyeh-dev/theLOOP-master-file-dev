import { useEffect, useRef, useState } from 'react'
import { fetchHappenings } from '../api/data'
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  ExternalLinkIcon,
  GroupIcon,
  MusicNoteIcon,
} from './icons'
import { useLang } from '../i18n/LanguageContext'
import './WhatsHappening.css'

const ICONS = {
  music: MusicNoteIcon,
  people: GroupIcon,
  calendar: CalendarIcon,
}

const SWIPE_THRESHOLD = 40

function HappeningCard({ happening, onClick, className = '', tabIndex }) {
  const { pick, t } = useLang()
  const Icon = ICONS[happening.icon] || CalendarIcon
  return (
    <article
      className={`happening-card accent-${happening.accent} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={tabIndex}
    >
      <div className="happening-top">
        <span className="happening-icon">
          <Icon />
        </span>
        <span className="happening-link">
          <ExternalLinkIcon />
        </span>
      </div>
      <p className="happening-tag">{pick(happening, 'tag_label')}</p>
      <h3>{pick(happening, 'title')}</h3>
      <p className="happening-meta">
        {t(happening.brand)} · {pick(happening, 'event_date')}
      </p>
      <p className="happening-detail">{pick(happening, 'detail')}</p>
    </article>
  )
}

// brandId: only that brand's events (plus company-wide ones); omitted = everything the user can see.
export function WhatsHappening({ brandId }) {
  const { t } = useLang()
  const [happenings, setHappenings] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [expandedIndex, setExpandedIndex] = useState(null)
  const scrollRef = useRef(null)
  const touchStartX = useRef(null)

  useEffect(() => {
    fetchHappenings()
      .then((data) =>
        setHappenings(brandId ? data.happenings.filter((h) => h.all_brands || h.brand_id === brandId) : data.happenings)
      )
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [brandId])

  const closeModalRef = useRef(() => {})

  useEffect(() => {
    if (expandedIndex === null) return

    document.body.style.overflow = 'hidden'

    function handleKeyDown(e) {
      if (e.key === 'Escape') closeModalRef.current()
      if (e.key === 'ArrowLeft') setExpandedIndex((i) => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setExpandedIndex((i) => Math.min(happenings.length - 1, i + 1))
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [expandedIndex, happenings.length])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setScrollProgress(max > 0 ? el.scrollLeft / max : 0)
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (deltaX > SWIPE_THRESHOLD) {
      setExpandedIndex((i) => Math.max(0, i - 1))
    } else if (deltaX < -SWIPE_THRESHOLD) {
      setExpandedIndex((i) => Math.min(happenings.length - 1, i + 1))
    }
  }

  const [closing, setClosing] = useState(false)
  function closeModal() {
    if (closing) return
    setClosing(true)
    setTimeout(() => {
      setExpandedIndex(null)
      setClosing(false)
    }, 300)
  }

  closeModalRef.current = closeModal

  const expandedHappening = expandedIndex !== null ? happenings[expandedIndex] : null

  return (
    <section className="happenings">
      <p className="section-label">{t("WHAT'S HAPPENING")}</p>

      {loading && <p className="muted">{t('Loading…')}</p>}
      {error && <p className="error-text">{t('Error: {msg}', { msg: t(error) })}</p>}

      {!loading && !error && happenings.length === 0 && (
        <p className="muted">{t('No brand activity right now.')}</p>
      )}

      {happenings.length > 0 && (
        <>
          <div className="happenings-scroll" ref={scrollRef} onScroll={handleScroll}>
            {happenings.map((h, index) => (
              <HappeningCard key={h.id} happening={h} onClick={() => setExpandedIndex(index)} />
            ))}
          </div>

          {happenings.length > 1 && (
            <div className="happenings-progress">
              <div
                className="happenings-progress-thumb"
                style={{ transform: `translateX(${scrollProgress * 100}%)` }}
              />
            </div>
          )}
        </>
      )}

      {expandedHappening && (
        <div className={`happening-modal-backdrop ${closing ? 'is-closing' : ''}`} onClick={closeModal}>
          <div
            className="happening-modal-body"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <button
              type="button"
              className="happening-modal-close"
              onClick={closeModal}
              aria-label={t('Close')}
            >
              <CloseIcon />
            </button>

            {expandedIndex > 0 && (
              <button
                type="button"
                className="happening-modal-nav happening-modal-nav--prev"
                onClick={() => setExpandedIndex((i) => i - 1)}
                aria-label={t('Previous')}
              >
                <ChevronLeftIcon />
              </button>
            )}

            {expandedIndex < happenings.length - 1 && (
              <button
                type="button"
                className="happening-modal-nav happening-modal-nav--next"
                onClick={() => setExpandedIndex((i) => i + 1)}
                aria-label={t('Next')}
              >
                <ChevronRightIcon />
              </button>
            )}

            <HappeningCard happening={expandedHappening} className="happening-card--expanded" />

            {happenings.length > 1 && (
              <p className="happening-modal-counter">
                {expandedIndex + 1} / {happenings.length}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
