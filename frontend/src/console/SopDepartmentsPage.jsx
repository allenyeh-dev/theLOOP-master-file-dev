import { useState } from 'react'
import { consoleApi } from '../api/console'
import { useLang } from '../i18n/LanguageContext'
import { ConfirmDialog, Field, Modal, PageHead, useLoader, useSubmit } from './ui'

function DepartmentModal({ dept, onClose, onSaved }) {
  const { t } = useLang()
  const editing = Boolean(dept)
  const [form, setForm] = useState({ key: dept?.key ?? '', label: dept?.label ?? '', is_general: Boolean(dept?.is_general) })
  const { busy, error, submit } = useSubmit(
    () => (editing ? consoleApi.updateSopDepartment(dept.id, { label: form.label, is_general: form.is_general }) : consoleApi.createSopDepartment(form)),
    onSaved
  )

  return (
    <Modal
      title={editing ? t('Edit department: {name}', { name: dept.label }) : t('New Department')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="cs-btn" onClick={onClose} disabled={busy}>{t('Cancel')}</button>
          <button type="submit" form="dept-form" className="cs-btn cs-btn--primary" disabled={busy}>{busy ? t('Saving…') : t('Save')}</button>
        </>
      }
    >
      <form id="dept-form" className="cs-form" onSubmit={submit}>
        <Field label={t('Key')} hint={t('Used in SOP codes (e.g. BOH in SF-BOH-002). Cannot be changed later.')}>
          <input value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} disabled={editing} required />
        </Field>
        <Field label={t('Label')}><input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} required /></Field>
        <label className="cs-perm">
          <input type="checkbox" checked={form.is_general} onChange={(e) => setForm({ ...form, is_general: e.target.checked })} />
          {t('General — SOPs in this department are visible to everyone')}
        </label>
        {error && <p className="cs-error">{error}</p>}
      </form>
    </Modal>
  )
}

export function SopDepartmentsPage() {
  const { t } = useLang()
  const depts = useLoader(consoleApi.listSopDepartments, (r) => r.departments)
  const [modal, setModal] = useState(null)

  return (
    <>
      <PageHead
        title={t('SOP · Departments')}
        subtitle={t('Filter chips on the SOP page and the middle part of each SOP number.')}
        action={<button className="cs-btn cs-btn--primary" onClick={() => setModal({ kind: 'edit' })} disabled={!depts.data}>{t('+ New Department')}</button>}
      />
      {depts.error && <p className="cs-error">{depts.error}</p>}
      {!depts.data && !depts.error && <p className="cs-muted">{t('Loading…')}</p>}
      {depts.data && (
        <table className="cs-table">
          <thead><tr><th>{t('Label')}</th><th>{t('Key')}</th><th>{t('General')}</th><th>SOPs</th><th className="cs-col-actions">{t('Actions')}</th></tr></thead>
          <tbody>
            {depts.data.map((d) => (
              <tr key={d.id}>
                <td className="cs-strong">{d.label}</td>
                <td><code>{d.key}</code></td>
                <td>{d.is_general ? t('Yes') : '—'}</td>
                <td>{d.sop_count}</td>
                <td className="cs-col-actions">
                  <button className="cs-link" onClick={() => setModal({ kind: 'edit', dept: d })}>{t('Edit')}</button>
                  <button className="cs-link cs-link--danger" onClick={() => setModal({ kind: 'delete', dept: d })}>{t('Delete')}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {modal?.kind === 'edit' && <DepartmentModal dept={modal.dept} onClose={() => setModal(null)} onSaved={() => { setModal(null); depts.reload() }} />}
      {modal?.kind === 'delete' && (
        <ConfirmDialog
          title={t('Delete department')}
          message={t('Delete "{name}"? The server refuses if any SOP uses it.', { name: modal.dept.label })}
          onClose={() => setModal(null)}
          onConfirm={async () => { await consoleApi.deleteSopDepartment(modal.dept.id); depts.reload() }}
        />
      )}
    </>
  )
}
