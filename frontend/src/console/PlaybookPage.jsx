import { useState } from 'react'
import { consoleApi } from '../api/console'
import { ConfirmDialog, Field, Modal, PageHead, useLoader, useSubmit } from './ui'

const KINDS = [
  ['heading', 'Heading', 'A small grey label that starts a group, e.g. "CORE VISION".'],
  ['card', 'Card', 'A card of free text.'],
  ['behavior', 'Behavior', 'A numbered rule with Good / Miss examples. Numbers follow the order.'],
]
const EMPTY = { kind: 'behavior', title: '', body: '', good: '', miss: '', title_zh: '', body_zh: '', good_zh: '', miss_zh: '' }
const BODY_HINT = 'Blank line = new paragraph · "- " starts a bullet · "# " makes a subheading.'
const preview = (s) => (s.kind === 'card' ? s.body : s.title).replace(/^# /, '').slice(0, 70)

function SectionModal({ section, onClose, onSaved }) {
  const [form, setForm] = useState(section ? Object.fromEntries(Object.keys(EMPTY).map((k) => [k, section[k] ?? ''])) : EMPTY)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const { busy, error, submit } = useSubmit(
    () => (section ? consoleApi.updatePlaybookSection(section.id, form) : consoleApi.createPlaybookSection(form)),
    onSaved
  )
  const { kind } = form
  const hasTitle = kind !== 'card'
  const hasBody = kind !== 'heading'
  const behavior = kind === 'behavior'

  return (
    <Modal
      title={section ? 'Edit Section' : 'New Section'}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="cs-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="playbook-form" className="cs-btn cs-btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      <form id="playbook-form" className="cs-form" onSubmit={submit}>
        <Field label="Type" hint={KINDS.find((k) => k[0] === kind)[2]}>
          <select value={kind} onChange={set('kind')}>
            {KINDS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </Field>
        {hasTitle && <Field label="Title"><input value={form.title} onChange={set('title')} maxLength={120} required /></Field>}
        {hasBody && <Field label="Body" hint={BODY_HINT}><textarea rows={behavior ? 6 : 12} value={form.body} onChange={set('body')} maxLength={4000} required /></Field>}
        {behavior && (
          <>
            <Field label="Good example"><textarea rows={2} value={form.good} onChange={set('good')} maxLength={400} /></Field>
            <Field label="Miss example"><textarea rows={2} value={form.miss} onChange={set('miss')} maxLength={400} /></Field>
          </>
        )}
        <details>
          <summary className="cs-muted">中文版本（選填，中文介面使用）</summary>
          <div className="cs-form" style={{ marginTop: '0.75rem' }}>
            {hasTitle && <Field label="標題"><input value={form.title_zh} onChange={set('title_zh')} maxLength={120} /></Field>}
            {hasBody && <Field label="內容" hint={BODY_HINT}><textarea rows={behavior ? 6 : 12} value={form.body_zh} onChange={set('body_zh')} maxLength={4000} /></Field>}
            {behavior && (
              <>
                <Field label="正確示範"><textarea rows={2} value={form.good_zh} onChange={set('good_zh')} maxLength={400} /></Field>
                <Field label="常見失誤"><textarea rows={2} value={form.miss_zh} onChange={set('miss_zh')} maxLength={400} /></Field>
              </>
            )}
          </div>
        </details>
        {error && <p className="cs-error">{error}</p>}
      </form>
    </Modal>
  )
}

function ReadsModal({ section, onClose }) {
  const [tab, setTab] = useState('unread')
  const reads = useLoader(() => consoleApi.playbookReads(section.id), (r) => r)
  const rows = reads.data ? reads.data[tab] : []
  return (
    <Modal title={`Read status — ${preview(section) || 'Section'}`} onClose={onClose} footer={<button type="button" className="cs-btn" onClick={onClose}>Close</button>}>
      {reads.error && <p className="cs-error">{reads.error}</p>}
      {!reads.data && !reads.error && <p className="cs-muted">Loading…</p>}
      {reads.data && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <button type="button" className={`cs-btn ${tab === 'unread' ? 'cs-btn--primary' : ''}`} onClick={() => setTab('unread')}>Not read ({reads.data.unread.length})</button>
            <button type="button" className={`cs-btn ${tab === 'read' ? 'cs-btn--primary' : ''}`} onClick={() => setTab('read')}>Read ({reads.data.read.length})</button>
          </div>
          <table className="cs-table">
            <thead><tr><th>Name</th><th>Title</th><th>{tab === 'read' ? 'Read at' : 'Email'}</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td className="cs-strong">{u.name}</td>
                  <td>{u.title || '—'}</td>
                  <td>{tab === 'read' ? u.read_at : u.email}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={3} className="cs-muted">{tab === 'read' ? 'Nobody has read this yet.' : 'Everyone has read this.'}</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  )
}

export function PlaybookPage() {
  const list = useLoader(consoleApi.listPlaybook, (r) => r)
  const [modal, setModal] = useState(null)
  const [error, setError] = useState(null)
  const saved = () => { setModal(null); list.reload() }

  async function move(i, delta) {
    const ids = list.data.sections.map((s) => s.id)
    ;[ids[i], ids[i + delta]] = [ids[i + delta], ids[i]]
    try {
      await consoleApi.reorderPlaybook(ids)
      setError(null)
      list.reload()
    } catch (err) {
      setError(err.message)
    }
  }

  let rule = 0
  return (
    <>
      <PageHead
        title="Playbook"
        subtitle="The Playbook shown to every account from the home screen. Staff tick each card and behavior as read; the Read column shows how many active accounts have."
        action={<button className="cs-btn cs-btn--primary" onClick={() => setModal({ kind: 'edit' })} disabled={!list.data}>+ New Section</button>}
      />
      {(list.error || error) && <p className="cs-error">{list.error || error}</p>}
      {!list.data && !list.error && <p className="cs-muted">Loading…</p>}

      {list.data && (
        <table className="cs-table">
          <thead><tr><th>#</th><th>Type</th><th>Content</th><th>Read</th><th className="cs-col-actions">Actions</th></tr></thead>
          <tbody>
            {list.data.sections.map((s, i, all) => {
              if (s.kind === 'behavior') rule += 1
              return (
                <tr key={s.id}>
                  <td>{s.kind === 'behavior' ? rule : ''}</td>
                  <td>{KINDS.find((k) => k[0] === s.kind)[1]}</td>
                  <td className={s.kind === 'heading' ? 'cs-muted' : 'cs-strong'}>{preview(s)}</td>
                  <td>
                    {s.kind === 'heading' ? '—' : (
                      <button className="cs-link" onClick={() => setModal({ kind: 'reads', section: s })}>{s.read_count} / {list.data.user_count}</button>
                    )}
                  </td>
                  <td className="cs-col-actions">
                    <button className="cs-link" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                    <button className="cs-link" onClick={() => move(i, 1)} disabled={i === all.length - 1} aria-label="Move down">↓</button>
                    <button className="cs-link" onClick={() => setModal({ kind: 'edit', section: s })}>Edit</button>
                    <button className="cs-link cs-link--danger" onClick={() => setModal({ kind: 'delete', section: s })}>Delete</button>
                  </td>
                </tr>
              )
            })}
            {list.data.sections.length === 0 && <tr><td colSpan={5} className="cs-muted">No sections yet.</td></tr>}
          </tbody>
        </table>
      )}

      {modal?.kind === 'edit' && <SectionModal section={modal.section} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.kind === 'reads' && <ReadsModal section={modal.section} onClose={() => setModal(null)} />}
      {modal?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete section"
          message={`Delete "${preview(modal.section) || 'this section'}"? Its read ticks are removed too.`}
          onClose={() => setModal(null)}
          onConfirm={async () => { await consoleApi.deletePlaybookSection(modal.section.id); list.reload() }}
        />
      )}
    </>
  )
}
