import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchAdminUsers, fetchBrands, createUser, updateUser } from '../api/users'
import { ArrowLeftIcon } from './icons'
import './AdminPanel.css'

const emptyForm = { name: '', email: '', password: '', title: '', role_id: '', brand_ids: [] }

const toggleId = (ids, id) => (ids.includes(id) ? ids.filter((n) => n !== id) : [...ids, id])

function BrandPicker({ brands, value, onChange }) {
  return (
    <fieldset className="admin-brand-picker">
      <legend>Brands</legend>
      {brands.map((b) => (
        <label key={b.id} className="admin-user-active-toggle">
          <input type="checkbox" checked={value.includes(b.id)} onChange={() => onChange(toggleId(value, b.id))} />
          {b.label}
        </label>
      ))}
    </fieldset>
  )
}

export function AdminPanel({ roles, onClose }) {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [brands, setBrands] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState(null)

  function loadUsers() {
    setLoading(true)
    fetchAdminUsers()
      .then((data) => setUsers(data.users))
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadUsers()
    fetchBrands()
      .then((data) => setBrands(data.brands))
      .catch((err) => setLoadError(err.message))
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setCreateError(null)
    if (form.brand_ids.length === 0) {
      setCreateError('Select at least one brand')
      return
    }
    setCreating(true)
    try {
      await createUser({
        name: form.name,
        email: form.email,
        password: form.password,
        title: form.title || null,
        role_id: Number(form.role_id),
        brand_ids: form.brand_ids,
      })
      setForm(emptyForm)
      setShowCreate(false)
      loadUsers()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  function startEdit(u) {
    setEditingId(u.id)
    setEditError(null)
    setEditForm({ title: u.title || '', role_id: String(u.role_id || ''), is_active: !!u.is_active, brand_ids: u.brands.map((b) => b.id) })
  }

  async function handleSaveEdit(id) {
    setEditError(null)
    if (editForm.brand_ids.length === 0) {
      setEditError('Select at least one brand')
      return
    }
    setSavingEdit(true)
    try {
      await updateUser(id, {
        title: editForm.title || null,
        role_id: Number(editForm.role_id),
        is_active: editForm.is_active,
        brand_ids: editForm.brand_ids,
      })
      setEditingId(null)
      loadUsers()
    } catch (err) {
      setEditError(err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleToggleActive(u) {
    setLoadError(null)
    try {
      await updateUser(u.id, { is_active: !u.is_active })
      loadUsers()
    } catch (err) {
      setLoadError(err.message)
    }
  }

  return (
    <div className="admin-screen">
      <header className="admin-screen-header">
        <button type="button" className="admin-screen-back" onClick={onClose} aria-label="Back">
          <ArrowLeftIcon />
        </button>
        <h1 className="admin-screen-title">Admin Panel</h1>
        <span className="admin-screen-header-spacer" />
      </header>

      <main className="admin-screen-content">
        <div className="admin-panel-toolbar">
          <p className="section-label">ACCOUNTS &amp; PERMISSIONS</p>
          <button type="button" className="admin-panel-new" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? 'Cancel' : '+ New Account'}
          </button>
        </div>

        {showCreate && (
          <form className="admin-panel-form" onSubmit={handleCreate}>
            <label>
              Name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>
            <label>
              Title
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label>
              Role
              <select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} required>
                <option value="" disabled>
                  Select a role
                </option>
                {roles.map((r) => (
                  <option key={r.key} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <BrandPicker brands={brands} value={form.brand_ids} onChange={(brand_ids) => setForm({ ...form, brand_ids })} />
            <label>
              Temporary Password
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={8}
                required
              />
            </label>

            {createError && <p className="error-text">{createError}</p>}

            <button type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create Account'}
            </button>
          </form>
        )}

        {loading && <p className="muted">Loading accounts…</p>}
        {loadError && <p className="error-text">{loadError}</p>}

        {!loading && !loadError && (
          <ul className="admin-user-list">
            {users.map((u) => (
              <li key={u.id} className="admin-user-card">
                {editingId === u.id ? (
                  <div className="admin-user-edit">
                    <p className="admin-user-edit-name">
                      {u.name} <span className="admin-user-edit-email">{u.email}</span>
                    </p>
                    <div className="admin-user-edit-fields">
                      <input
                        value={editForm.title}
                        placeholder="Title"
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      />
                      <select
                        value={editForm.role_id}
                        onChange={(e) => setEditForm({ ...editForm, role_id: e.target.value })}
                      >
                        {roles.map((r) => (
                          <option key={r.key} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <label className="admin-user-active-toggle">
                        <input
                          type="checkbox"
                          checked={editForm.is_active}
                          disabled={u.id === currentUser.id}
                          onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                        />
                        Active
                      </label>
                    </div>
                    <BrandPicker brands={brands} value={editForm.brand_ids} onChange={(brand_ids) => setEditForm({ ...editForm, brand_ids })} />
                    {editError && <p className="error-text">{editError}</p>}
                    <div className="admin-user-edit-actions">
                      <button type="button" onClick={() => setEditingId(null)} disabled={savingEdit}>
                        Cancel
                      </button>
                      <button type="button" onClick={() => handleSaveEdit(u.id)} disabled={savingEdit}>
                        {savingEdit ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="admin-user-info">
                      <p className="admin-user-name">{u.name}</p>
                      <p className="admin-user-meta">
                        {u.email} · {u.title || u.role_label}
                      </p>
                      <div className="admin-user-tags">
                        <span className="tag tag-gold">{u.role_label ?? 'NO ROLE'}</span>
                        {u.brands.map((b) => (
                          <span key={b.id} className="tag tag-orange">{b.label}</span>
                        ))}
                        {!u.is_active && (
                          <span className="tag tag-red">INACTIVE</span>
                        )}
                      </div>
                    </div>
                    <div className="admin-user-actions">
                      <button type="button" onClick={() => startEdit(u)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={u.id === currentUser.id}
                        onClick={() => handleToggleActive(u)}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
