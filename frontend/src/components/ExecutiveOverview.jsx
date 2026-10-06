import { useRef, useState } from 'react'
import { EXEC_HERO, EXEC_STATS, OUTLETS } from '../data/executiveOverview'
import { greetingForNow, dashDateLong } from '../utils/overviewDate'
import { BrandHealthStrip } from './BrandHealthStrip'
import { StatsRow } from './StatsRow'
import { CoverCountCard } from './CoverCountCard'
import { DateStepper } from './DateStepper'
import { OverviewFooter } from './OverviewFooter'
import { Toast } from './Toast'
import { ClipboardIcon } from './icons'
import './ExecutiveOverview.css'

export function ExecutiveOverview({ user }) {
  const [dateOffset, setDateOffset] = useState(0)
  const [toastMsg, setToastMsg] = useState(null)
  const toastTimer = useRef(null)

  const firstName = user.name.split(' ')[0]

  function showComingSoon() {
    setToastMsg('Coming soon')
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 1500)
  }

  return (
    <div className="executive-overview">
      <div className="exec-hero">
        <div className="exec-hero-sup">{EXEC_HERO.sup}</div>
        <div className="exec-hero-name">
          {greetingForNow()}, {firstName}
        </div>
        <div className="exec-hero-sub">
          {dashDateLong(dateOffset)} · {EXEC_HERO.outletsActive} Outlets Active
        </div>
        <DateStepper
          label={dashDateLong(dateOffset)}
          isToday={dateOffset === 0}
          canNext={dateOffset < 0}
          onPrev={() => setDateOffset((o) => o - 1)}
          onNext={() => setDateOffset((o) => Math.min(0, o + 1))}
        />
      </div>

      <BrandHealthStrip outlets={OUTLETS} mode="exec" />

      <StatsRow stats={EXEC_STATS} />

      <button type="button" className="playbook-cta" onClick={showComingSoon}>
        <span className="playbook-cta-icon">
          <ClipboardIcon width="20" height="20" />
        </span>
        <div className="playbook-cta-eyebrow">All Brands</div>
        <div className="playbook-cta-title">OPS BOARD</div>
        <div className="playbook-cta-sub">Live 86 list, specials, shift notes, and reservations across every outlet.</div>
        <div className="playbook-cta-btn">Open Ops Board →</div>
      </button>

      <div className="ov-section-label">Cover Count</div>
      <CoverCountCard />

      <OverviewFooter placeholder="Search all outlets, recaps, events…" onHome={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />

      <Toast message={toastMsg} />
    </div>
  )
}
