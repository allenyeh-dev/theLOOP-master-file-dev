import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { UsersPage } from './UsersPage'
import { BrandsPage } from './BrandsPage'
import { RolesPage } from './RolesPage'
import { PermissionsPage } from './PermissionsPage'
import { EventsPage } from './EventsPage'
import { AnnouncementsPage } from './AnnouncementsPage'
import { BrandNoticesPage } from './BrandNoticesPage'
import { SopDepartmentsPage } from './SopDepartmentsPage'
import { SopReadsPage } from './SopReadsPage'
import { SopUploadPage } from './SopUploadPage'
import './console.css'

const CONSOLE_ROLES = ['admin']
const TABS = [
  { id: 'users', label: 'Users', Page: UsersPage },
  { id: 'brands', label: 'Brands', Page: BrandsPage },
  { id: 'announcements', label: 'Announcements', Page: AnnouncementsPage },
  { id: 'brand-notices', label: 'Brand Notices', Page: BrandNoticesPage },
  { id: 'events', label: 'Events', Page: EventsPage },
  { id: 'sop-reads', label: 'Readership', group: 'SOP', Page: SopReadsPage },
  { id: 'sop-upload', label: 'Upload', group: 'SOP', Page: SopUploadPage },
  { id: 'sop-departments', label: 'Departments', group: 'SOP', Page: SopDepartmentsPage },
  { id: 'roles', label: 'Roles', Page: RolesPage },
  { id: 'permissions', label: 'Permissions', Page: PermissionsPage },
]

// Sidebar entries: tabs sharing a `group` collapse into one dropdown entry placed where the first one sits.
const NAV = TABS.reduce((nav, t) => {
  if (!t.group) return [...nav, { tab: t }]
  const existing = nav.find((n) => n.group === t.group)
  if (existing) existing.tabs.push(t)
  else nav.push({ group: t.group, tabs: [t] })
  return nav
}, [])

const tabFromHash = () => TABS.find((t) => `#${t.id}` === window.location.hash)?.id ?? 'users'

export function isConsolePath() {
  return window.location.pathname.replace(/\/$/, '') === '/admin'
}

export function AdminConsole() {
  const { user, logout } = useAuth()
  const [tab, setTab] = useState(tabFromHash)
  const [openGroup, setOpenGroup] = useState(null)

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
          {NAV.map((n) => {
            if (n.tab) return <a key={n.tab.id} href={`#${n.tab.id}`} className={n.tab.id === tab ? 'is-active' : ''}>{n.tab.label}</a>
            const active = n.tabs.some((t) => t.id === tab)
            const open = openGroup === n.group
            return (
              <div key={n.group} className="cs-nav-group">
                <button type="button" className={`cs-nav-group-btn ${active ? 'is-active' : ''}`} aria-expanded={open} onClick={() => setOpenGroup(open ? null : n.group)}>
                  {n.group}<span aria-hidden>{open ? '⌄' : '›'}</span>
                </button>
                {open && (
                  <div className="cs-nav-menu" role="menu">
                    {n.tabs.map((t) => (
                      <a key={t.id} role="menuitem" href={`#${t.id}`} className={t.id === tab ? 'is-active' : ''} onClick={() => setOpenGroup(null)}>{t.label}</a>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
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
