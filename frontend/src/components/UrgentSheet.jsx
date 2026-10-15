import { useCallback, useEffect, useState } from 'react'
import { ackPush, fetchPendingPushes } from '../api/data'
import { useLang } from '../i18n/LanguageContext'
import './UrgentSheet.css'

const formatDate = (iso, lang) =>
  new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })

// Blocking "must acknowledge" sheet for events an admin pushed. Re-checks whenever the app
// regains focus or the service worker reports an incoming push, so it shows up right after
// the user taps the lock-screen notification.
export function UrgentSheet() {
  const { lang, t, pick } = useLang()
  const [queue, setQueue] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const refresh = useCallback(() => {
    fetchPendingPushes().then((d) => setQueue(d.pending)).catch(() => {})
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

  const current = queue[0]

  useEffect(() => {
    if (!current) return
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [current])

  async function acknowledge() {
    setBusy(true)
    setError(null)
    try {
      await ackPush(current.push_id)
      setQueue((q) => q.filter((p) => p.push_id !== current.push_id))
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
        <span className={`urgent-tag urgent-tag--${current.accent}`}>
          ⚡ {pick(current, 'tag_label')} · {t(current.brand)}
        </span>
        <h2>{pick(current, 'title')}</h2>
        <p className="urgent-body">{pick(current, 'event_date')} — {pick(current, 'detail')}</p>
        <p className="urgent-meta">
          {t('Posted by {name} · {date} · Must acknowledge to continue', {
            name: current.posted_by ?? '—',
            date: formatDate(current.pushed_at, lang),
          })}
        </p>
        {error && <p className="error-text">{error}</p>}
        <button type="button" className="urgent-ack" onClick={acknowledge} disabled={busy}>
          {t('Got it — Acknowledged ✓')}
        </button>
        {queue.length > 1 && <p className="urgent-more">+{queue.length - 1}</p>}
      </div>
    </div>
  )
}
