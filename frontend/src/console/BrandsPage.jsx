import { useState } from 'react'
import { consoleApi } from '../api/console'
import { ConfirmDialog, Field, Modal, PageHead, useLoader, useSubmit } from './ui'

function BrandModal({ brand, onClose, onSaved }) {
  const editing = Boolean(brand)
  const [form, setForm] = useState({ key: brand?.key ?? '', label: brand?.label ?? '' })

  const { busy, error, submit } = useSubmit(
    () => (editing ? consoleApi.updateBrand(brand.id, form) : consoleApi.createBrand(form)),
    onSaved
  )

  return (
    <Modal
      title={editing ? `Edit brand: ${brand.label}` : 'New Brand'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="cs-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="brand-form" className="cs-btn cs-btn--primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save Changes' : 'Create Brand'}
          </button>
        </>
      }
    >
      <form id="brand-form" className="cs-form" onSubmit={submit}>
        <Field label="Label"><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required /></Field>
        <Field label="Key" hint="Lowercase, digits, underscore. Used to match brand data.">
          <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} required />
        </Field>
        {error && <p className="cs-error">{error}</p>}
      </form>
    </Modal>
  )
}

export function BrandsPage() {
  const brands = useLoader(consoleApi.listBrands, (r) => r.brands)
  const [modal, setModal] = useState(null)

  return (
    <>
      <PageHead
        title="Brands"
        subtitle="Users only see data that belongs to their brands."
        action={<button className="cs-btn cs-btn--primary" onClick={() => setModal({ kind: 'edit' })} disabled={!brands.data}>+ New Brand</button>}
      />
      {brands.error && <p className="cs-error">{brands.error}</p>}
      {!brands.data && !brands.error && <p className="cs-muted">Loading…</p>}

      {brands.data && (
        <table className="cs-table">
          <thead>
            <tr><th>Brand</th><th>Key</th><th>Users</th><th className="cs-col-actions">Actions</th></tr>
          </thead>
          <tbody>
            {brands.data.map((b) => (
              <tr key={b.id}>
                <td className="cs-strong">{b.label}</td>
                <td><code>{b.key}</code></td>
                <td>{b.user_count}</td>
                <td className="cs-col-actions">
                  <button className="cs-link" onClick={() => setModal({ kind: 'edit', brand: b })}>Edit</button>
                  <button className="cs-link cs-link--danger" onClick={() => setModal({ kind: 'delete', brand: b })}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {modal?.kind === 'edit' && (
        <BrandModal brand={modal.brand} onClose={() => setModal(null)} onSaved={() => { setModal(null); brands.reload() }} />
      )}
      {modal?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete brand"
          message={`Delete "${modal.brand.label}"? It is removed from ${modal.brand.user_count} user(s). The server refuses if that would leave a user with no brand.`}
          onClose={() => setModal(null)}
          onConfirm={async () => { await consoleApi.deleteBrand(modal.brand.id); brands.reload() }}
        />
      )}
    </>
  )
}
