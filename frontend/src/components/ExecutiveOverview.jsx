import { useLang } from '../i18n/LanguageContext'
import { useRef, useState } from 'react'
import { EXEC_HERO, EXEC_STATS, OUTLETS, filterByBrands } from '../data/executiveOverview'
import { greetingForNow, dashDateLong } from '../utils/overviewDate'
import { BrandHealthStrip } from './BrandHealthStrip'
import { StatsRow } from './StatsRow'
import { CoverCountCard } from './CoverCountCard'
import { DateStepper } from './DateStepper'
import { Toast } from './Toast'
import { ClipboardIcon } from './icons'
import './ExecutiveOverview.css'

export function ExecutiveOverview({ user }) {
  const { lang, t } = useLang()
  const [dateOffset, setDateOffset] = useState(0)
  const [toastMsg, setToastMsg] = useState(null)
  const toastTimer = useRef(null)

  const outlets = filterByBrands(OUTLETS, user.brands)
  const activeOutlets = outlets.filter((o) => o.covers !== null).length
  const stats = EXEC_STATS.map((s) =>
    s.label === 'Covers Last Night' ? { ...s, val: outlets.reduce((n, o) => n + (o.covers ?? 0), 0) } : s
  )
  const firstName = user.name.split(' ')[0]

  function showComingSoon() {
    setToastMsg(t('Coming soon'))
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 1500)
  }

  return (
    <div className="executive-overview">
      <div className="exec-hero">
        <div className="exec-hero-sup">{t(EXEC_HERO.sup)}</div>
        <div className="exec-hero-name">
          {t(greetingForNow())}, {firstName}
        </div>
        <div className="exec-hero-sub">
          {dashDateLong(dateOffset, lang)} · {t('{n} Outlets Active', { n: activeOutlets })}
        </div>
        <DateStepper
          label={dashDateLong(dateOffset, lang)}
          isToday={dateOffset === 0}
          canNext={dateOffset < 0}
          onPrev={() => setDateOffset((o) => o - 1)}
          onNext={() => setDateOffset((o) => Math.min(0, o + 1))}
        />
      </div>

      <BrandHealthStrip outlets={outlets} mode="exec" />

      <StatsRow stats={stats} />

      <button type="button" className="playbook-cta" onClick={showComingSoon}>
        <span className="playbook-cta-icon">
          <ClipboardIcon width="20" height="20" />
        </span>
        <div className="playbook-cta-eyebrow">{t('All Brands')}</div>
        <div className="playbook-cta-title">{t('OPS BOARD')}</div>
        <div className="playbook-cta-sub">{t('Live 86 list, specials, shift notes, and reservations across every outlet.')}</div>
        <div className="playbook-cta-btn">{t('Open Ops Board →')}</div>
      </button>

      <div className="ov-section-label">{t('Cover Count')}</div>
      <CoverCountCard />


      <Toast message={toastMsg} />
    </div>
  )
}
