import { useCallback, useEffect, useState } from 'react'
import { ackAnnouncement, fetchPendingAnnouncements } from '../api/data'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../i18n/LanguageContext'
import './AnnouncementSheet.css'

const formatDate = (isoDate, lang) =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })

// Blocking "must acknowledge" sheet for announcements published as pop-ups. Only admins can skip it
// (for this page load; nothing is recorded). While an admin is viewing as someone else the sheet is
// skip-only, so they can't acknowledge on that person's behalf. Re-checks whenever the app
// regains focus or the service worker reports an incoming push, so it shows up right after
// the user taps the lock-screen notification.
export function AnnouncementSheet() {
  const { lang, t, pick } = useLang()
  const { user, impersonating } = useAuth()
  const canSkip = impersonating || user.role?.key === 'admin'
  const [queue, setQueue] = useState([])
  const [skipped, setSkipped] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(() => {
    fetchPendingAnnouncements().then((d) => setQueue(d.pending)).catch(() => {})
  }, [])

  useEffect(() => {
    refresh()
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    const onMessage = (e) => e.data?.type === 'push' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
      navigator.serviceWorker?.removeEventListener('message', onMessage)
    }
  }, [refresh])

  const current = queue.find((a) => !skipped.includes(a.id))

  useEffect(() => {
    if (!current) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [current])

  async function acknowledge() {
    setBusy(true)
    setError(null)
    try {
      await ackAnnouncement(current.id)
      setQueue((q) => q.filter((a) => a.id !== current.id))
    } catch {
      setError(t('Could not acknowledge, try again'))
    } finally {
      setBusy(false)
    }
  }

  if (!current) return null

  return (
    <div className="urgent-backdrop" role="alertdialog" aria-modal="true" aria-label={pick(current, 'title')}>
      <div className="urgent-sheet">
        {current.tags.length > 0 && (
          <div className="urgent-tags">
            {current.tags.map((tag) => (
              <span key={tag.label} className={`urgent-tag urgent-tag--${tag.variant}`}>{pick(tag, 'label')}</span>
            ))}
          </div>
        )}
        <h2>{pick(current, 'title')}</h2>
        <p className="urgent-body">{pick(current, 'body')}</p>
        <p className="urgent-meta">
          {t('Posted by {name} · {date} · Must acknowledge to continue', {
            name: current.posted_by ?? '—',
            date: formatDate(current.posted_at, lang),
          })}
        </p>
        {error && <p className="error-text">{error}</p>}
        {!impersonating && (
          <button type="button" className="urgent-ack" onClick={acknowledge} disabled={busy}>
            {t('Got it — Acknowledged ✓')}
          </button>
        )}
        {canSkip && (
          <button type="button" className="urgent-skip" onClick={() => setSkipped((s) => [...s, current.id])}>
            {t('Skip (admin only)')}
          </button>
        )}
        {queue.length - skipped.length > 1 && <p className="urgent-more">+{queue.length - skipped.length - 1}</p>}
      </div>
    </div>
  )
}
