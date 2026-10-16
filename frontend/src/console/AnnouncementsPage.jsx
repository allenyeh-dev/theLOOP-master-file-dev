import { useState } from 'react'
import { consoleApi } from '../api/console'
import { ConfirmDialog, Field, Modal, PageHead, TAG_VARIANTS, TagsField, formatUtc, localInputToIso, useLoader, useSubmit, utcToLocalInput } from './ui'

const today = () => new Date().toISOString().slice(0, 10)
const EMPTY = {
  title: '', body: '', title_zh: '', body_zh: '', accent: 'gold', posted_by: '', posted_at: today(),
  tags: [], starts_at: '', ends_at: '',
}

// 'Scheduled' (not yet live) / 'Live' / 'Expired', judged against the browser clock.
function statusOf(a) {
  const now = Date.now()
  const utc = (s) => new Date(s.replace(' ', 'T') + 'Z').getTime()
  if (a.starts_at && utc(a.starts_at) > now) return 'Scheduled'
  if (a.ends_at && utc(a.ends_at) <= now) return 'Expired'
  return 'Live'
}

function AnnouncementModal({ announcement, onClose, onSaved }) {
  const [form, setForm] = useState(
    announcement
      ? { ...EMPTY, ...announcement, title_zh: announcement.title_zh ?? '', body_zh: announcement.body_zh ?? '',
          tags: announcement.tags.map((t) => ({ ...t, label_zh: t.label_zh ?? '' })),
          starts_at: utcToLocalInput(announcement.starts_at), ends_at: utcToLocalInput(announcement.ends_at) }
      : EMPTY
  )
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const payload = () => ({ ...form, starts_at: localInputToIso(form.starts_at), ends_at: localInputToIso(form.ends_at) })

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

export function AnnouncementsPage() {
  const list = useLoader(consoleApi.listAnnouncements, (r) => r.announcements)
  const [modal, setModal] = useState(null)

  const saved = () => { setModal(null); list.reload() }

  return (
    <>
      <PageHead
        title="Announcements"
        subtitle="theLOOP HQ announcements, shown to everyone at the top of the home page only between go-live and take-down. Staff see the 2 newest; the rest are a swipe away."
        action={<button className="cs-btn cs-btn--primary" onClick={() => setModal({ kind: 'edit' })} disabled={!list.data}>+ New Announcement</button>}
      />
      {list.error && <p className="cs-error">{list.error}</p>}
      {!list.data && !list.error && <p className="cs-muted">Loading…</p>}

      {list.data && (
        <table className="cs-table">
          <thead><tr><th>Title</th><th>Status</th><th>Tags</th><th>Go live</th><th>Take down</th><th className="cs-col-actions">Actions</th></tr></thead>
          <tbody>
            {list.data.map((a) => (
              <tr key={a.id}>
                <td className="cs-strong">{a.title}</td>
                <td>{statusOf(a)}</td>
                <td>{a.tags.map((t) => t.label).join(', ') || '—'}</td>
                <td>{formatUtc(a.starts_at) ?? 'Immediately'}</td>
                <td>{formatUtc(a.ends_at) ?? 'Never'}</td>
                <td className="cs-col-actions">
                  <button className="cs-link" onClick={() => setModal({ kind: 'edit', announcement: a })}>Edit</button>
                  <button className="cs-link cs-link--danger" onClick={() => setModal({ kind: 'delete', announcement: a })}>Delete</button>
                </td>
              </tr>
            ))}
            {list.data.length === 0 && <tr><td colSpan={6} className="cs-muted">No announcements yet.</td></tr>}
          </tbody>
        </table>
      )}

      {modal?.kind === 'edit' && <AnnouncementModal announcement={modal.announcement} onClose={() => setModal(null)} onSaved={saved} />}
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
