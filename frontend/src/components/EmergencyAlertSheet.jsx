import { useEffect, useState } from 'react'
import { useLang } from '../i18n/LanguageContext'
import { AlertTriangleIcon } from './icons'
import './EmergencyAlertSheet.css'

const TYPES = [
  ['fire', 'Fire / Evacuation', 'Trigger venue evacuation protocol', 'M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z'],
  ['medical', 'Medical Emergency', 'Guest or staff requires immediate care', 'M3 8h18v12H3zM9 8V5h6v3M12 11v6M9 14h6'],
  ['security', 'Security Threat', 'Hostile guest, fight, or weapon', 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4'],
  ['facility', 'Facility Emergency', 'Power outage, gas leak, flood', 'M13 2 4 14h7l-1 8 9-12h-7z'],
]

export function EmergencyAlertSheet({ onClose, onSubmit }) {
  const { t } = useLang()
  const [type, setType] = useState(null)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e) {
    e.preventDefault()
    if (!type) return
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ type, notes: notes.trim() })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="ea-backdrop" onMouseDown={onClose}>
      <form className="ea-sheet" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="ea-head">
          <h2><AlertTriangleIcon width="16" height="16" /> {t('Emergency Alert')}</h2>
          <p>{t('Flag an immediate emergency. This will notify the GM and ownership.')}</p>
        </header>
        <div className="ea-section">
          <p className="section-label">{t('EMERGENCY TYPE')}</p>
          <div className="ea-types">
            {TYPES.map(([key, label, sub, icon]) => (
              <button key={key} type="button" className={`ea-type ${type === key ? 'is-active' : ''}`} onClick={() => setType(key)} aria-pressed={type === key}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
                <span><strong>{t(label)}</strong><em>{t(sub)}</em></span>
              </button>
            ))}
          </div>
        </div>
        <div className="ea-section">
          <p className="section-label">{t('ADDITIONAL NOTES')}</p>
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('Describe the situation…')} maxLength={1000} />
          {error && <p className="error-text">{error}</p>}
        </div>
        <footer className="ea-foot">
          <button type="button" className="ea-cancel" onClick={onClose} disabled={busy}>{t('Cancel')}</button>
          <button type="submit" className="ea-send" disabled={!type || busy}>{t('SEND EMERGENCY ALERT')}</button>
        </footer>
      </form>
    </div>
  )
}
