import { useState } from 'react'
import { consoleApi } from '../api/console'
import { ConfirmDialog, Field, Modal, PageHead, useLoader, useSubmit } from './ui'

function PermissionModal({ permission, onClose, onSaved }) {
  const editing = Boolean(permission)
  const [form, setForm] = useState({ key: permission?.key ?? '', description: permission?.description ?? '' })

  const { busy, error, submit } = useSubmit(async () => {
    if (editing) {
      const payload = { description: form.description }
      if (!permission.is_system) payload.key = form.key
      await consoleApi.updatePermission(permission.id, payload)
    } else {
      await consoleApi.createPermission(form)
    }
  }, onSaved)

  return (
    <Modal
      title={editing ? `Edit permission` : 'New Permission'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="cs-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="perm-form" className="cs-btn cs-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save Changes' : 'Create Permission'}
          </button>
        </>
      }
    >
      <form id="perm-form" className="cs-form" onSubmit={submit}>
        <Field label="Key" hint={permission?.is_system ? 'System permission keys are fixed (the app checks them by name).' : 'e.g. orders.refund — the app must check this key to have any effect.'}>
          <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} disabled={permission?.is_system} required />
        </Field>
        <Field label="Description">
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        </Field>
        {error && <p className="cs-error">{error}</p>}
      </form>
    </Modal>
  )
}

export function PermissionsPage() {
  const perms = useLoader(consoleApi.listPermissions, (r) => r.permissions)
  const [modal, setModal] = useState(null)

  return (
    <>
      <PageHead
        title="Permissions"
        subtitle="Fine-grained capabilities that roles can be granted."
        action={<button className="cs-btn cs-btn--primary" onClick={() => setModal({ kind: 'edit' })}>+ New Permission</button>}
      />
      {perms.error && <p className="cs-error">{perms.error}</p>}
      {!perms.data && !perms.error && <p className="cs-muted">Loading…</p>}

      {perms.data && (
        <table className="cs-table">
          <thead>
            <tr><th>Key</th><th>Description</th><th>Roles</th><th className="cs-col-actions">Actions</th></tr>
          </thead>
          <tbody>
            {perms.data.map((p) => (
              <tr key={p.id}>
                <td><code>{p.key}</code>{p.is_system && <span className="cs-tag cs-tag--muted">system</span>}</td>
                <td>{p.description}</td>
                <td>{p.role_count}</td>
                <td className="cs-col-actions">
                  <button className="cs-link" onClick={() => setModal({ kind: 'edit', permission: p })}>Edit</button>
                  <button className="cs-link cs-link--danger" onClick={() => setModal({ kind: 'delete', permission: p })} disabled={p.is_system}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal?.kind === 'edit' && (
        <PermissionModal permission={modal.permission} onClose={() => setModal(null)} onSaved={() => { setModal(null); perms.reload() }} />
      )}
      {modal?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete permission"
          message={`Delete "${modal.permission.key}"? It will be removed from ${modal.permission.role_count} role(s).`}
          onClose={() => setModal(null)}
          onConfirm={async () => { await consoleApi.deletePermission(modal.permission.id); perms.reload() }}
        />
      )}
    </>
  )
}
