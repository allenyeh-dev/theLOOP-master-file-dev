import { useLang } from '../i18n/LanguageContext'
import { useRef, useState } from 'react'
import {
  ADMIN_BRAND_FILTERS, ADMIN_HERO, ADMIN_INCIDENTS, ADMIN_LOGS, ADMIN_PLATFORM, ADMIN_QUICK_ACTIONS,
  ADMIN_RECAPS, ADMIN_SCHEDULE, ADMIN_SOP_FLAGS, ADMIN_STATS, ADMIN_TODAY, OUTLETS, filterByBrands,
} from '../data/executiveOverview'
import { greetingForNow, dashDateLong, dashDateShort } from '../utils/overviewDate'
import { BrandHealthStrip } from './BrandHealthStrip'
import { StatsRow } from './StatsRow'
import { CoverCountCard } from './CoverCountCard'
import { DateStepper } from './DateStepper'
import { Toast } from './Toast'
import { AlertTriangleIcon, ClipboardIcon, KeyIcon, LockIcon, PersonIcon, SignOutIcon, UploadIcon } from './icons'
import './AdminHub.css'

const ICONS = {
  clipboard: ClipboardIcon,
  lock: LockIcon,
  alert: AlertTriangleIcon,
  upload: UploadIcon,
}

const PLATFORM_ICONS = { person: PersonIcon, lock: LockIcon, key: KeyIcon, signout: SignOutIcon }

