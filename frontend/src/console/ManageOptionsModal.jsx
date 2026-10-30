import { useState } from 'react'
import { ConfirmDialog, Modal } from './ui'

const ROW = { display: 'flex', gap: '0.5rem', alignItems: 'center' }

// Add / rename / delete the items of a lookup list (e.g. categories) without leaving the page.
export function ManageOptionsModal({ title, items, api, onClose, onChanged }) {
  const [drafts, setDrafts] = useState({})
  const [fresh, setFresh] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [del, setDel] = useState(null)

  const draftOf = (it) => drafts[it.id] ?? it.label
  const dirty = (it) => draftOf(it).trim() !== it.label

  async function run(fn, after) {
    setBusy(true); setError(null)
    try {
      await fn()
      await onChanged()
      after?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const save = (it) => run(
    () => api.update(it.id, { label: draftOf(it) }),
    () => setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([id]) => Number(id) !== it.id)))
  )
  const add = () => run(
    () => api.create({ label: fresh }),
    () => setFresh('')
  )

  return (
    <Modal title={title} onClose={onClose} footer={<button type="button" className="cs-btn" onClick={onClose}>Done</button>}>
      <div className="cs-form">
        {items.map((it) => (
          <div key={it.id} style={ROW}>
            <input style={{ flex: 1 }} value={draftOf(it)} onChange={(e) => setDrafts({ ...drafts, [it.id]: e.target.value })} />
            <button type="button" className="cs-link" disabled={busy || !dirty(it) || !draftOf(it).trim()} onClick={() => save(it)}>Save</button>
            <button type="button" className="cs-link cs-link--danger" disabled={busy} onClick={() => setDel(it)}>Delete</button>
          </div>
        ))}
        <div style={ROW}>
          <input style={{ flex: 1 }} value={fresh} onChange={(e) => setFresh(e.target.value)} placeholder="New name" />
          <button type="button" className="cs-link" disabled={busy || !fresh.trim()} onClick={add}>+ Add</button>
        </div>
        {error && <p className="cs-error">{error}</p>}
      </div>
      {del && (
        <ConfirmDialog
          title="Delete"
          message={`Delete "${del.label}"? The server refuses if it is still in use.`}
          onClose={() => setDel(null)}
          onConfirm={async () => { await api.remove(del.id); await onChanged() }}
        />
      )}
    </Modal>
  )
}
