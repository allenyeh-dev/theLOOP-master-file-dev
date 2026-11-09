import { useCallback, useEffect, useRef, useState } from 'react'
import { addShift, copyLastWeek, deleteShift, fetchSchedule, fetchStaff, setPublished } from '../api/schedule'
import { useLang } from '../i18n/LanguageContext'
import './ScheduleBoard.css'

const pad = (n) => String(n).padStart(2, '0')
const toIso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const fromIso = (iso) => new Date(`${iso}T00:00:00`)
const addDays = (iso, n) => { const d = fromIso(iso); d.setDate(d.getDate() + n); return toIso(d) }

function formatTime(hhmm, lang) {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(lang === 'zh' ? 'zh-TW' : 'en-US', { hour: 'numeric', minute: '2-digit' })
}
const range = (s, lang) => `${formatTime(s.start_time, lang)} – ${formatTime(s.end_time, lang)}`

function AddShiftForm({ brandId, date, onAdded, onCancel }) {
  const { t } = useLang()
  const [staff, setStaff] = useState(null)
  const [positions, setPositions] = useState([])
  const [form, setForm] = useState({ user_id: '', position: 'FOH', start_time: '17:00', end_time: '23:00' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  useEffect(() => {
    let live = true
    fetchStaff(brandId)
      .then((d) => { if (live) { setStaff(d.staff); setPositions(d.positions) } })
      .catch((err) => live && setError(err.message))
    return () => { live = false }
  }, [brandId])

  async function submit(e) {
    e.preventDefault()
    if (!form.user_id) return
    setBusy(true)
    setError(null)
    try {
      await addShift({ brand_id: brandId, shift_date: date, ...form, user_id: Number(form.user_id) })
      onAdded()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="sc-form" onSubmit={submit}>
      <select value={form.user_id} onChange={(e) => set({ user_id: e.target.value })} aria-label={t('Staff')} required disabled={!staff}>
        <option value="">{staff ? t('Select staff…') : t('Loading…')}</option>
        {staff?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div className="sc-form-row">
        <select value={form.position} onChange={(e) => set({ position: e.target.value })} aria-label={t('Position')}>
          {(positions.length ? positions : [form.position]).map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <input type="time" value={form.start_time} onChange={(e) => set({ start_time: e.target.value })} aria-label={t('Start')} required />
        <input type="time" value={form.end_time} onChange={(e) => set({ end_time: e.target.value })} aria-label={t('End')} required />
      </div>
      {error && <p className="error-text">{t('Error: {msg}', { msg: t(error) })}</p>}
      <div className="sc-form-actions">
        <button type="button" className="sc-btn" onClick={onCancel} disabled={busy}>{t('Cancel')}</button>
        <button type="submit" className="sc-btn sc-btn--primary" disabled={busy || !form.user_id}>{busy ? t('Saving…') : t('Add Shift')}</button>
      </div>
    </form>
  )
}

// A brand's daily staff schedule (the SCHEDULE tab). Managers build and publish a day; everyone else sees it once published.
export function ScheduleBoard({ brand }) {
  const { t, lang } = useLang()
  const [date, setDate] = useState(() => toIso(new Date()))
  const [state, setState] = useState({ loading: true, error: null, data: null })
  const [adding, setAdding] = useState(false)
  const [actionError, setActionError] = useState(null)
  const touch = useRef(null)

  const load = useCallback(() => fetchSchedule(brand.id, date)
    .then((data) => setState({ loading: false, error: null, data }))
    .catch((err) => setState({ loading: false, error: err.message, data: null })), [brand.id, date])

  useEffect(() => {
    let live = true
    fetchSchedule(brand.id, date)
      .then((data) => live && setState({ loading: false, error: null, data }))
      .catch((err) => live && setState({ loading: false, error: err.message, data: null }))
    return () => { live = false }
  }, [brand.id, date])

  const changeDay = (n) => { setDate((d) => addDays(d, n)); setAdding(false); setActionError(null); setState((s) => ({ ...s, loading: true })) }

  async function run(action) {
    setActionError(null)
    try { await action() } catch (err) { setActionError(err.message) }
    load()
  }

  const onTouchStart = (e) => { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e) => {
    const s = touch.current
    touch.current = null
    if (!s) return
    const dx = e.changedTouches[0].clientX - s.x
    const dy = e.changedTouches[0].clientY - s.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) changeDay(dx < 0 ? 1 : -1)
  }

  const { data } = state
  const manage = Boolean(data?.can_manage)
  const published = Boolean(data?.published)
  const mine = data?.my_shifts ?? []
  const label = fromIso(date).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const copy = () => run(async () => {
    const { copied } = await copyLastWeek(brand.id, date)
    if (!copied) throw new Error('Nothing to copy from last week')
  })

  return (
    <div className="schedule-board" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="sc-day">
        <button type="button" className="sc-arrow" onClick={() => changeDay(-1)} aria-label={t('Previous day')}>‹</button>
        <div className="sc-day-label">
          <strong>{label}</strong>
          <small>{t('Swipe left/right to change the day')}</small>
        </div>
        <button type="button" className="sc-arrow" onClick={() => changeDay(1)} aria-label={t('Next day')}>›</button>
      </div>

      <p className="section-label">{t('MY SHIFT')}</p>
      <div className="sc-card sc-mine">
        {mine.length ? mine.map((s) => (
          <div className="sc-row" key={s.id}>
            <span className={`sc-pos sc-pos--${s.position.toLowerCase()}`}>{s.position}</span>
            <span className="sc-time">{range(s, lang)}</span>
          </div>
        )) : <p className="muted">{state.loading ? t('Loading…') : t('No shift scheduled for you this day.')}</p>}
      </div>

      <div className="sc-head">
        <p className="section-label">{t('TEAM SCHEDULE')}</p>
        {published && <span className="sc-published">{t('PUBLISHED')}</span>}
      </div>
      {state.error && <p className="error-text">{t('Error: {msg}', { msg: t(state.error) })}</p>}

      {manage && (
        <>
          <div className="sc-actions">
            <button type="button" className="sc-action" onClick={() => setAdding(true)}>+ {t('Add Shift')}</button>
            <button type="button" className="sc-action" onClick={copy}>⧉ {t('Copy Last Week')}</button>
          </div>
          <button type="button" className="sc-action sc-action--wide" onClick={() => run(() => setPublished(brand.id, date, !published))}>
            {published ? t('Unpublish This Day') : `➤ ${t('Publish This Day')}`}
          </button>
          {adding && <AddShiftForm brandId={brand.id} date={date} onAdded={() => { setAdding(false); load() }} onCancel={() => setAdding(false)} />}
        </>
      )}
      {actionError && <p className="error-text">{t('Error: {msg}', { msg: t(actionError) })}</p>}

      {data?.shifts.length ? (
        <div className="sc-card">
          {data.shifts.map((s) => (
            <div className="sc-row" key={s.id}>
              <span className={`sc-pos sc-pos--${s.position.toLowerCase()}`}>{s.position}</span>
              <div className="sc-main">
                <strong>{s.user_name}</strong>
                <small>{range(s, lang)}</small>
              </div>
              {manage && <button type="button" className="sc-delete" onClick={() => run(() => deleteShift(s.id))} aria-label={t('Delete')}>×</button>}
            </div>
          ))}
        </div>
      ) : !state.loading && !state.error && (
        <p className="muted">{manage || published ? t('No shifts scheduled.') : t('The schedule for this day has not been published yet.')}</p>
      )}
    </div>
  )
}
