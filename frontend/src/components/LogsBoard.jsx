import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { createLog, deleteLog, fetchLogs, updateLog } from '../api/logs'
import { useLang } from '../i18n/LanguageContext'
import { DateStepper } from './DateStepper'
import './LogsBoard.css'

const pad = (n) => String(n).padStart(2, '0')
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromIso = (iso) => new Date(`${iso}T00:00:00`)
const addDays = (iso, n) => { const d = fromIso(iso); d.setDate(d.getDate() + n); return toIso(d) }

const TYPES = {
  opening: { badge: 'OPEN', title: 'Opening Log', hint: 'Staff count · equipment check · 86 items · handoff notes', icon: '📋' },
  closing: { badge: 'CLOSE', title: 'Closing Log', hint: 'Shift summary · cash reconciled · handoff to next shift', icon: '🔒' },
  incident: { badge: 'INC', title: 'Incident Report', hint: 'T1 · T2 · T3 classification · action taken · escalation', icon: '⚠️' },
}
const TIERS = [['T1', 'Minor'], ['T2', 'Moderate'], ['T3', 'Critical']]
const INCIDENT_TYPES = [
  'Guest — Complaint or Dispute', 'Guest — Injury or Medical', 'Guest — Drunk & Disorderly', 'Staff — Dispute or Altercation',
  'Staff — Injury', 'Equipment Fault', 'Food Safety Concern', 'Security — Theft or Threat', 'Other',
]
const ESCALATIONS = ['Handled on shift — no escalation needed', 'Manager on Duty', 'GM', 'Ownership', 'Emergency services']
const CLOSING_CHECKS = [['guests_cleared', 'All guests cleared'], ['cash_secured', 'Cash reconciled & safe secured'], ['equipment_off', 'All equipment shut down'], ['venue_locked', 'Venue locked & CCTV confirmed']]
const EQUIPMENT = [['pos', 'POS terminals operational'], ['refrigeration', 'Refrigeration temps confirmed'], ['cctv', 'CCTV & access control active'], ['radio', 'Radio comms — Channel 13 confirmed']]

const EMPTY = {
  opening: { staff_count: '', equipment: { pos: false, refrigeration: false, cctv: false, radio: false }, items_86: '', handoff_notes: '', notes: '' },
  closing: { summary: '', checklist: { guests_cleared: false, cash_secured: false, equipment_off: false, venue_locked: false }, outstanding: '', incidents: '', handoff: '' },
  incident: { tier: '', description: '', parties: '', action_taken: '', escalated_to: ESCALATIONS[0], gm_review: false },
}

const brandName = (b) => b.label

function logTitle(log, t) {
  return log.type === 'incident' ? t(log.title) : `${t(TYPES[log.type].title)} — ${log.brand_label}`
}

