import { useCallback, useEffect, useState } from 'react'
import { fetchOpsBoard, saveOpsBoard } from '../api/data'
import { useLang } from '../i18n/LanguageContext'
import { DateStepper } from './DateStepper'
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
    <Section title={t('RESERVATIONS')}>
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
      await onSave({ ...form, reservations: form.reservations.map((r) => ({ ...r, pax: Number(r.pax) || 0 })) })
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
              <button type="button" onClick={() => removeFrom('eighty_six', i)} aria-label={t('Remove')}>×</button>
            </div>
          ))}
          <button type="button" className="ob-add" onClick={() => addTo('eighty_six', { name: '', status: 'out' })}>+ {t('Add item')}</button>

          <p className="section-label">{t('DAILY SPECIALS')}</p>
          {form.specials.map((r, i) => (
            <div className="ob-row" key={i}>
              <input value={r.name} onChange={(e) => patchList('specials', i, { name: e.target.value })} placeholder={t('Item')} maxLength={80} />
              <input value={r.price} onChange={(e) => patchList('specials', i, { price: e.target.value })} placeholder="NT$680" maxLength={30} />
              <button type="button" onClick={() => removeFrom('specials', i)} aria-label={t('Remove')}>×</button>
            </div>
          ))}
          <button type="button" className="ob-add" onClick={() => addTo('specials', { name: '', price: '' })}>+ {t('Add item')}</button>

          <p className="section-label">{t('SHIFT NOTES')}</p>
          <textarea rows={4} value={form.shift_notes} onChange={(e) => setForm({ ...form, shift_notes: e.target.value })} maxLength={1000} />

          <p className="section-label">{t('RESERVATIONS')}</p>
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

export function OpsBoard({ brand }) {
  const { lang, t } = useLang()
  const [offset, setOffset] = useState(0)
  const [state, setState] = useState({ loading: true, error: null, data: null })
  const [editing, setEditing] = useState(false)
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

  const board = state.data?.board
  return (
    <div className="ops-board">
      <DateStepper label={labelForOffset(offset, lang)} isToday={offset === 0} canNext onPrev={() => setOffset((o) => o - 1)} onNext={() => setOffset((o) => o + 1)} />

      <div className="ob-title-row">
        <div>
          <h2>{brand.label}{brand.sub_label ? ` ${brand.sub_label}` : ''} · {t('Ops Board')}</h2>
          {state.data?.updated_at && <p className="muted">{t('Updated by {name}', { name: state.data.updated_by ?? '—' })}</p>}
        </div>
        {state.data?.can_edit && <button type="button" className="ob-btn ob-btn--primary" onClick={() => setEditing(true)}>+ {t('Edit')}</button>}
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
                    <span className={`ob-pill ob-pill--${r.status}`}>{STATUS_LABEL[r.status]}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title={t('DAILY SPECIALS')}>
            {board.specials.length === 0 ? <p className="muted">{t('No specials today.')}</p> : (
              <div className="ob-card">
                {board.specials.map((r, i) => (
                  <div className="ob-line" key={i}>
                    <span className="ob-dot ob-dot--confirmed" />
                    <span className="ob-line-name">{r.name}{r.price ? ` · ${r.price}` : ''}</span>
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

      {editing && board && <EditModal board={board} onClose={() => setEditing(false)} onSave={save} />}
    </div>
  )
}
