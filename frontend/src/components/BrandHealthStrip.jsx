import { useLang } from '../i18n/LanguageContext'
import './OverviewShared.css'

const RAG_TEXT = {
  admin: { healthy: '● Healthy', watch: '▼ Monitor', na: '— N/A' },
  exec: { healthy: '● On Target', watch: '▼ Watch', na: '— Production' },
}

export function BrandHealthStrip({ outlets, mode }) {
  const { t } = useLang()
  return (
    <div className="bh-strip">
      {outlets.map((o) => {
        const ragClass = o.status === 'healthy' ? 'rag-green' : o.status === 'watch' ? 'rag-amber' : ''
        const ragColorClass = o.status === 'healthy' ? 'green' : o.status === 'watch' ? 'amber' : ''
        const ragLabel = t(RAG_TEXT[mode][o.status])

        const rag = (
          <div className={`bh-rag ${ragColorClass}`} style={o.status === 'na' ? { color: 'var(--text-muted)' } : undefined}>
            {ragLabel}
          </div>
        )
        const name = <div className="bh-outlet">{o.name}</div>
        const covers = (
          <div className="bh-covers" style={o.status === 'na' ? { fontSize: '14px', color: 'var(--text-muted)' } : undefined}>
            {o.covers === null ? (mode === 'admin' ? '—' : t('N/A')) : o.covers}
          </div>
        )
        const vs = (
          <div className="bh-vs">
            {o.status === 'na'
              ? mode === 'admin'
                ? t('No data')
                : t('facility only')
              : mode === 'admin'
                ? `${o.prevPct >= 0 ? '▲' : '▼'} ${o.prevPct >= 0 ? '+' : ''}${o.prevPct}% ${t('vs prev')}`
                : t('vs {n} target', { n: o.target })}
          </div>
        )

        return (
          <div className={`bh-card ${ragClass}`} key={o.key} style={o.status === 'na' && mode === 'exec' ? { opacity: 0.45 } : undefined}>
            {mode === 'admin' ? (
              <>
                {rag}
                {name}
                {covers}
                {vs}
              </>
            ) : (
              <>
                {name}
                {rag}
                {covers}
                {vs}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