function LogForm({ type, log, brands, defaultBrandId, date, onSaved, onCancel, onDeleted }) {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const editing = Boolean(log)
  const at = editing ? new Date(`${log.created_at.replace(' ', 'T')}Z`) : new Date()
  const whenLabel = at.toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  const byLabel = editing ? [log.author, log.author_role].filter(Boolean).join(' · ') : [user.name, user.role.label].filter(Boolean).join(' · ')
  const [brandId, setBrandId] = useState(log?.brand_id ?? defaultBrandId)
  const [title, setTitle] = useState(log?.title || INCIDENT_TYPES[0])
  const [details, setDetails] = useState({ ...EMPTY[type], ...(log?.details ?? {}), ...(type === 'opening' ? { equipment: { ...EMPTY.opening.equipment, ...(log?.details?.equipment ?? {}) } } : {}), ...(type === 'closing' ? { checklist: { ...EMPTY.closing.checklist, ...(log?.details?.checklist ?? {}) } } : {}) })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (patch) => setDetails((d) => ({ ...d, ...patch }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = { type, log_date: log?.log_date ?? date, title, details }
      const { log: saved } = editing ? await updateLog(log.id, body) : await createLog({ ...body, brand_id: Number(brandId) })
      onSaved(saved)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  async function remove() {
    if (!window.confirm(t('Delete this log?'))) return
    setBusy(true)
    try {
      await deleteLog(log.id)
      onDeleted()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="lg-form" onSubmit={submit}>
      <div className="lg-form-head">
        <button type="button" className="lg-icon-btn" onClick={onCancel} aria-label={t('Back')}>‹</button>
        <h3><span aria-hidden="true">{TYPES[type].icon}</span> {t(TYPES[type].title)}</h3>
        <button type="button" className="lg-icon-btn lg-icon-btn--round" onClick={onCancel} aria-label={t('Close')}>✕</button>
      </div>
      <label className="lg-cap">{t('OUTLET')}
        {editing || brands.length <= 1 ? (
          <input value={editing ? log.brand_label : brandName(brands.find((b) => b.id === Number(brandId)) ?? brands[0])} readOnly />
        ) : (
          <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
            {brands.map((b) => <option key={b.id} value={b.id}>{brandName(b)}</option>)}
          </select>
        )}
      </label>
      <label className="lg-cap">{t('DATE & TIME')}<input value={whenLabel} readOnly /></label>
      <label className="lg-cap">{t(type === 'incident' ? 'REPORTED BY' : 'SUBMITTED BY')}<input value={byLabel} readOnly /></label>
      <hr className="lg-rule" />
      {type === 'incident' && (
        <>
          <p className="lg-cap">{t('INCIDENT TIER')}</p>
          <div className="lg-tiers">
            {TIERS.map(([key, label]) => (
              <button type="button" key={key} className={`lg-tier-btn lg-tier-btn--${key.toLowerCase()}${details.tier === key ? ' is-active' : ''}`} onClick={() => set({ tier: key })}>
                <strong>{key}</strong><small>{t(label)}</small>
              </button>
            ))}
          </div>
          {!details.tier && <small className="muted">{t('Select a tier to continue')}</small>}
          <label className="lg-cap">{t('INCIDENT TYPE')}
            <select value={title} onChange={(e) => setTitle(e.target.value)}>
              {INCIDENT_TYPES.map((x) => <option key={x} value={x}>{t(x)}</option>)}
            </select>
          </label>
          <label className="lg-cap">{t('DESCRIPTION')}<textarea rows={4} value={details.description} onChange={(e) => set({ description: e.target.value })} maxLength={1000} placeholder={t('Describe what happened — be specific, factual, and objective')} /></label>
          <label className="lg-cap">{t('PARTIES INVOLVED')}<textarea rows={2} value={details.parties} onChange={(e) => set({ parties: e.target.value })} maxLength={500} placeholder={t('Names, roles, or guest descriptors if unknown')} /></label>
          <label className="lg-cap">{t('ACTION TAKEN')}<textarea rows={3} value={details.action_taken} onChange={(e) => set({ action_taken: e.target.value })} maxLength={1000} placeholder={t('What steps were taken to resolve or contain the incident?')} /></label>
          <label className="lg-cap">{t('ESCALATED TO')}
            <select value={details.escalated_to} onChange={(e) => set({ escalated_to: e.target.value })}>
              {ESCALATIONS.map((x) => <option key={x} value={x}>{t(x)}</option>)}
            </select>
          </label>
          <p className="lg-cap">{t('FOLLOW-UP REQUIRED?')}</p>
          <label className="lg-toggle">
            <span>{t('Flag for GM review')}</span>
            <input type="checkbox" role="switch" checked={Boolean(details.gm_review)} onChange={(e) => set({ gm_review: e.target.checked })} />
          </label>
        </>
      )}
      {type === 'opening' && (
        <>
          <label className="lg-cap">{t('STAFF COUNT')}<textarea rows={2} value={details.staff_count} onChange={(e) => set({ staff_count: e.target.value })} maxLength={200} placeholder={t('FOH: 4  BOH: 3  Bar: 2  Security: 2')} /></label>
          <p className="lg-cap">{t('EQUIPMENT CHECKS')}</p>
          {EQUIPMENT.map(([key, label]) => (
            <label key={key} className="lg-toggle">
              <span>{t(label)}</span>
              <input type="checkbox" role="switch" checked={Boolean(details.equipment[key])} onChange={(e) => set({ equipment: { ...details.equipment, [key]: e.target.checked } })} />
            </label>
          ))}
          <label className="lg-cap">{t('86 ITEMS AT OPEN')}<textarea rows={2} value={details.items_86} onChange={(e) => set({ items_86: e.target.value })} maxLength={500} /></label>
          <label className="lg-cap">{t('HANDOFF NOTES FROM PREVIOUS SHIFT')}<textarea rows={3} value={details.handoff_notes} onChange={(e) => set({ handoff_notes: e.target.value })} maxLength={1000} /></label>
          <label className="lg-cap">{t('ADDITIONAL NOTES')}<textarea rows={2} value={details.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={1000} placeholder={t('Any other observations before service opens')} /></label>
        </>
      )}
      {type === 'closing' && (
        <>
          <label className="lg-cap">{t('SHIFT SUMMARY')}<textarea rows={3} value={details.summary} onChange={(e) => set({ summary: e.target.value })} maxLength={1000} /></label>
          <p className="lg-cap">{t('CLOSING CHECKLIST')}</p>
          {CLOSING_CHECKS.map(([key, label]) => (
            <label key={key} className="lg-toggle">
              <span>{t(label)}</span>
              <input type="checkbox" role="switch" checked={Boolean(details.checklist[key])} onChange={(e) => set({ checklist: { ...details.checklist, [key]: e.target.checked } })} />
            </label>
          ))}
          <label className="lg-cap">{t('OUTSTANDING ITEMS FOR NEXT SHIFT')}<textarea rows={3} value={details.outstanding} onChange={(e) => set({ outstanding: e.target.value })} maxLength={1000} /></label>
          <label className="lg-cap">{t('INCIDENTS THIS SHIFT')}<textarea rows={2} value={details.incidents} onChange={(e) => set({ incidents: e.target.value })} maxLength={1000} placeholder={t('None')} /></label>
          <label className="lg-cap">{t('HANDOFF NOTE TO NEXT SHIFT')}<textarea rows={3} value={details.handoff} onChange={(e) => set({ handoff: e.target.value })} maxLength={1000} /></label>
        </>
      )}
      {error && <p className="error-text">{t('Error: {msg}', { msg: t(error) })}</p>}
      <div className="lg-form-actions">
        {editing && <button type="button" className="lg-btn lg-btn--danger" onClick={remove} disabled={busy}>{t('Delete')}</button>}
        <button type="submit" className="lg-btn lg-btn--submit" disabled={busy || (type === 'incident' && !details.tier)}>{busy ? t('Saving…') : editing ? t('Save') : t('SUBMIT {type}', { type: t(TYPES[type].title).toUpperCase() })}</button>
      </div>
    </form>
  )
}

function LogDetail({ log, canEdit, onBack, onEdit }) {
  const { t, lang } = useLang()
  const d = log.details
  const yes = (v) => (v ? t('Yes') : t('No'))
  const rows = log.type === 'incident'
    ? [['INCIDENT TIER', d.tier], ['DESCRIPTION', d.description], ['PARTIES INVOLVED', d.parties], ['ACTION TAKEN', d.action_taken], ['ESCALATED TO', t(d.escalated_to)], ['Flag for GM review', d.gm_review ? t('Yes') : null]]
    : log.type === 'opening'
      ? [['STAFF COUNT', d.staff_count], ...EQUIPMENT.map(([k, label]) => [label, yes(d.equipment?.[k])]), ['86 ITEMS AT OPEN', d.items_86], ['HANDOFF NOTES FROM PREVIOUS SHIFT', d.handoff_notes], ['ADDITIONAL NOTES', d.notes]]
      : [['SHIFT SUMMARY', d.summary], ...CLOSING_CHECKS.map(([k, label]) => [label, yes(d.checklist?.[k])]), ['OUTSTANDING ITEMS FOR NEXT SHIFT', d.outstanding], ['INCIDENTS THIS SHIFT', d.incidents], ['HANDOFF NOTE TO NEXT SHIFT', d.handoff]]
  const at = new Date(`${log.created_at.replace(' ', 'T')}Z`).toLocaleString(lang === 'zh' ? 'zh-TW' : 'en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return (
    <div className="lg-detail">
      <button type="button" className="lg-back" onClick={onBack}>‹ {t('Back')}</button>
      <div className="lg-form">
        <h3>{logTitle(log, t)}</h3>
        <small className="muted">{[at, log.author, log.author_role].filter(Boolean).join(' · ')}</small>
        <dl>
          {rows.filter(([, v]) => v !== '' && v != null).map(([k, v]) => (
            <div key={k}><dt>{t(k).toUpperCase()}</dt><dd>{v}</dd></div>
          ))}
        </dl>
        {canEdit && (
          <div className="lg-form-actions">
            <button type="button" className="lg-btn lg-btn--primary" onClick={onEdit}>{t('Edit')}</button>
          </div>
        )}
      </div>
    </div>
  )
}


const excerptOf = (log) => {
  const d = log.details
  return log.type === 'incident' ? d.description : log.type === 'opening' ? d.handoff_notes || d.notes || d.items_86 : d.summary || d.handoff
}

// Bottom sheet opened by tapping a log: read it, and (for editors) revise, escalate or delete it.
function LogSheet({ log, canEdit, meta, onClose, onView, onEdit, onChanged }) {
  const { t } = useLang()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const nextTier = log.type === 'incident' ? TIERS[TIERS.findIndex(([k]) => k === log.details.tier) + 1]?.[0] : null

  async function run(action) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const escalate = () => {
    if (!window.confirm(t('Escalate this incident from {from} to {to}?', { from: log.details.tier, to: nextTier }))) return
    run(() => updateLog(log.id, { log_date: log.log_date, title: log.title, details: { ...log.details, tier: nextTier } }))
  }
  const remove = () => {
    if (window.confirm(t('Delete this log?'))) run(() => deleteLog(log.id))
  }

  const actions = [
    canEdit && ['✎', 'Edit & Resubmit', 'Reopen form to revise and resubmit', onEdit, ''],
    ['🗎', 'View Full Log', 'Read complete submitted record', onView, ''],
    canEdit && nextTier && ['⬆️', 'Escalate Tier', 'Promote to higher severity', escalate, ' lg-action--warn'],
    canEdit && ['🗑', 'Delete Entry', 'Remove from the record permanently', remove, ' lg-action--danger'],
  ].filter(Boolean)

  return (
    <div className="lg-sheet-backdrop" onClick={onClose}>
      <div className="lg-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="lg-sheet-grab" />
        <p className="section-label">{t(TYPES[log.type].title).toUpperCase()}</p>
        <div className="lg-sheet-head">
          <strong>{logTitle(log, t)}</strong>
          <small>{meta}</small>
          {excerptOf(log) && <p>{excerptOf(log)}</p>}
        </div>
        {actions.map(([icon, label, hint, onClick, cls]) => (
          <button type="button" key={label} className={`lg-action${cls}`} onClick={onClick} disabled={busy}>
            <span className="lg-action-icon" aria-hidden="true">{icon}</span>
            <span className="lg-type-text"><strong>{t(label)}</strong><small>{t(hint)}</small></span>
          </button>
        ))}
        {error && <p className="error-text">{t('Error: {msg}', { msg: t(error) })}</p>}
        <button type="button" className="lg-sheet-cancel" onClick={onClose} disabled={busy}>{t('Cancel')}</button>
      </div>
    </div>
  )
}

// Horizontal chip row without a scrollbar: touch scrolls natively, a mouse can drag it.
function DragRow({ children }) {
  const ref = useRef(null)
  const drag = useRef(null)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = (e) => {
    if (e.pointerType !== 'mouse') return
    drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false }
  }
  const onPointerMove = (e) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) > 5) { d.moved = true; setDragging(true) }
    if (d.moved) ref.current.scrollLeft = d.left - dx
  }
  const end = () => { drag.current = null; setDragging(false) }
  // A drag must not count as a click on the chip under the cursor.
  const onClickCapture = (e) => {
    if (drag.current?.moved) { e.stopPropagation(); e.preventDefault() }
  }

  return (
    <div
      ref={ref}
      className={`lg-chips${dragging ? ' is-dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => setTimeout(end, 0)}
      onPointerLeave={end}
      onClickCapture={onClickCapture}
    >
      {children}
    </div>
  )
}

// A brand's shift logs (the LOGS tab). Everyone sees the logs of their own brands; managers, chefs and GMs write them.
export function LogsBoard({ brand }) {
  const { t, lang } = useLang()
  const { user } = useAuth()
  const brands = user.brands
  const [date, setDate] = useState(() => toIso(new Date()))
  const [brandFilter, setBrandFilter] = useState(brand.id) // null = all my brands
  const [state, setState] = useState({ loading: true, error: null, logs: [], canEdit: false })
  const [reloadKey, setReloadKey] = useState(0)
  const [screen, setScreen] = useState({ name: 'list' }) // list | new{type} | view{log} | edit{log}
  const [sheet, setSheet] = useState(null) // the log whose action sheet is open

  useEffect(() => {
    let live = true
    fetchLogs(date, brandFilter)
      .then((d) => live && setState({ loading: false, error: null, logs: d.logs, canEdit: d.can_edit }))
      .catch((err) => live && setState({ loading: false, error: err.message, logs: [], canEdit: false }))
    return () => { live = false }
  }, [date, brandFilter, reloadKey])

  const refresh = () => setReloadKey((k) => k + 1)
  const backToList = () => { setScreen({ name: 'list' }); refresh() }
  const changeDay = (n) => { setDate((d) => addDays(d, n)); setState((s) => ({ ...s, loading: true })) }
  const pickBrand = (id) => { setBrandFilter(id); setState((s) => ({ ...s, loading: true })) }

  const today = toIso(new Date())
  const locale = lang === 'zh' ? 'zh-TW' : 'en-US'
  const dayLabel = fromIso(date).toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })
  const timeOf = (log) => new Date(`${log.created_at.replace(' ', 'T')}Z`).toLocaleString(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  if (screen.name === 'new' || screen.name === 'edit') {
    const log = screen.log
    return (
      <div className="logs-board">
        <LogForm
          type={log?.type ?? screen.type}
          log={log}
          brands={brands}
          defaultBrandId={brandFilter ?? brand.id}
          date={date}
          onSaved={backToList}
          onDeleted={backToList}
          onCancel={() => setScreen(log ? { name: 'view', log } : { name: 'list' })}
        />
      </div>
    )
  }
  if (screen.name === 'view') {
    return (
      <div className="logs-board">
        <LogDetail log={screen.log} canEdit={state.canEdit} onBack={backToList} onEdit={() => setScreen({ name: 'edit', log: screen.log })} />
      </div>
    )
  }

  return (
    <div className="logs-board">
      {state.canEdit && (
        <div className="lg-types">
          {Object.entries(TYPES).map(([type, meta]) => (
            <button type="button" key={type} className="lg-type" onClick={() => setScreen({ name: 'new', type })}>
              <span className="lg-type-icon" aria-hidden="true">{meta.icon}</span>
              <span className="lg-type-text"><strong>{t(meta.title)}</strong><small>{t(meta.hint)}</small></span>
              <span className="lg-chevron">›</span>
            </button>
          ))}
        </div>
      )}

      <div className="lg-head">
        <p className="section-label">{t('RECENT LOGS')}</p>
        <p className="section-label">{t('{n} ENTRIES', { n: state.logs.length })}</p>
      </div>
      {brands.length > 1 && (
        <DragRow>
          <button type="button" className={`lg-chip${brandFilter === null ? ' is-active' : ''}`} onClick={() => pickBrand(null)}>{t('All Brands')}</button>
          {brands.map((b) => (
            <button type="button" key={b.id} className={`lg-chip${brandFilter === b.id ? ' is-active' : ''}`} onClick={() => pickBrand(b.id)}>{brandName(b)}</button>
          ))}
        </DragRow>
      )}
      <DateStepper label={dayLabel} isToday={date === today} onPrev={() => changeDay(-1)} onNext={() => changeDay(1)} canNext={date < today} />

      {state.error && <p className="error-text">{t('Error: {msg}', { msg: t(state.error) })}</p>}
      {state.loading ? <p className="muted">{t('Loading…')}</p> : !state.error && state.logs.length === 0 && <p className="muted">{t('No logs for this day.')}</p>}
      {state.logs.length > 0 && (
        <div className="lg-card">
          {state.logs.map((log) => (
            <button type="button" key={log.id} className="lg-row" onClick={() => setSheet(log)}>
              <span className={`lg-badge lg-badge--${log.type}`}>{TYPES[log.type].badge}</span>
              <span className="lg-main">
                <strong>{logTitle(log, t)}</strong>
                <small>{[brandFilter === null && log.brand_label, timeOf(log), log.author_role].filter(Boolean).join(' · ')}</small>
              </span>
              {log.type === 'incident' && <span className="lg-tier">{log.details.tier}</span>}
              <span className="lg-chevron">›</span>
            </button>
          ))}
        </div>
      )}
      {sheet && (
        <LogSheet
          log={sheet}
          canEdit={state.canEdit}
          meta={[timeOf(sheet), sheet.author_role].filter(Boolean).join(' · ')}
          onClose={() => setSheet(null)}
          onView={() => { setScreen({ name: 'view', log: sheet }); setSheet(null) }}
          onEdit={() => { setScreen({ name: 'edit', log: sheet }); setSheet(null) }}
          onChanged={() => { setSheet(null); refresh() }}
        />
      )}
    </div>
  )
}
