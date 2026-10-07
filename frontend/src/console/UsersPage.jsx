import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { consoleApi } from '../api/console'
import { ConfirmDialog, Field, Modal, PageHead, useLoader, useSubmit } from './ui'

function UserModal({ user, roles, brands, onClose, onSaved }) {
  const { user: me } = useAuth()
  const editing = Boolean(user)
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    title: user?.title ?? '',
    role_id: user?.role_id ? String(user.role_id) : '',
    brand_ids: new Set((user?.brands ?? []).map((b) => b.id)),
    password: '',
    is_active: user ? Boolean(user.is_active) : true,
  })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  function toggleBrand(id) {
    const next = new Set(form.brand_ids)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setForm({ ...form, brand_ids: next })
  }
  const isSelf = editing && user.id === me.id
  const isOwnership = user?.role_key === 'ownership'

  const { busy, error, submit } = useSubmit(async () => {
    const payload = { name: form.name, email: form.email, title: form.title, is_active: form.is_active, brand_ids: [...form.brand_ids] }
    if (!isOwnership) payload.role_id = Number(form.role_id)
    if (form.brand_ids.size === 0) throw new Error('Select at least one brand')
    if (form.password) payload.password = form.password
    if (editing) {
      if (isSelf) delete payload.role_id
      await consoleApi.updateUser(user.id, payload)
    } else {
      await consoleApi.createUser({ ...payload, password: form.password })
    }
  }, onSaved)

  return (
    <Modal
      title={editing ? `Edit ${user.name}` : 'New User'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="cs-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="user-form" className="cs-btn cs-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save Changes' : 'Create User'}
          </button>
        </>
      }
    >
      <form id="user-form" className="cs-form" onSubmit={submit}>
        <Field label="Name"><input value={form.name} onChange={set('name')} required /></Field>
        <Field label="Email"><input type="email" value={form.email} onChange={set('email')} required /></Field>
        <Field label="Title"><input value={form.title} onChange={set('title')} /></Field>
        <Field label="Role" hint={isOwnership ? 'Ownership accounts keep their role.' : isSelf ? 'You cannot change your own role.' : null}>
          {isOwnership ? (
            <input value="Ownership" disabled />
          ) : (
            <select value={form.role_id} onChange={set('role_id')} required disabled={isSelf}>
              <option value="" disabled>Select a role</option>
              {roles.filter((r) => r.key !== 'ownership').map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          )}
        </Field>
        <div className="cs-field">
          <span className="cs-field-label">Brands ({form.brand_ids.size}/{brands.length})</span>
          <div className="cs-perm-grid">
            {brands.map((b) => (
              <label key={b.id} className="cs-perm">
                <input type="checkbox" checked={form.brand_ids.has(b.id)} onChange={() => toggleBrand(b.id)} />
                <span>{b.label}</span>
              </label>
            ))}
          </div>
          <span className="cs-field-hint">The user only sees data belonging to these brands. At least one is required.</span>
        </div>
        <Field label={editing ? 'Reset Password' : 'Password'} hint={editing ? 'Leave blank to keep the current password. Resetting signs the user out.' : 'At least 8 characters.'}>
          <input type="password" value={form.password} onChange={set('password')} minLength={8} required={!editing} autoComplete="new-password" />
        </Field>
        <label className="cs-check">
          <input type="checkbox" checked={form.is_active} onChange={set('is_active')} disabled={isSelf} />
          Active (can sign in)
        </label>
        {error && <p className="cs-error">{error}</p>}
      </form>
    </Modal>
  )
}

export function UsersPage() {
  const { user: me } = useAuth()
  const users = useLoader(consoleApi.listUsers, (r) => r.users)
  const roles = useLoader(consoleApi.listRoles, (r) => r.roles)
  const brands = useLoader(consoleApi.listBrands, (r) => r.brands)
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [modal, setModal] = useState(null) // { kind: 'edit'|'delete', user? }
  const [rowError, setRowError] = useState(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (users.data ?? []).filter(
      (u) =>
        (!roleFilter || String(u.role_id) === roleFilter) &&
        (!brandFilter || u.brands.some((b) => String(b.id) === brandFilter)) &&
        (!q || [u.name, u.email, u.title].some((v) => v?.toLowerCase().includes(q)))
    )
  }, [users.data, query, roleFilter, brandFilter])

  async function toggleActive(u) {
    setRowError(null)
    try {
      await consoleApi.updateUser(u.id, { is_active: !u.is_active })
      users.reload()
    } catch (err) {
      setRowError(err.message)
    }
  }

  const loadError = users.error || roles.error || brands.error
  const ready = users.data && roles.data && brands.data

  return (
    <>
      <PageHead
        title="Users"
        subtitle={ready ? `${users.data.length} accounts` : 'Accounts and their roles'}
        action={<button className="cs-btn cs-btn--primary" onClick={() => setModal({ kind: 'edit' })} disabled={!ready}>+ New User</button>}
      />

      <div className="cs-toolbar">
        <input className="cs-search" placeholder="Search name, email, or title…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {(roles.data ?? []).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
          <option value="">All brands</option>
          {(brands.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
        </select>
      </div>

      {(loadError || rowError) && <p className="cs-error">{loadError || rowError}</p>}
      {!ready && !loadError && <p className="cs-muted">Loading…</p>}

      {ready && (
        <table className="cs-table">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Title</th><th>Role</th><th>Brands</th><th>Status</th><th className="cs-col-actions">Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const locked = u.role_key === 'ownership' && me.role.key !== 'ownership'
              return (
                <tr key={u.id}>
                  <td className="cs-strong">{u.name}{u.id === me.id && <span className="cs-you">you</span>}</td>
                  <td>{u.email}</td>
                  <td>{u.title || '—'}</td>
                  <td><span className="cs-tag">{u.role_label ?? 'No role'}</span></td>
                  <td>
                    <div className="cs-chips">
                      {u.brands.map((b) => <span key={b.id} className="cs-tag cs-tag--muted">{b.label}</span>)}
                      {u.brands.length === 0 && <span className="cs-muted">None</span>}
                    </div>
                  </td>
                  <td><span className={`cs-tag ${u.is_active ? 'cs-tag--ok' : 'cs-tag--off'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="cs-col-actions">
                    <button className="cs-link" onClick={() => setModal({ kind: 'edit', user: u })} disabled={locked}>Edit</button>
                    <button className="cs-link" onClick={() => toggleActive(u)} disabled={locked || u.id === me.id}>
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="cs-link cs-link--danger" onClick={() => setModal({ kind: 'delete', user: u })} disabled={locked || u.id === me.id}>Delete</button>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && <tr><td colSpan={7} className="cs-empty">No users match.</td></tr>}
          </tbody>
        </table>
      )}

      {modal?.kind === 'edit' && (
        <UserModal user={modal.user} roles={roles.data} brands={brands.data} onClose={() => setModal(null)} onSaved={() => { setModal(null); users.reload(); roles.reload(); brands.reload() }} />
      )}
      {modal?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete user"
          message={`Permanently delete ${modal.user.name} (${modal.user.email})? This cannot be undone. Consider deactivating instead.`}
          onClose={() => setModal(null)}
          onConfirm={async () => { await consoleApi.deleteUser(modal.user.id); users.reload(); roles.reload() }}
        />
      )}
    </>
  )
}
