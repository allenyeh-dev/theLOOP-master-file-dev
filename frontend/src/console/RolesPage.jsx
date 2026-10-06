import { useState } from 'react'
import { consoleApi } from '../api/console'
import { ConfirmDialog, Field, Modal, PageHead, useLoader, useSubmit } from './ui'

function RoleModal({ role, permissions, onClose, onSaved }) {
  const editing = Boolean(role)
  const [form, setForm] = useState({
    key: role?.key ?? '',
    label: role?.label ?? '',
    permission_ids: new Set(role?.permission_ids ?? []),
  })

  function toggle(id) {
    const next = new Set(form.permission_ids)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setForm({ ...form, permission_ids: next })
  }

  const { busy, error, submit } = useSubmit(async () => {
    const payload = { label: form.label, permission_ids: [...form.permission_ids] }
    if (editing) {
      if (!role.is_system) payload.key = form.key
      await consoleApi.updateRole(role.id, payload)
    } else {
      await consoleApi.createRole({ ...payload, key: form.key })
    }
  }, onSaved)

  return (
    <Modal
      wide
      title={editing ? `Edit role: ${role.label}` : 'New Role'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="cs-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="role-form" className="cs-btn cs-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save Changes' : 'Create Role'}
          </button>
        </>
      }
    >
      <form id="role-form" className="cs-form" onSubmit={submit}>
        <div className="cs-form-row">
          <Field label="Label"><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required /></Field>
          <Field label="Key" hint={role?.is_system ? 'System role keys are fixed.' : 'Lowercase, digits, underscore.'}>
            <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} disabled={role?.is_system} required />
          </Field>
        </div>

        <div className="cs-field">
          <span className="cs-field-label">Permissions ({form.permission_ids.size}/{permissions.length})</span>
          <div className="cs-perm-grid">
            {permissions.map((p) => (
              <label key={p.id} className="cs-perm">
                <input type="checkbox" checked={form.permission_ids.has(p.id)} onChange={() => toggle(p.id)} />
                <span>
                  <code>{p.key}</code>
                  <small>{p.description}</small>
                </span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="cs-error">{error}</p>}
      </form>
    </Modal>
  )
}

export function RolesPage() {
  const roles = useLoader(consoleApi.listRoles, (r) => r.roles)
  const perms = useLoader(consoleApi.listPermissions, (r) => r.permissions)
  const [modal, setModal] = useState(null)

  const ready = roles.data && perms.data
  const error = roles.error || perms.error
  const reload = () => { roles.reload(); perms.reload() }

  return (
    <>
      <PageHead
        title="Roles"
        subtitle="A role is a named bundle of permissions assigned to users."
        action={<button className="cs-btn cs-btn--primary" onClick={() => setModal({ kind: 'edit' })} disabled={!ready}>+ New Role</button>}
      />
      {error && <p className="cs-error">{error}</p>}
      {!ready && !error && <p className="cs-muted">Loading…</p>}

      {ready && (
        <table className="cs-table">
          <thead>
            <tr><th>Role</th><th>Key</th><th>Permissions</th><th>Users</th><th className="cs-col-actions">Actions</th></tr>
          </thead>
          <tbody>
            {roles.data.map((r) => (
              <tr key={r.id}>
                <td className="cs-strong">
                  {r.label}
                  {r.is_system && <span className="cs-tag cs-tag--muted">system</span>}
                </td>
                <td><code>{r.key}</code></td>
                <td>
                  <div className="cs-chips">
                    {perms.data.filter((p) => r.permission_ids.includes(p.id)).map((p) => <code key={p.id} className="cs-chip">{p.key}</code>)}
                    {r.permission_ids.length === 0 && <span className="cs-muted">None</span>}
                  </div>
                </td>
                <td>{r.user_count}</td>
                <td className="cs-col-actions">
                  {r.is_locked ? (
                    <span className="cs-muted">Locked</span>
                  ) : (
                    <>
                      <button className="cs-link" onClick={() => setModal({ kind: 'edit', role: r })}>Edit</button>
                      <button className="cs-link cs-link--danger" onClick={() => setModal({ kind: 'delete', role: r })} disabled={r.is_system}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal?.kind === 'edit' && (
        <RoleModal role={modal.role} permissions={perms.data} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload() }} />
      )}
      {modal?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete role"
          message={`Delete the role "${modal.role.label}"? ${modal.role.user_count > 0 ? `It is assigned to ${modal.role.user_count} user(s), so the server will refuse until they are reassigned.` : 'This cannot be undone.'}`}
          onClose={() => setModal(null)}
          onConfirm={async () => { await consoleApi.deleteRole(modal.role.id); reload() }}
        />
      )}
    </>
  )
}
