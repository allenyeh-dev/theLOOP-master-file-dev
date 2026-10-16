import { useState } from 'react'
import { consoleApi } from '../api/console'
import { ConfirmDialog, Field, Modal, PageHead, useLoader, useSubmit } from './ui'

function BrandModal({ brand, onClose, onSaved }) {
  const editing = Boolean(brand)
  const [form, setForm] = useState({ key: brand?.key ?? '', label: brand?.label ?? '', code: brand?.code ?? '', logo_url: brand?.logo_url ?? '', bg_color: brand?.bg_color ?? '', sub_label: brand?.sub_label ?? '' })

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
        <Field label="SOP code" hint="2-5 letters/digits, used in SOP numbers (e.g. SF-BOH-002). Blank = first 3 letters of the key.">
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={5} />
        </Field>
        <Field label="Logo" hint="Path of an image in frontend/public/brands/ (e.g. /brands/kor.png) or an https:// URL. Shown on the home-page brand card.">
          <input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="/brands/kor.png" />
        </Field>
        <div className="cs-form-row">
          <Field label="Card colour" hint="#rrggbb"><input value={form.bg_color} onChange={(e) => setForm({ ...form, bg_color: e.target.value })} placeholder="#000000" maxLength={7} /></Field>
          <Field label="Sub-label" hint="e.g. Xinyi"><input value={form.sub_label} onChange={(e) => setForm({ ...form, sub_label: e.target.value })} maxLength={30} /></Field>
        </div>
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
            <tr><th>Brand</th><th>Key</th><th>SOP code</th><th>Users</th><th className="cs-col-actions">Actions</th></tr>
          </thead>
          <tbody>
            {brands.data.map((b) => (
              <tr key={b.id}>
                <td className="cs-strong">{b.label}</td>
                <td><code>{b.key}</code></td>
                <td>{b.code ?? '—'}</td>
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
