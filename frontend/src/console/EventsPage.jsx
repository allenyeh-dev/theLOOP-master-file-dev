import { useState } from 'react'
import { consoleApi } from '../api/console'
import { ConfirmDialog, Field, Modal, PageHead, useLoader } from './ui'

const EMPTY = {
  brand_id: '', tag_label: '', title: '', event_date: '', detail: '', icon: 'calendar', accent: 'gold',
  tag_label_zh: '', title_zh: '', event_date_zh: '', detail_zh: '', notify: true,
}

function EventModal({ brands, pushConfigured, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY, brand_id: brands[0]?.id ?? '', notify: pushConfigured })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await consoleApi.createHappening({ ...form, brand_id: form.brand_id === 'all' ? 'all' : Number(form.brand_id) })
      onSaved(res.push)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title="New Event Announcement"
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="cs-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="event-form" className="cs-btn cs-btn--primary" disabled={busy}>
            {busy ? 'Publishing…' : form.notify ? 'Publish & Notify' : 'Publish'}
          </button>
        </>
      }
    >
      <form id="event-form" className="cs-form" onSubmit={submit}>
        <div className="cs-form-row">
          <Field label="Brand" hint="Only the chosen brand's users see it and get the notification.">
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
        <label className="cs-perm">
          <input type="checkbox" checked={form.notify} disabled={!pushConfigured} onChange={(e) => setForm({ ...form, notify: e.target.checked })} />
          <span>
            Send push notification
            <small>{pushConfigured ? 'Shows on lock screens of subscribed devices.' : 'Push is not configured on the server (VAPID keys missing).'}</small>
          </span>
        </label>
        {error && <p className="cs-error">{error}</p>}
      </form>
    </Modal>
  )
}

// DB timestamps are UTC ("YYYY-MM-DD HH:MM:SS"); show them in the viewer's local time.
const localTime = (s) => (s ? new Date(s.replace(' ', 'T') + 'Z').toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—')

function AcksModal({ event, onClose }) {
  const acks = useLoader(() => consoleApi.happeningAcks(event.id), (r) => r)
  const people = acks.data?.people ?? []
  const done = people.filter((p) => p.acked_at).length

  return (
    <Modal title={`Acknowledgements — ${event.title}`} onClose={onClose} wide footer={<button type="button" className="cs-btn" onClick={onClose}>Close</button>}>
      {acks.error && <p className="cs-error">{acks.error}</p>}
      {!acks.data && !acks.error && <p className="cs-muted">Loading…</p>}
      {acks.data && (
        <>
          <p className="cs-muted">
            Latest push {localTime(acks.data.push.created_at)} · {done}/{people.length} acknowledged
          </p>
          <table className="cs-table">
            <thead><tr><th>Name</th><th>Role</th><th>Notification</th><th>Acknowledged</th></tr></thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.id}>
                  <td className="cs-strong">{p.name}</td>
                  <td>{p.role_label ?? p.title ?? '—'}</td>
                  <td>
                    {p.notified_at ? localTime(p.notified_at)
                      : p.devices ? <span className="cs-error">Failed to send</span>
                      : <span className="cs-muted">No device subscribed</span>}
                  </td>
                  <td>{p.acked_at ? localTime(p.acked_at) : <span className="cs-muted">Pending</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="cs-field-hint">
            "Notification" is when the push service accepted the message; it cannot confirm the device displayed it.
            Everyone still sees the acknowledge sheet the next time they open the app.
          </p>
        </>
      )}
    </Modal>
  )
}

export function EventsPage() {
  const events = useLoader(consoleApi.listHappenings, (r) => r)
  const brands = useLoader(consoleApi.listBrands, (r) => r.brands)
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState(null)

  const ready = events.data && brands.data

  function saved(push) {
    setModal(null)
    setNotice(
      !push.requested ? 'Published.'
        : !push.configured ? 'Published, but push is not configured on the server.'
        : `Published. Notification sent to ${push.sent} device(s)${push.failed ? `, ${push.failed} failed` : ''}.`
    )
    events.reload()
  }

  return (
    <>
      <PageHead
        title="Events"
        subtitle="Event cards shown under What's Happening. Publishing can also push a notification to the brand's staff."
        action={<button className="cs-btn cs-btn--primary" onClick={() => setModal({ kind: 'new' })} disabled={!ready}>+ New Event</button>}
      />
      {notice && <p className="cs-muted">{notice}</p>}
      {(events.error || brands.error) && <p className="cs-error">{events.error || brands.error}</p>}
      {!ready && !events.error && <p className="cs-muted">Loading…</p>}

      {ready && (
        <table className="cs-table">
          <thead><tr><th>Event</th><th>Brand</th><th>Date</th><th>Details</th><th>Last push</th><th className="cs-col-actions">Actions</th></tr></thead>
          <tbody>
            {events.data.happenings.map((h) => (
              <tr key={h.id}>
                <td className="cs-strong">{h.title}</td>
                <td>{h.brand}</td>
                <td>{h.event_date}</td>
                <td>{h.detail}</td>
                <td>
                  {h.last_push_at
                    ? <>{h.last_push_at.slice(0, 16).replace('T', ' ')} UTC<br /><button className="cs-link" onClick={() => setModal({ kind: 'acks', event: h })}>{h.acked}/{h.recipients} acknowledged</button></>
                    : <span className="cs-muted">Never</span>}
                </td>
                <td className="cs-col-actions">
                  <button className="cs-link" onClick={() => setModal({ kind: 'push', event: h })}>Push again</button>
                  <button className="cs-link cs-link--danger" onClick={() => setModal({ kind: 'delete', event: h })}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal?.kind === 'new' && (
        <EventModal brands={brands.data} pushConfigured={events.data.push_configured} onClose={() => setModal(null)} onSaved={saved} />
      )}
      {modal?.kind === 'acks' && <AcksModal event={modal.event} onClose={() => setModal(null)} />}
      {modal?.kind === 'push' && (
        <ConfirmDialog
          title="Push again"
          confirmLabel="Push now"
          message={`Send "${modal.event.title}" again to ${modal.event.brand} staff? Everyone is notified and must acknowledge it again.`}
          onClose={() => setModal(null)}
          onConfirm={async () => { const r = await consoleApi.pushHappening(modal.event.id); saved(r.push) }}
        />
      )}
      {modal?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete event"
          message={`Delete "${modal.event.title}"? It disappears from the dashboard. Notifications already sent are not recalled.`}
          onClose={() => setModal(null)}
          onConfirm={async () => { await consoleApi.deleteHappening(modal.event.id); events.reload() }}
        />
      )}
    </>
  )
}
