import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createServiceAlert } from '../api/alerts'
import { fetchOpsBoard, saveOpsBoard } from '../api/data'
import { useLang } from '../i18n/LanguageContext'
import { DateStepper } from './DateStepper'
import { Toast } from './Toast'
import './OpsBoard.css'

const TAG_KINDS = [
  ['event', 'EVENT'], ['birthday', 'BIRTHDAY'], ['vip', 'VIP'], ['allergy', 'ALLERGY'], ['new_guest', 'NEW GUEST'], ['other', 'OTHER'],
]
// Filter chips -> which tag kinds they match.
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'vip', label: 'VIP', kinds: ['vip'] },
  { key: 'events', label: 'Events', kinds: ['event', 'birthday'] },
  { key: 'allergies', label: 'Allergies', kinds: ['allergy'] },
]

const pad = (n) => String(n).padStart(2, '0')
// Local calendar day shifted by `offset` days, as YYYY-MM-DD.
function isoForOffset(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function labelForOffset(offset, lang) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
}

const STATUS_LABEL = { out: 'OUT', limited: 'LIMITED' }
const pillLabel = (r) => (r.status === 'limited' && Number.isInteger(r.left) ? `${r.left} LEFT` : STATUS_LABEL[r.status])

function EditPencil({ onClick, label }) {
  return <button type="button" className="ob-pencil" onClick={onClick} aria-label={label}>✎</button>
}

function Section({ title, count, children }) {
  const [open, setOpen] = useState(true)
  return (
    <section className="ob-section">
      <button type="button" className="ob-section-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="section-label">{title}{count !== undefined ? ` (${count})` : ''}</span>
        <span className="ob-toggle">{open ? '−' : '+'}</span>
      </button>
      {open && children}
    </section>
  )
}

