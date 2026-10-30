import { useState } from 'react'
import { consoleApi } from '../api/console'
import { ConfirmDialog, Field, Modal, PageHead, TAG_VARIANTS, TagsField, formatUtc, localInputToIso, useLoader, useSubmit, utcToLocalInput } from './ui'

const today = () => new Date().toISOString().slice(0, 10)
const EMPTY = {
  title: '', body: '', title_zh: '', body_zh: '', accent: 'gold', posted_by: '', posted_at: today(),
  tags: [], starts_at: '', ends_at: '', target_type: 'all', target_id: '', display_mode: 'feed',
}

// 'Scheduled' (not yet live) / 'Live' / 'Expired', judged against the browser clock.
function statusOf(a) {
  const now = Date.now()
  const utc = (s) => new Date(s.replace(' ', 'T') + 'Z').getTime()
  if (a.starts_at && utc(a.starts_at) > now) return 'Scheduled'
  if (a.ends_at && utc(a.ends_at) <= now) return 'Expired'
  return 'Live'
}

const AUDIENCES = [['all', 'Everyone'], ['brand', 'A brand'], ['role', 'A role'], ['user', 'One person']]
const audienceLabel = (a) => (a.target_type === 'all' ? 'Everyone' : `${a.target_label ?? '(deleted)'} (${a.target_type})`)

