import { useLang } from '../i18n/LanguageContext'
import { useRef, useState } from 'react'
import {
  ADMIN_BRAND_FILTERS, ADMIN_INCIDENTS, ADMIN_LOGS, ADMIN_RECAPS, ADMIN_SCHEDULE, ADMIN_TODAY,
  EXEC_HERO, EXEC_STATS, OUTLETS, filterByBrands,
} from '../data/executiveOverview'
import { greetingForNow, dashDateLong } from '../utils/overviewDate'
import { BrandHealthStrip } from './BrandHealthStrip'
import { StatsRow } from './StatsRow'
import { CoverCountCard } from './CoverCountCard'
import { DateStepper } from './DateStepper'
import { Toast } from './Toast'
import { ClipboardIcon } from './icons'
import { PlaybookCard } from './PlaybookCard'
import './ExecutiveOverview.css'

// Brand tags used in the mock feed -> outlet key.
const TAG_OUTLET = { RSF: 'sf', SF: 'sf', KOR: 'kor', RAN: 'ran', CLV: 'clv', SPC: 'spc' }

export function ExecutiveOverview({ user, onOpenPlaybook }) {
  const { lang, t } = useLang()
  const [dateOffset, setDateOffset] = useState(0)
  const [logOffset, setLogOffset] = useState(0)
  const [logBrand, setLogBrand] = useState('all')
  const [toastMsg, setToastMsg] = useState(null)
  const toastTimer = useRef(null)

  const outlets = filterByBrands(OUTLETS, user.brands)
  const activeOutlets = outlets.filter((o) => o.covers !== null).length
  const stats = EXEC_STATS.map((s) =>
    s.label === 'Covers Last Night' ? { ...s, val: outlets.reduce((n, o) => n + (o.covers ?? 0), 0) } : s
  )
  const firstName = user.name.split(' ')[0]

  // Every section below only shows the outlets this executive can see.
  const keys = new Set(outlets.map((o) => o.key))
  const recaps = ADMIN_RECAPS.items.filter((r) => keys.has(r.outlet))
  const schedule = ADMIN_SCHEDULE.rows.filter((r) => keys.has(r.outlet))
  const incidents = ADMIN_INCIDENTS.filter((i) => i.tier !== 'T1' && keys.has(TAG_OUTLET[i.tag]))
  const brandChips = ADMIN_BRAND_FILTERS.filter((b) => b.key === 'all' || keys.has(b.key))
  const logs = ADMIN_LOGS.filter(
    (l) => keys.has(l.outlet) && logOffset === 0 && (logBrand === 'all' || l.outlet === logBrand)
  )
  const today = ADMIN_TODAY.filter((e) => keys.has(TAG_OUTLET[e.tag]))

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
        <div className="playbook-cta-sub">{t('Live Sold Out list, specials, shift notes, and reservations across every outlet.')}</div>
        <div className="playbook-cta-btn">{t('Open Ops Board →')}</div>
      </button>

      <PlaybookCard onOpen={onOpenPlaybook} />

      <div className="ov-section-label">{t('Cover Count')}</div>
      <CoverCountCard />

      <div className="ov-section-label">{t(ADMIN_RECAPS.title)}</div>
      <div className="ex-stack">
        {recaps.map((r) => (
          <article className="ex-card ex-recap" key={r.outlet}>
            <div className="ex-recap-brand" style={{ color: r.color }}>
              <span className="ex-dot" style={{ background: r.color }} />
              {r.name}
            </div>
            <div className="ex-recap-covers">{t('{n} covers', { n: r.covers })}</div>
            <p className="ex-recap-text">{r.summary}</p>
            <div className="ex-tags">
              {r.tags.map((tag) => (
                <span className={`ex-tag tone-${tag.tone}`} key={tag.label}>{tag.label}</span>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="ov-section-label">{t(ADMIN_SCHEDULE.title)}</div>
      <div className="ex-stack ex-tight">
        {schedule.map((r) => (
          <div className="ex-card ex-row" key={r.outlet}>
            <span className="ex-dot" style={{ background: r.color }} />
            <span className="ex-row-name">{r.name}</span>
            <span className="ex-row-meta">{t('{a}/{b} published', { a: r.published, b: r.total })}</span>
            <button type="button" className="ex-link" onClick={showComingSoon}>{t('View')} ›</button>
          </div>
        ))}
      </div>

      <div className="ov-section-label">{t('Incidents — T2 & Above')}</div>
      <div className="ex-stack ex-tight">
        {incidents.length === 0 && <p className="ex-empty">{t('No incidents.')}</p>}
        {incidents.map((i) => (
          <article className="ex-card ex-item" key={i.title}>
            <span className={`ex-tier tone-${i.tone}`}>{i.tier}</span>
            <div className="ex-item-body">
              <div className="ex-title">{i.title}</div>
              <div className="ex-meta">
                <span className="ex-brand-tag" style={{ color: i.color, borderColor: i.color }}>{i.tag}</span>
                {i.meta}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="ov-section-label">{t('Daily Logs — All Outlets')}</div>
      <div className="ex-chips">
        {brandChips.map((b) => (
          <button
            type="button"
            key={b.key}
            className={`ex-chip ${logBrand === b.key ? 'active' : ''}`}
            onClick={() => setLogBrand(b.key)}
          >
            {t(b.label)}
          </button>
        ))}
      </div>
      <DateStepper
        label={dashDateLong(logOffset, lang)}
        isToday={logOffset === 0}
        canNext={logOffset < 0}
        onPrev={() => setLogOffset((o) => o - 1)}
        onNext={() => setLogOffset((o) => Math.min(0, o + 1))}
      />
      <div className="ex-stack ex-tight">
        {logs.length === 0 && <p className="ex-empty">{t('No logs for this day.')}</p>}
        {logs.map((l, idx) => (
          <article className="ex-card ex-item" key={idx}>
            {l.kind === 'incident' ? (
              <span className="ex-tier tone-red">{l.tier}</span>
            ) : (
              <span className="ex-open">{t('OPEN')}</span>
            )}
            <div className="ex-item-body">
              <div className="ex-title">{l.title}</div>
              <div className="ex-meta">
                <span className="ex-brand-tag" style={{ color: l.color, borderColor: l.color }}>{l.tag}</span>
                {l.meta}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="ov-section-label">{t('Today — All Outlets')}</div>
      <div className="ex-stack ex-tight">
        {today.map((e) => (
          <div className="ex-card ex-item ex-today" key={e.title}>
            <span className="ex-time">{e.time}</span>
            <div className="ex-item-body">
              <div className="ex-title">{e.title}</div>
              <div className="ex-meta">{e.sub}</div>
            </div>
            <span className="ex-brand-tag" style={{ color: e.color, borderColor: e.color }}>{e.tag}</span>
          </div>
        ))}
      </div>

      <Toast message={toastMsg} />
    </div>
  )
}
