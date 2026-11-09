import { useCallback, useEffect, useState } from 'react'
import { fetchActiveEmergencies, resolveEmergency } from '../api/alerts'
import { useLang } from '../i18n/LanguageContext'
import { AlertTriangleIcon } from './icons'
import './EmergencyBanner.css'

const LABELS = { fire: 'Fire / Evacuation', medical: 'Medical Emergency', security: 'Security Threat', facility: 'Facility Emergency' }
const POLL_MS = 30000

// Red banner for Admin / Executive: every unresolved emergency, until one of them marks it handled.
export function EmergencyBanner() {
  const { t, lang } = useLang()
  const [alerts, setAlerts] = useState([])

  const load = useCallback(() => {
    fetchActiveEmergencies().then((r) => setAlerts(r.alerts)).catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const id = window.setInterval(load, POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  async function resolve(id) {
    await resolveEmergency(id).catch(() => {})
    load()
  }

  if (alerts.length === 0) return null
  return (
    <div className="eb-wrap" role="alert">
      {alerts.map((a) => {
        const at = new Date(`${a.created_at.replace(' ', 'T')}Z`).toLocaleTimeString(lang === 'zh' ? 'zh-TW' : 'en-US', { hour: 'numeric', minute: '2-digit' })
        return (
          <div className="eb-item" key={a.id}>
            <AlertTriangleIcon />
            <div className="eb-text">
              <strong>{t(LABELS[a.type])}{a.brand_label ? ` · ${a.brand_label}` : ''}</strong>
              <span>{[a.author, at].filter(Boolean).join(' · ')}{a.notes ? ` — ${a.notes}` : ''}</span>
            </div>
            <button type="button" onClick={() => resolve(a.id)}>{t('Mark handled')}</button>
          </div>
        )
      })}
    </div>
  )
}
