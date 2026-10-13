import { useLang } from '../i18n/LanguageContext'
import './OverviewShared.css'

export function StatsRow({ stats }) {
  const { t } = useLang()
  return (
    <div className="exec-stats-row">
      {stats.map((s) => (
        <div className="exec-stat" key={s.label}>
          <div className={`exec-stat-val ${s.tone || ''}`}>{s.val}</div>
          <div className="exec-stat-label">{t(s.label)}</div>
        </div>
      ))}
    </div>
  )
}