export function AdminHub({ user }) {
  const { lang, t } = useLang()
  const [dateOffset, setDateOffset] = useState(0)
  const [logOffset, setLogOffset] = useState(0)
  const [logBrand, setLogBrand] = useState('all')
  const [toastMsg, setToastMsg] = useState(null)
  const toastTimer = useRef(null)

  const outlets = filterByBrands(OUTLETS, user.brands)
  const brandScope = user.brands.map((b) => b.label).join(' · ') || t('No brands')
  const activeOutlets = outlets.filter((o) => o.covers !== null).length
  const stats = ADMIN_STATS.map((s) =>
    s.label === 'Covers Last Night' ? { ...s, val: outlets.reduce((n, o) => n + (o.covers ?? 0), 0) } : s
  )
  const firstName = user.name.split(' ')[0]

  const logs = ADMIN_LOGS.filter((l) => logOffset === 0 && (logBrand === 'all' || l.outlet === logBrand))

  function showComingSoon() {
    setToastMsg(t('Coming soon'))
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 1500)
  }

  return (
    <div className="admin-hub">
      <div className="exec-hero admin-hero">
        <div className="exec-hero-sup">{t('Admin Hub · {scope}', { scope: brandScope })}</div>
        <div className="exec-hero-name">
          {t(greetingForNow())}, {firstName}
        </div>
        <div className="exec-hero-sub">
          {dashDateShort(dateOffset, lang)} · {t('{n} Outlets Active', { n: activeOutlets })} · {t('Last updated {time}', { time: ADMIN_HERO.lastUpdated })}
        </div>
        <DateStepper
          label={dashDateShort(dateOffset, lang)}
          isToday={dateOffset === 0}
          canNext={dateOffset < 0}
          onPrev={() => setDateOffset((o) => o - 1)}
          onNext={() => setDateOffset((o) => Math.min(0, o + 1))}
        />
        <div className="admin-status-row">
          {ADMIN_HERO.statusPills.map((p) => (
            <div className={`admin-status-pill ${p.tone === 'ok' ? 'pill-ok' : p.tone === 'alert' ? 'pill-alert' : ''}`} key={p.label}>
              <span className="sp-dot" style={{ background: p.dot }} />
              {t(p.label)}
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
              <span className="aqg-label">{t(a.label)}</span>
              <span className="aqg-sub">{t(a.sub)}</span>
            </button>
          )
        })}
      </div>

      <div className="ov-section-label">{t('Cover Count')}</div>
      <CoverCountCard />

      <div className="ov-section-label">{t(ADMIN_RECAPS.title)}</div>
      <div className="ah-stack">
        {ADMIN_RECAPS.items.map((r) => (
          <article className="ah-card ah-recap" key={r.outlet}>
            <div className="ah-recap-brand" style={{ color: r.color }}>
              <span className="ah-dot" style={{ background: r.color }} />
              {r.name}
            </div>
            <div className="ah-recap-covers">{t('{n} covers', { n: r.covers })}</div>
            <p className="ah-recap-text">{r.summary}</p>
            <div className="ah-tags">
              {r.tags.map((tag) => (
                <span className={`ah-tag tone-${tag.tone}`} key={tag.label}>{tag.label}</span>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="ov-section-label">{t(ADMIN_SCHEDULE.title)}</div>
      <div className="ah-stack ah-tight">
        {ADMIN_SCHEDULE.rows.map((r) => (
          <div className="ah-card ah-row" key={r.outlet}>
            <span className="ah-dot" style={{ background: r.color }} />
            <span className="ah-row-name">{r.name}</span>
            <span className="ah-row-meta">{t('{a}/{b} published', { a: r.published, b: r.total })}</span>
            <button type="button" className="ah-link" onClick={showComingSoon}>{t('View')} ›</button>
          </div>
        ))}
      </div>

      <div className="ov-section-label">{t('Incidents — All Outlets')}</div>
      <div className="ah-stack ah-tight">
        {ADMIN_INCIDENTS.map((i) => (
          <article className="ah-card ah-incident" key={i.title}>
            <span className={`ah-tier tone-${i.tone}`}>{i.tier}</span>
            <div className="ah-incident-body">
              <div className="ah-title">{i.title}</div>
              <div className="ah-meta">
                <span className="ah-brand-tag" style={{ color: i.color, borderColor: i.color }}>{i.tag}</span>
                {i.meta}
              </div>
              <button type="button" className="ah-sop" onClick={showComingSoon}>
                <ClipboardIcon width="12" height="12" /> {i.sop} ›
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="ov-section-label">{t('Daily Logs — All Outlets')}</div>
      <div className="ah-chips">
        {ADMIN_BRAND_FILTERS.map((b) => (
          <button
            type="button"
            key={b.key}
            className={`ah-chip ${logBrand === b.key ? 'active' : ''}`}
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
      <div className="ah-stack ah-tight">
        {logs.length === 0 && <p className="ah-empty">{t('No logs for this day.')}</p>}
        {logs.map((l, idx) => (
          <article className="ah-card ah-log" key={idx}>
            {l.kind === 'incident' ? (
              <span className="ah-tier tone-red">{l.tier}</span>
            ) : (
              <span className="ah-open">{t('OPEN')}</span>
            )}
            <div className="ah-incident-body">
              <div className="ah-title">{l.title}</div>
              <div className="ah-meta">
                <span className="ah-brand-tag" style={{ color: l.color, borderColor: l.color }}>{l.tag}</span>
                {l.meta}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="ov-section-label">{t('Today — All Outlets')}</div>
      <div className="ah-stack ah-tight">
        {ADMIN_TODAY.map((e) => (
          <div className="ah-card ah-today" key={e.title}>
            <span className="ah-time">{e.time}</span>
            <div className="ah-incident-body">
              <div className="ah-title">{e.title}</div>
              <div className="ah-meta">{e.sub}</div>
            </div>
            <span className="ah-brand-tag" style={{ color: e.color, borderColor: e.color }}>{e.tag}</span>
          </div>
        ))}
      </div>

      <div className="ov-section-label">{t('Platform — Today')}</div>
      <div className="ah-stack ah-tight">
        {ADMIN_PLATFORM.map((p) => {
          const Icon = PLATFORM_ICONS[p.icon]
          return (
            <div className={`ah-card ah-platform ${p.tone === 'review' ? 'is-review' : ''}`} key={p.title}>
              <span className="ah-platform-icon"><Icon /></span>
              <div className="ah-incident-body">
                <div className="ah-title">{p.title}</div>
                <div className="ah-meta">{p.sub}</div>
              </div>
              <span className={`ah-badge badge-${p.tone}`}>{t(p.badge)}</span>
            </div>
          )
        })}
      </div>

      <div className="ov-section-label">{t('SOP & Recipe Flags')}</div>
      {ADMIN_SOP_FLAGS.length === 0 && <p className="ah-card ah-empty-card">{t('No flags submitted yet.')}</p>}

      <Toast message={toastMsg} />
    </div>
  )
}
