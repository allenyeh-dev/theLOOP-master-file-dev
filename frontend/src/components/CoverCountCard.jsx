import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { COVER_ANALYTICS, COVER_HOURLY, filterByBrands, sumTotals } from '../data/executiveOverview'
import './CoverCountCard.css'

function Sparkline({ values, color }) {
  const w = 44
  const h = 16
  if (values.length < 2) return <svg width={w} height={h} />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(1, max - min)
  const stepX = w / (values.length - 1)
  const points = values
    .map((v, i) => `${(i * stepX).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={w} height={h}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const PERIODS = [
  { key: 'day', label: 'D' },
  { key: 'week', label: 'W' },
  { key: 'month', label: 'M' },
]

export function CoverCountCard() {
  const [expandedBrand, setExpandedBrand] = useState(null)
  const [dwmOpen, setDwmOpen] = useState(false)
  const [period, setPeriod] = useState('day')
  const { user } = useAuth()

  const asOf = COVER_HOURLY.hours[COVER_HOURLY.hours.length - 1]
  const hourlyOutlets = filterByBrands(COVER_HOURLY.outlets, user.brands)
  const periodData = COVER_ANALYTICS[period]
  const periodOutlets = filterByBrands(periodData.outlets, user.brands)
  const analytics = { label: periodData.label, outlets: periodOutlets, total: sumTotals(periodOutlets) }

  return (
    <div className="cover-count-card">
      <div className="can-hourly-live-tag-row">
        <span className="can-hourly-live-tag">
          <span className="can-hourly-live-dot" />
          Simulated live — POS feed pending
        </span>
        <span className="can-hourly-as-of">{asOf}</span>
      </div>
      <div className="can-period-label">Running total tonight · vs. same time last night</div>

      {hourlyOutlets.map((o, idx) => {
        const pct = o.priorNightSameHour ? ((o.runningTotal - o.priorNightSameHour) / o.priorNightSameHour) * 100 : 0
        const dir = pct >= 0 ? 'up' : 'down'
        const isOpen = expandedBrand === idx
        return (
          <div key={o.name}>
            <div className="live-brand-row" onClick={() => setExpandedBrand(isOpen ? null : idx)}>
              <span className="can-dot" style={{ background: o.color }} />
              <span className="live-brand-name">{o.name}</span>
              <span className="live-brand-total">{o.runningTotal.toLocaleString()}</span>
              <span className={`live-brand-delta ${dir}`}>
                {dir === 'up' ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
              </span>
              <span className="live-brand-spark">
                <Sparkline values={o.hourly} color={o.color} />
              </span>
            </div>
            {isOpen && (
              <div className="live-brand-breakdown">
                {COVER_HOURLY.hours.map((h, i) => (
                  <span key={h}>
                    {h} · {o.hourly[i]}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <div className="can-hourly-note">Mock data for UI preview. Tap a brand to see its last 5 hours.</div>

      <div className={`can-hourly-toggle ${dwmOpen ? 'open' : ''}`} onClick={() => setDwmOpen((o) => !o)}>
        <span>{dwmOpen ? 'Hide Day/Week/Month' : 'View Day/Week/Month'}</span>
        <span className="chev">▾</span>
      </div>

      {dwmOpen && (
        <div className="can-hourly-panel open">
          <div className="period-toggle">
            {PERIODS.map((p) => (
              <div
                key={p.key}
                className={`ptog-pill ${period === p.key ? 'active' : ''}`}
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </div>
            ))}
          </div>
          <div className="can-period-label">{analytics.label}</div>
          {analytics.outlets.map((o) => (
            <div className="can-row" key={o.name}>
              <span className="can-dot" style={{ background: o.color }} />
              <span className="can-outlet">{o.name}</span>
              <span className="can-val">{o.current.toLocaleString()}</span>
              <span className="can-prior">vs {o.prior.toLocaleString()}</span>
              <span className={`can-delta ${o.dir}`}>
                {o.dir === 'up' ? '▲' : '▼'} {o.delta}
              </span>
            </div>
          ))}
          <div className="can-total-row">
            <span className="can-total-label">Total</span>
            <span className="can-val">{analytics.total.current.toLocaleString()}</span>
            <span className="can-prior">vs {analytics.total.prior.toLocaleString()}</span>
            <span className={`can-delta ${analytics.total.dir}`}>
              {analytics.total.dir === 'up' ? '▲' : '▼'} {analytics.total.delta}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