function Reservations({ items }) {
  const { t } = useLang()
  const [filter, setFilter] = useState('all')
  const active = FILTERS.find((f) => f.key === filter)
  const shown = items.filter((r) => !active.kinds || r.tags.some((tag) => active.kinds.includes(tag.kind)))

  return (
    <Section title={t('TABLE BOOKINGS')}>
      <div className="ob-chips">
        {FILTERS.map((f) => {
          const n = f.kinds ? items.filter((r) => r.tags.some((tag) => f.kinds.includes(tag.kind))).length : items.length
          return (
            <button key={f.key} type="button" className={`ob-chip ${filter === f.key ? 'is-active' : ''}`} onClick={() => setFilter(f.key)}>
              {t(f.label)}{f.key === 'all' ? ` (${n})` : ''}
            </button>
          )
        })}
      </div>
      {shown.length === 0 ? (
        <p className="muted">{t('No reservations.')}</p>
      ) : (
        <div className="ob-card ob-res-list">
          {shown.map((r, i) => (
            <div className="ob-res" key={i}>
              <div className="ob-res-time">
                <strong>{r.time}</strong>
                <span>{r.pax} pax</span>
                {r.table && <em>{r.table}</em>}
              </div>
              <div className="ob-res-main">
                <strong>{r.title}</strong>
                {r.notes && <p>{r.notes}</p>}
                <div className="ob-tags">
                  {r.tags.map((tag, j) => <span key={j} className={`ob-tag ob-tag--${tag.kind}`}>{tag.label}</span>)}
                </div>
              </div>
              <span className={`ob-dot ob-dot--${r.status}`} title={r.status} />
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// Textarea that grows to show all of its content, so nothing needs scrolling inside the box.
function AutoTextarea({ value, ...props }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return <textarea ref={ref} value={value} {...props} />
}

function EditModal({ board, onClose, onSave }) {
  const { t } = useLang()
  const [form, setForm] = useState(board)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const patchList = (key, i, patch) => setForm({ ...form, [key]: form[key].map((r, j) => (j === i ? { ...r, ...patch } : r)) })
  const addTo = (key, row) => setForm({ ...form, [key]: [...form[key], row] })
  const removeFrom = (key, i) => setForm({ ...form, [key]: form[key].filter((_, j) => j !== i) })

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave({ ...form, eighty_six: form.eighty_six.map(({ left, ...r }) => (r.status === 'limited' && Number.isInteger(left) ? { ...r, left } : r)), reservations: form.reservations.map((r) => ({ ...r, pax: Number(r.pax) || 0 })) })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const toggleTag = (i, kind, label) => {
    const tags = form.reservations[i].tags
    patchList('reservations', i, { tags: tags.some((x) => x.kind === kind) ? tags.filter((x) => x.kind !== kind) : [...tags, { kind, label }] })
  }

  return (
    <div className="ob-backdrop" onMouseDown={onClose}>
      <form className="ob-modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <header><h2>{t('Edit Ops Board')}</h2><button type="button" onClick={onClose} aria-label={t('Close')}>×</button></header>
        <div className="ob-modal-body">
          <p className="section-label">{t('86 LIST')}</p>
          {form.eighty_six.map((r, i) => (
            <div className="ob-row" key={i}>
              <input value={r.name} onChange={(e) => patchList('eighty_six', i, { name: e.target.value })} placeholder={t('Item')} maxLength={80} />
              <select value={r.status} onChange={(e) => patchList('eighty_six', i, { status: e.target.value })}>
                <option value="out">OUT</option><option value="limited">LIMITED</option>
              </select>
              {r.status === 'limited' && (
                <input type="number" min="0" max="999" className="ob-left" value={r.left ?? ''} placeholder={t('Left')}
                  onChange={(e) => patchList('eighty_six', i, { left: e.target.value === '' ? undefined : Number(e.target.value) })} />
              )}
              <button type="button" onClick={() => removeFrom('eighty_six', i)} aria-label={t('Remove')}>×</button>
            </div>
          ))}
          <button type="button" className="ob-add" onClick={() => addTo('eighty_six', { name: '', status: 'out' })}>+ {t('Add item')}</button>

          <p className="section-label">{t("TONIGHT'S PACKAGES")}</p>
          {form.specials.map((r, i) => (
            <div className="ob-row" key={i}>
              <input value={r.name} onChange={(e) => patchList('specials', i, { name: e.target.value })} placeholder={t('Item')} maxLength={80} />
              <input value={r.price} onChange={(e) => patchList('specials', i, { price: e.target.value })} placeholder="NT$680" maxLength={30} />
              <button type="button" onClick={() => removeFrom('specials', i)} aria-label={t('Remove')}>×</button>
            </div>
          ))}
          <button type="button" className="ob-add" onClick={() => addTo('specials', { name: '', price: '' })}>+ {t('Add item')}</button>

          <p className="section-label">{t('SHIFT NOTES')}</p>
          <AutoTextarea rows={4} value={form.shift_notes} onChange={(e) => setForm({ ...form, shift_notes: e.target.value })} maxLength={1000} />

          <p className="section-label">{t('TABLE BOOKINGS')}</p>
          {form.reservations.map((r, i) => (
            <div className="ob-res-edit" key={i}>
              <div className="ob-row">
                <input type="time" value={r.time} onChange={(e) => patchList('reservations', i, { time: e.target.value })} required />
                <input type="number" min="0" max="999" value={r.pax} onChange={(e) => patchList('reservations', i, { pax: e.target.value })} placeholder="pax" />
                <input value={r.table} onChange={(e) => patchList('reservations', i, { table: e.target.value })} placeholder={t('Table')} maxLength={20} />
                <button type="button" onClick={() => removeFrom('reservations', i)} aria-label={t('Remove')}>×</button>
              </div>
              <input value={r.title} onChange={(e) => patchList('reservations', i, { title: e.target.value })} placeholder={t('Guest / booking')} maxLength={100} required />
              <input value={r.notes} onChange={(e) => patchList('reservations', i, { notes: e.target.value })} placeholder={t('Notes')} maxLength={300} />
              <div className="ob-edit-tags">
                {TAG_KINDS.map(([kind, label]) => (
                  <label key={kind}>
                    <input type="checkbox" checked={r.tags.some((x) => x.kind === kind)} onChange={() => toggleTag(i, kind, label)} /> {label}
                  </label>
                ))}
                <select value={r.status} onChange={(e) => patchList('reservations', i, { status: e.target.value })}>
                  <option value="confirmed">{t('Confirmed')}</option><option value="pending">{t('Pending')}</option>
                </select>
              </div>
            </div>
          ))}
          <button type="button" className="ob-add" onClick={() => addTo('reservations', { time: '19:00', pax: 2, table: '', title: '', notes: '', tags: [], status: 'confirmed' })}>+ {t('Add reservation')}</button>
          {error && <p className="error-text">{error}</p>}
        </div>
        <footer>
          <button type="button" className="ob-btn" onClick={onClose} disabled={busy}>{t('Cancel')}</button>
          <button type="submit" className="ob-btn ob-btn--primary" disabled={busy}>{busy ? t('Saving…') : t('Save')}</button>
        </footer>
      </form>
    </div>
  )
}

const TIERS = [['T1', 'Minor'], ['T2', 'Moderate'], ['T3', 'Serious']]
const ALERT_CATEGORIES = ['Equipment Issue', 'Guest Complaint', 'Staffing Issue', 'Safety / Security', 'Supply Shortage', 'Other']

function ServiceAlertModal({ onClose, onSubmit }) {
  const { t } = useLang()
  const [tier, setTier] = useState('T1')
  const [category, setCategory] = useState(ALERT_CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ tier, category, description: description.trim() })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="ob-backdrop" onMouseDown={onClose}>
      <form className="ob-modal sa-modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <header className="sa-head">
          <div>
            <h2>🔔 {t('Service Alert')}</h2>
            <p>{t('Flag a service issue or request for the ops team.')}</p>
          </div>
        </header>
        <div className="sa-section">
          <p className="section-label">{t('INCIDENT TIER')}</p>
          <div className="sa-tiers">
            {TIERS.map(([key, label]) => (
              <button key={key} type="button" className={`sa-tier sa-tier--${key} ${tier === key ? 'is-active' : ''}`} onClick={() => setTier(key)} aria-pressed={tier === key}>
                <strong>{key}</strong><span>{t(label)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="sa-section">
          <p className="section-label">{t('CATEGORY')}</p>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {ALERT_CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}
          </select>
        </div>
        <div className="sa-section">
          <p className="section-label">{t('DESCRIPTION')}</p>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('Describe the service issue…')} maxLength={1000} />
          {error && <p className="error-text">{error}</p>}
        </div>
        <footer className="sa-foot">
          <button type="button" className="ob-btn" onClick={onClose} disabled={busy}>{t('Cancel')}</button>
          <button type="submit" className="ob-btn sa-submit" disabled={busy}>{t('Submit Alert')}</button>
        </footer>
      </form>
    </div>
  )
}

export function OpsBoard({ brand }) {
  const { lang, t } = useLang()
  const [offset, setOffset] = useState(0)
  const [state, setState] = useState({ loading: true, error: null, data: null })
  const [editing, setEditing] = useState(false)
  const [alerting, setAlerting] = useState(false)
  const [toast, setToast] = useState(null)
  const date = isoForOffset(offset)

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }))
    fetchOpsBoard(brand.id, date)
      .then((data) => setState({ loading: false, error: null, data }))
      .catch((err) => setState({ loading: false, error: err.message, data: null }))
  }, [brand.id, date])

  useEffect(load, [load])

  async function save(board) {
    await saveOpsBoard(brand.id, date, board)
    setEditing(false)
    load()
  }

  async function submitAlert(alert) {
    await createServiceAlert({ ...alert, brand_id: brand.id, log_date: isoForOffset(0) })
    setAlerting(false)
    setToast(t('Alert sent'))
    window.setTimeout(() => setToast(null), 2000)
  }

  const board = state.data?.board
  const canEdit = !!state.data?.can_edit
  return (
    <div className="ops-board">
      <DateStepper label={labelForOffset(offset, lang)} isToday={offset === 0} canNext onPrev={() => setOffset((o) => o - 1)} onNext={() => setOffset((o) => o + 1)} />

      <div className="ob-title-row">
        <div>
          <h2>{brand.label}{brand.sub_label ? ` ${brand.sub_label}` : ''} · {t('Ops Board')}</h2>
          {state.data?.updated_at && <p className="muted">{t('Updated by {name}', { name: state.data.updated_by ?? '—' })}</p>}
        </div>
        {canEdit && <button type="button" className="ob-btn ob-btn--primary" onClick={() => setEditing(true)}>+ {t('Edit')}</button>}
      </div>

      {state.loading && !board && <p className="muted">{t('Loading…')}</p>}
      {state.error && <p className="error-text">{t('Error: {msg}', { msg: t(state.error) })}</p>}

      {board && (
        <>
          <Section title={t('86 LIST')}>
            {board.eighty_six.length === 0 ? <p className="muted">{t('Nothing 86’d.')}</p> : (
              <div className="ob-card">
                {board.eighty_six.map((r, i) => (
                  <div className="ob-line" key={i}>
                    <span className={`ob-dot ob-dot--${r.status}`} />
                    <span className="ob-line-name">{r.name}</span>
                    <span className={`ob-pill ob-pill--${r.status}`}>{pillLabel(r)}</span>
                    {canEdit && <EditPencil onClick={() => setEditing(true)} label={t('Edit')} />}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={t("TONIGHT'S PACKAGES")}>
            {board.specials.length === 0 ? <p className="muted">{t('No specials today.')}</p> : (
              <div className="ob-card">
                {board.specials.map((r, i) => (
                  <div className="ob-line" key={i}>
                    <span className="ob-dot ob-dot--confirmed" />
                    <span className="ob-line-name">{r.name}{r.price ? ` · ${r.price}` : ''}</span>
                    {canEdit && <EditPencil onClick={() => setEditing(true)} label={t('Edit')} />}
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={t('SHIFT NOTES')}>
            {board.shift_notes ? <div className="ob-card ob-notes">{board.shift_notes}</div> : <p className="muted">{t('No shift notes.')}</p>}
          </Section>

          <Reservations items={board.reservations} />
        </>
      )}

      <button type="button" className="sa-fab" onClick={() => setAlerting(true)}>🔔 {t('Service')}</button>
      {alerting && <ServiceAlertModal onClose={() => setAlerting(false)} onSubmit={submitAlert} />}
      <Toast message={toast} />

      {editing && board && <EditModal board={board} onClose={() => setEditing(false)} onSave={save} />}
    </div>
  )
}
