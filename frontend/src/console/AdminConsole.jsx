import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { UsersPage } from './UsersPage'
import { RolesPage } from './RolesPage'
import { PermissionsPage } from './PermissionsPage'
import './console.css'

const CONSOLE_ROLES = ['admin', 'ownership']
const TABS = [
  { id: 'users', label: 'Users', Page: UsersPage },
  { id: 'roles', label: 'Roles', Page: RolesPage },
  { id: 'permissions', label: 'Permissions', Page: PermissionsPage },
]

const tabFromHash = () => TABS.find((t) => `#${t.id}` === window.location.hash)?.id ?? 'users'

export function isConsolePath() {
  return window.location.pathname.replace(/\/$/, '') === '/admin'
}

export function AdminConsole() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState(tabFromHash)

  useEffect(() => {
    const onHash = () => setTab(tabFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // UI gate only — every /api/console route re-checks the role server-side.
  if (!CONSOLE_ROLES.includes(user.role.key)) {
    return (
      <div className="cs-denied">
        <h1>403 — Admin only</h1>
        <p>Your account does not have access to the admin console.</p>
        <a href="/">Back to app</a>
      </div>
    )
  }

  const { Page } = TABS.find((t) => t.id === tab)

  return (
    <div className="cs-shell">
      <aside className="cs-side">
        <div className="cs-brand">THE LOOP<small>Admin Console</small></div>
        <nav>
          {TABS.map((t) => (
            <a key={t.id} href={`#${t.id}`} className={t.id === tab ? 'is-active' : ''}>{t.label}</a>
          ))}
        </nav>
        <div className="cs-side-foot">
          <a href="/">← Back to app</a>
        </div>
      </aside>

      <div className="cs-main">
        <header className="cs-top">
          <span className="cs-muted">{user.name} · {user.role.label}</span>
          <button className="cs-btn" onClick={() => logout().then(() => window.location.assign('/'))}>Sign out</button>
        </header>
        <main className="cs-content"><Page /></main>
      </div>
    </div>
  )
}
