import { useState } from 'react'
import { consoleApi } from '../api/console'
import { ConfirmDialog, Field, Modal, PageHead, useLoader } from './ui'

const EMPTY = {
  brand_id: '', tag_label: '', title: '', event_date: '', detail: '', icon: 'calendar', accent: 'gold',
  tag_label_zh: '', title_zh: '', event_date_zh: '', detail_zh: '',
}

function EventModal({ brands, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY, brand_id: brands[0]?.id ?? '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await consoleApi.createHappening({ ...form, brand_id: form.brand_id === 'all' ? 'all' : Number(form.brand_id) })
      onSaved()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title="New Event"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="cs-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="event-form" className="cs-btn cs-btn--primary" disabled={busy}>
            {busy ? 'Publishing…' : 'Publish'}
          </button>
        </>
      }
    >
      <form id="event-form" className="cs-form" onSubmit={submit}>
        <div className="cs-form-row">
          <Field label="Brand" hint="Only the chosen brand's users see it.">
            <select value={form.brand_id} onChange={set('brand_id')} required>
              <option value="all">All brands (company-wide)</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </Field>
          <Field label="Tag"><input value={form.tag_label} onChange={set('tag_label')} placeholder="PRIVATE EVENT" maxLength={40} required /></Field>
        </div>
        <Field label="Title"><input value={form.title} onChange={set('title')} placeholder="Rancho Buyout — 60 Pax" maxLength={120} required /></Field>
        <div className="cs-form-row">
          <Field label="Date"><input value={form.event_date} onChange={set('event_date')} placeholder="June 21" maxLength={60} required /></Field>
          <Field label="Details"><input value={form.detail} onChange={set('detail')} placeholder="Full venue · Run sheet confirmed · 8pm–1am" maxLength={300} required /></Field>
        </div>
        <div className="cs-form-row">
          <Field label="Icon">
            <select value={form.icon} onChange={set('icon')}>
              <option value="calendar">Calendar</option><option value="people">People</option><option value="music">Music</option>
            </select>
          </Field>
          <Field label="Accent">
            <select value={form.accent} onChange={set('accent')}>
              <option value="gold">Gold</option><option value="red">Red</option><option value="green">Green</option><option value="orange">Orange</option>
            </select>
          </Field>
        </div>
        <details>
          <summary className="cs-muted">中文版本（選填，中文介面與中文通知使用）</summary>
          <div className="cs-form" style={{ marginTop: '0.75rem' }}>
            <div className="cs-form-row">
              <Field label="標籤"><input value={form.tag_label_zh} onChange={set('tag_label_zh')} /></Field>
              <Field label="日期"><input value={form.event_date_zh} onChange={set('event_date_zh')} /></Field>
            </div>
            <Field label="標題"><input value={form.title_zh} onChange={set('title_zh')} /></Field>
            <Field label="詳情"><input value={form.detail_zh} onChange={set('detail_zh')} /></Field>
          </div>
        </details>
        {error && <p className="cs-error">{error}</p>}
      </form>
    </Modal>
  )
}

export function EventsPage() {
  const events = useLoader(consoleApi.listHappenings, (r) => r)
  const brands = useLoader(consoleApi.listBrands, (r) => r.brands)
  const [modal, setModal] = useState(null)

  const ready = events.data && brands.data

  function saved() {
    setModal(null)
    events.reload()
  }

  return (
    <>
      <PageHead
        title="Events"
        subtitle="Event cards shown under What's Happening and on the brand's page. View-only: no notifications are sent."
        action={<button className="cs-btn cs-btn--primary" onClick={() => setModal({ kind: 'new' })} disabled={!ready}>+ New Event</button>}
      />
      {(events.error || brands.error) && <p className="cs-error">{events.error || brands.error}</p>}
      {!ready && !events.error && <p className="cs-muted">Loading…</p>}

      {ready && (
        <table className="cs-table">
          <thead><tr><th>Event</th><th>Brand</th><th>Date</th><th>Details</th><th className="cs-col-actions">Actions</th></tr></thead>
          <tbody>
            {events.data.happenings.map((h) => (
              <tr key={h.id}>
                <td className="cs-strong">{h.title}</td>
                <td>{h.brand}</td>
                <td>{h.event_date}</td>
                <td>{h.detail}</td>
                <td className="cs-col-actions">
                  <button className="cs-link cs-link--danger" onClick={() => setModal({ kind: 'delete', event: h })}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal?.kind === 'new' && (
        <EventModal brands={brands.data} onClose={() => setModal(null)} onSaved={saved} />
      )}
      {modal?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete event"
          message={`Delete "${modal.event.title}"? It disappears from the dashboard.`}
          onClose={() => setModal(null)}
          onConfirm={async () => { await consoleApi.deleteHappening(modal.event.id); events.reload() }}
        />
      )}
    </>
  )
}
