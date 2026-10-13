import { useEffect, useState } from 'react'
import { sopApi } from '../api/sops'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../i18n/LanguageContext'
import { ClipboardIcon } from './icons'
import './SopShortcut.css'

// Home entry to the SOPs this user should read: their department's published SOPs.
export function SopShortcut({ user, onOpen }) {
  const { t } = useLang()
  const { hasPermission } = useAuth()
  const [unread, setUnread] = useState(null)
  const depts = user.departments ?? []
  const deptKey = depts.map((d) => d.id).join(',')

  useEffect(() => {
    sopApi
      .list('published')
      .then((r) => {
        // The server already limits restricted users; roles that see everything narrow to their own departments.
        const narrow = hasPermission('sop.view_all') && depts.length > 0
        setUnread(r.sops.filter((s) => (!narrow || depts.some((d) => d.id === s.department_id)) && !s.is_read).length)
      })
      .catch(() => setUnread(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deptKey])

  return (
    <section className="sop-shortcut">
      <p className="section-label">{t('YOUR SOPS')}</p>
      <button type="button" className="sop-shortcut-btn" onClick={onOpen}>
        <span className="sop-shortcut-icon"><ClipboardIcon /></span>
        <span className="sop-shortcut-text">
          <strong>{depts.length ? t('{dept} SOPs', { dept: depts.map((d) => d.label).join(' · ') }) : t('SOPs')}</strong>
          {unread !== null && <small>{unread > 0 ? t('{n} unread', { n: unread }) : t('All caught up')}</small>}
        </span>
        <span className="sop-shortcut-go">›</span>
      </button>
    </section>
  )
}
