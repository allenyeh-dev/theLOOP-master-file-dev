import { useState } from 'react'
import { consoleApi } from '../api/console'
import { useLang } from '../i18n/LanguageContext'
import { PageHead, useLoader } from './ui'

// Who each person's SOP submissions go to. No manager = sent to an admin.
export function UserManagersPage({ onBack }) {
  const { t } = useLang()
  const users = useLoader(consoleApi.listUserManagers, (r) => r.users)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(null)

  async function change(u, value) {
    setSaving(u.id); setError(null)
    try {
      await consoleApi.setUserManager(u.id, value === '' ? null : Number(value))
      users.reload()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  return (
    <>
      <PageHead title={t('SOP · Managers')} subtitle={t('The manager each person’s SOP submissions are sent to for approval. Leave blank to send to an admin.')} action={onBack && <button type="button" className="cs-btn" onClick={onBack}>{t('← Back')}</button>} />
      {(users.error || error) && <p className="cs-error">{users.error || error}</p>}
      {!users.data && !users.error && <p className="cs-muted">{t('Loading…')}</p>}
      {users.data && (
        <table className="cs-table">
          <thead><tr><th>{t('Name')}</th><th>{t('Role')}</th><th>{t('Manager')}</th></tr></thead>
          <tbody>
            {users.data.filter((u) => u.is_active).map((u) => (
              <tr key={u.id}>
                <td className="cs-strong">{u.name}<div className="cs-muted">{u.email}</div></td>
                <td>{u.role_label ?? '—'}</td>
                <td>
                  <select value={u.manager_id ?? ''} disabled={saving === u.id} onChange={(e) => change(u, e.target.value)}>
                    <option value="">{t('— (admin)')}</option>
                    {users.data.filter((m) => m.is_active && m.id !== u.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