function AnnouncementModal({ announcement, targets, onClose, onSaved }) {
  const [form, setForm] = useState(
    announcement
      ? { ...EMPTY, ...announcement, title_zh: announcement.title_zh ?? '', body_zh: announcement.body_zh ?? '',
          tags: announcement.tags.map((t) => ({ ...t, label_zh: t.label_zh ?? '' })),
          target_id: announcement.target_id ?? '',
          starts_at: utcToLocalInput(announcement.starts_at), ends_at: utcToLocalInput(announcement.ends_at) }
      : EMPTY
  )
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const setAudience = (e) => setForm({ ...form, target_type: e.target.value, target_id: '' })
  const payload = () => ({
    ...form,
    target_id: form.target_type === 'all' ? null : Number(form.target_id),
    starts_at: localInputToIso(form.starts_at),
    ends_at: localInputToIso(form.ends_at),
  })
  const options = form.target_type === 'all' ? [] : targets[form.target_type]

  const { busy, error, submit } = useSubmit(
    () => (announcement ? consoleApi.updateAnnouncement(announcement.id, payload()) : consoleApi.createAnnouncement(payload())),
    onSaved
  )

  return (
    <Modal
      title={announcement ? 'Edit Announcement' : 'New Announcement'}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="cs-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="announcement-form" className="cs-btn cs-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="announcement-form" className="cs-form" onSubmit={submit}>
        <Field label="Title"><input value={form.title} onChange={set('title')} maxLength={120} required /></Field>
        <Field label="Body"><textarea rows={4} value={form.body} onChange={set('body')} maxLength={600} required /></Field>
        <div className="cs-form-row">
          <Field label="Audience">
            <select value={form.target_type} onChange={setAudience}>
              {AUDIENCES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </Field>
          {form.target_type !== 'all' && (
            <Field label={AUDIENCES.find(([v]) => v === form.target_type)[1]}>
              <select value={form.target_id} onChange={set('target_id')} required>
                <option value="">Choose…</option>
                {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </Field>
          )}
        </div>
        <Field
          label="Display"
          hint={form.display_mode === 'modal'
            ? 'A pop-up each recipient must acknowledge. Read / unread is tracked, and a push notification is sent on publish (not for scheduled ones).'
            : 'Listed in the announcements section of the home page.'}
        >
          <select value={form.display_mode} onChange={set('display_mode')}>
            <option value="feed">Home page</option>
            <option value="modal">Pop-up (must acknowledge)</option>
          </select>
        </Field>
        <div className="cs-form-row">
          <Field label="Go live at" hint="Blank = live immediately.">
            <input type="datetime-local" value={form.starts_at} onChange={set('starts_at')} />
          </Field>
          <Field label="Take down at" hint="Blank = stays up until deleted.">
            <input type="datetime-local" value={form.ends_at} min={form.starts_at || undefined} onChange={set('ends_at')} />
          </Field>
        </div>
        <div className="cs-form-row">
          <Field label="Posted by" hint="Leave blank to use your title."><input value={form.posted_by} onChange={set('posted_by')} maxLength={60} /></Field>
          <Field label="Date shown"><input type="date" value={form.posted_at} onChange={set('posted_at')} required /></Field>
        </div>
        <Field label="Accent">
          <select value={form.accent} onChange={set('accent')}>
            {TAG_VARIANTS.map((v) => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}
          </select>
        </Field>
        <TagsField tags={form.tags} onChange={(tags) => setForm({ ...form, tags })} />
        <details>
          <summary className="cs-muted">中文版本（選填，中文介面使用）</summary>
          <div className="cs-form" style={{ marginTop: '0.75rem' }}>
            <Field label="標題"><input value={form.title_zh} onChange={set('title_zh')} maxLength={120} /></Field>
            <Field label="內容"><textarea rows={4} value={form.body_zh} onChange={set('body_zh')} maxLength={600} /></Field>
          </div>
        </details>
        {error && <p className="cs-error">{error}</p>}
      </form>
    </Modal>
  )
}

function ReadersModal({ announcement, onClose }) {
  const readers = useLoader(() => consoleApi.announcementReaders(announcement.id), (r) => r.readers)
  const unread = readers.data?.filter((r) => !r.acked_at).length

  return (
    <Modal title={`Read status — ${announcement.title}`} onClose={onClose} wide footer={<button type="button" className="cs-btn" onClick={onClose}>Close</button>}>
      {readers.error && <p className="cs-error">{readers.error}</p>}
      {!readers.data && !readers.error && <p className="cs-muted">Loading…</p>}
      {readers.data && (
        <>
          <p className="cs-muted">{readers.data.length - unread} of {readers.data.length} acknowledged · {unread} unread</p>
          <table className="cs-table">
            <thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Acknowledged at</th></tr></thead>
            <tbody>
              {readers.data.map((r) => (
                <tr key={r.id}>
                  <td className="cs-strong">{r.name}</td>
                  <td>{r.role_label ?? '—'}</td>
                  <td>{r.acked_at ? 'Read' : 'Unread'}</td>
                  <td>{formatUtc(r.acked_at) ?? '—'}</td>
                </tr>
              ))}
              {readers.data.length === 0 && <tr><td colSpan={4} className="cs-muted">No recipients.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  )
}

export function AnnouncementsPage() {
  const list = useLoader(consoleApi.listAnnouncements, (r) => r.announcements)
  const brands = useLoader(consoleApi.listBrands, (r) => r.brands)
  const roles = useLoader(consoleApi.listRoles, (r) => r.roles)
  const users = useLoader(consoleApi.listUsers, (r) => r.users)
  const [modal, setModal] = useState(null)

  const targets = {
    brand: (brands.data ?? []).map((b) => ({ id: b.id, label: b.label })),
    role: (roles.data ?? []).map((r) => ({ id: r.id, label: r.label })),
    user: (users.data ?? []).filter((u) => u.is_active).map((u) => ({ id: u.id, label: `${u.name} (${u.email})` })),
  }
  const ready = list.data && brands.data && roles.data && users.data

  const saved = () => { setModal(null); list.reload() }

  return (
    <>
      <PageHead
        title="Announcements"
        subtitle="theLOOP HQ announcements for everyone, a brand, a role or one person, shown only between go-live and take-down. Show them in the home-page list, or as a pop-up each recipient must acknowledge (read / unread is tracked)."
        action={<button className="cs-btn cs-btn--primary" onClick={() => setModal({ kind: 'edit' })} disabled={!ready}>+ New Announcement</button>}
      />
      {(list.error || brands.error || roles.error || users.error) && <p className="cs-error">{list.error || brands.error || roles.error || users.error}</p>}
      {!list.data && !list.error && <p className="cs-muted">Loading…</p>}

      {list.data && (
        <table className="cs-table">
          <thead><tr><th>Title</th><th>Status</th><th>Audience</th><th>Display</th><th>Read</th><th>Go live</th><th>Take down</th><th className="cs-col-actions">Actions</th></tr></thead>
          <tbody>
            {list.data.map((a) => (
              <tr key={a.id}>
                <td className="cs-strong">{a.title}</td>
                <td>{statusOf(a)}</td>
                <td>{audienceLabel(a)}</td>
                <td>{a.display_mode === 'modal' ? 'Pop-up' : 'Home page'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {a.display_mode === 'modal'
                    ? <button className="cs-link" onClick={() => setModal({ kind: 'readers', announcement: a })}>{a.ack_count} / {a.recipient_count}</button>
                    : '—'}
                </td>
                <td>{formatUtc(a.starts_at) ?? 'Immediately'}</td>
                <td>{formatUtc(a.ends_at) ?? 'Never'}</td>
                <td className="cs-col-actions">
                  <button className="cs-link" onClick={() => setModal({ kind: 'edit', announcement: a })}>Edit</button>
                  <button className="cs-link cs-link--danger" onClick={() => setModal({ kind: 'delete', announcement: a })}>Delete</button>
                </td>
              </tr>
            ))}
            {list.data.length === 0 && <tr><td colSpan={8} className="cs-muted">No announcements yet.</td></tr>}
          </tbody>
        </table>
      )}

      {modal?.kind === 'readers' && <ReadersModal announcement={modal.announcement} onClose={() => setModal(null)} />}
      {modal?.kind === 'edit' && <AnnouncementModal announcement={modal.announcement} targets={targets} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete announcement"
          message={`Delete "${modal.announcement.title}"? It disappears from every dashboard.`}
          onClose={() => setModal(null)}
          onConfirm={async () => { await consoleApi.deleteAnnouncement(modal.announcement.id); list.reload() }}
        />
      )}
    </>
  )
}
