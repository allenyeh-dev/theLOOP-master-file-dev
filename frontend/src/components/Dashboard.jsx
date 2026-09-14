import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchRoles } from '../api/data'
import { TopNav } from './TopNav'
import { ProfileMenu } from './ProfileMenu'
import { Announcements } from './Announcements'
import { AdminPanel } from './AdminPanel'
import './Dashboard.css'

const PERMISSION_LABELS = {
  'dashboard.view': 'Dashboard Overview',
  'schedule.manage': 'Staff Scheduling',
  'inventory.manage': 'Inventory Management',
  'kitchen.manage': 'Kitchen Operations',
  'reports.view': 'Executive Reports',
  'users.manage': 'User & Role Management',
}

export function Dashboard() {
  const { user, logout, hasPermission } = useAuth()
  const [roles, setRoles] = useState([])
  const [viewAsRoleKey, setViewAsRoleKey] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [adminPanelOpen, setAdminPanelOpen] = useState(false)

  const canSwitchView = hasPermission('users.manage')

  useEffect(() => {
    if (!canSwitchView) return
    fetchRoles()
      .then((data) => setRoles(data.roles))
      .catch(() => setRoles([]))
  }, [canSwitchView])

  if (!user) return null

  const previewedRole = roles.find((r) => r.key === viewAsRoleKey) || null
  const effectivePermissions = previewedRole ? previewedRole.permissions : user.permissions
  const badgeSource = previewedRole ? previewedRole.label : user.role.label

  return (
    <div className="dashboard">
      <TopNav
        canSwitchView={canSwitchView}
        roles={roles}
        activeRoleKey={viewAsRoleKey}
        onSelectRole={setViewAsRoleKey}
        onResetView={() => setViewAsRoleKey(null)}
        badgeLabel={badgeSource ? badgeSource[0].toUpperCase() : null}
        onToggleMenu={() => setMenuOpen((open) => !open)}
      />

      {menuOpen && (
        <ProfileMenu
          user={user}
          onClose={() => setMenuOpen(false)}
          onSignOut={logout}
          canManageUsers={canSwitchView}
          onOpenAdminPanel={() => setAdminPanelOpen(true)}
        />
      )}

      {adminPanelOpen && <AdminPanel roles={roles} onClose={() => setAdminPanelOpen(false)} />}

      <main className="content">
        <section className="welcome-panel">
          <p className="welcome-label">WELCOME BACK</p>
          <h1 className="welcome-name">{user.name}</h1>
          <p className="welcome-title">{user.title || user.role.label}</p>
        </section>

        {previewedRole && (
          <p className="preview-banner">
            Previewing as <strong>{previewedRole.label}</strong>
          </p>
        )}

        <Announcements />

        <section className="access-section">
          <p className="section-label">{previewedRole ? `${previewedRole.label} ACCESS` : 'YOUR ACCESS'}</p>
          <div className="permission-grid">
            {Object.entries(PERMISSION_LABELS)
              .filter(([key]) => effectivePermissions.includes(key))
              .map(([key, label]) => (
                <div className="card" key={key}>
                  {label}
                </div>
              ))}
          </div>
        </section>
      </main>
    </div>
  )
}
