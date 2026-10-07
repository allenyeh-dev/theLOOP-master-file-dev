import { useRef, useState } from 'react'
import { ADMIN_HERO, ADMIN_QUICK_ACTIONS, ADMIN_STATS, OUTLETS, filterByBrands } from '../data/executiveOverview'
import { greetingForNow, dashDateShort } from '../utils/overviewDate'
import { BrandHealthStrip } from './BrandHealthStrip'
import { StatsRow } from './StatsRow'
import { CoverCountCard } from './CoverCountCard'
import { DateStepper } from './DateStepper'
import { OverviewFooter } from './OverviewFooter'
import { Toast } from './Toast'
import { WhatsHappening } from './WhatsHappening'
import { AlertTriangleIcon, ClipboardIcon, LockIcon, UploadIcon } from './icons'
import './AdminHub.css'

const ICONS = {
  clipboard: ClipboardIcon,
  lock: LockIcon,
  alert: AlertTriangleIcon,
  upload: UploadIcon,
}

export function AdminHub({ user }) {
  const [dateOffset, setDateOffset] = useState(0)
  const [toastMsg, setToastMsg] = useState(null)
  const toastTimer = useRef(null)

  const outlets = filterByBrands(OUTLETS, user.brands)
  const brandScope = user.brands.map((b) => b.label).join(' · ') || 'No brands'
  const activeOutlets = outlets.filter((o) => o.covers !== null).length
  const stats = ADMIN_STATS.map((s) =>
    s.label === 'Covers Last Night' ? { ...s, val: outlets.reduce((n, o) => n + (o.covers ?? 0), 0) } : s
  )
  const firstName = user.name.split(' ')[0]

  function showComingSoon() {
    setToastMsg('Coming soon')
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 1500)
  }

  return (
    <div className="admin-hub">
      <div className="exec-hero admin-hero">
        <div className="exec-hero-sup">Admin Hub · {brandScope}</div>
        <div className="exec-hero-name">
          {greetingForNow()}, {firstName}
        </div>
        <div className="exec-hero-sub">
          {dashDateShort(dateOffset)} · {activeOutlets} Outlets Active · Last updated {ADMIN_HERO.lastUpdated}
        </div>
        <DateStepper
          label={dashDateShort(dateOffset)}
          isToday={dateOffset === 0}
          canNext={dateOffset < 0}
          onPrev={() => setDateOffset((o) => o - 1)}
          onNext={() => setDateOffset((o) => Math.min(0, o + 1))}
        />
        <div className="admin-status-row">
          {ADMIN_HERO.statusPills.map((p) => (
            <div className={`admin-status-pill ${p.tone === 'ok' ? 'pill-ok' : p.tone === 'alert' ? 'pill-alert' : ''}`} key={p.label}>
              <span className="sp-dot" style={{ background: p.dot }} />
              {p.label}
            </div>
          ))}
        </div>
      </div>

      <BrandHealthStrip outlets={outlets} mode="admin" />

      <StatsRow stats={stats} />

      <div className="admin-quick-grid">
        {ADMIN_QUICK_ACTIONS.map((a) => {
          const Icon = ICONS[a.icon]
          return (
            <button
              type="button"
              key={a.label}
              className={`aqg-btn ${a.tone || ''}`}
              onClick={showComingSoon}
            >
              <span className="aqg-icon">
                <Icon />
              </span>
              <span className="aqg-label">{a.label}</span>
              <span className="aqg-sub">{a.sub}</span>
            </button>
          )
        })}
      </div>

      <WhatsHappening />

      <div className="ov-section-label">Cover Count</div>
      <CoverCountCard />

      <OverviewFooter placeholder="Search all outlets, incidents, staff…" onHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />

      <Toast message={toastMsg} />
    </div>
  )
}
