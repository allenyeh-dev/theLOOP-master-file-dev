import { useState } from 'react'
import { consoleApi } from '../api/console'
import { ConfirmDialog, Field, Modal, PageHead, TAG_VARIANTS, TagsField, useLoader, useSubmit } from './ui'

const today = () => new Date().toISOString().slice(0, 10)
const EMPTY = { brand_id: '', title: '', body: '', title_zh: '', body_zh: '', accent: 'gold', posted_by: '', posted_at: today(), tags: [] }

function NoticeModal({ notice, brands, onClose, onSaved }) {
  const [form, setForm] = useState(
    notice
      ? { ...EMPTY, ...notice, title_zh: notice.title_zh ?? '', body_zh: notice.body_zh ?? '', tags: notice.tags.map((t) => ({ ...t, label_zh: t.label_zh ?? '' })) }
      : { ...EMPTY, brand_id: brands[0]?.id ?? '' }
  )
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const { busy, error, submit } = useSubmit(
    () => {
      const p = { ...form, brand_id: Number(form.brand_id) }
      return notice ? consoleApi.updateBrandNotice(notice.id, p) : consoleApi.createBrandNotice(p)
    },
    onSaved
  )

  return (
    <Modal
      title={notice ? 'Edit Brand Notice' : 'New Brand Notice'}
      onClose={onClose}
      wide
      footer={
        <>
          <button type="button" className="cs-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" form="notice-form" className="cs-btn cs-btn--primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      <form id="notice-form" className="cs-form" onSubmit={submit}>
        <Field label="Brand" hint="Shown when staff open this brand. Always re-readable.">
          <select value={form.brand_id} onChange={set('brand_id')} required>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </Field>
        <Field label="Title"><input value={form.title} onChange={set('title')} maxLength={120} required /></Field>
        <Field label="Body"><textarea rows={4} value={form.body} onChange={set('body')} maxLength={600} required /></Field>
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

export function BrandNoticesPage() {
  const list = useLoader(consoleApi.listBrandNotices, (r) => r.notices)
  const brands = useLoader(consoleApi.listBrands, (r) => r.brands)
  const [modal, setModal] = useState(null)
  const ready = list.data && brands.data
  const saved = () => { setModal(null); list.reload() }

  return (
    <>
      <PageHead
        title="Brand Notices"
        subtitle="Notices for a single brand, shown at the top of that brand's page when staff enter it. No acknowledgement and no push; they can be re-read any time."
        action={<button className="cs-btn cs-btn--primary" onClick={() => setModal({ kind: 'edit' })} disabled={!ready}>+ New Notice</button>}
      />
      {(list.error || brands.error) && <p className="cs-error">{list.error || brands.error}</p>}
      {!ready && !list.error && <p className="cs-muted">Loading…</p>}

      {ready && (
        <table className="cs-table">
          <thead><tr><th>Title</th><th>Brand</th><th>Tags</th><th>Posted</th><th className="cs-col-actions">Actions</th></tr></thead>
          <tbody>
            {list.data.map((n) => (
              <tr key={n.id}>
                <td className="cs-strong">{n.title}</td>
                <td>{n.brand}</td>
                <td>{n.tags.map((t) => t.label).join(', ') || '—'}</td>
                <td>{n.posted_by} · {n.posted_at}</td>
                <td className="cs-col-actions">
                  <button className="cs-link" onClick={() => setModal({ kind: 'edit', notice: n })}>Edit</button>
                  <button className="cs-link cs-link--danger" onClick={() => setModal({ kind: 'delete', notice: n })}>Delete</button>
                </td>
              </tr>
            ))}
            {list.data.length === 0 && <tr><td colSpan={5} className="cs-muted">No brand notices yet.</td></tr>}
          </tbody>
        </table>
      )}

      {modal?.kind === 'edit' && <NoticeModal notice={modal.notice} brands={brands.data} onClose={() => setModal(null)} onSaved={saved} />}
      {modal?.kind === 'delete' && (
        <ConfirmDialog
          title="Delete brand notice"
          message={`Delete "${modal.notice.title}"?`}
          onClose={() => setModal(null)}
          onConfirm={async () => { await consoleApi.deleteBrandNotice(modal.notice.id); list.reload() }}
        />
      )}
    </>
  )
}
