import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { fetchRoles } from '../api/data'
import { useLang } from '../i18n/LanguageContext'
import { TopNav } from './TopNav'
import { ProfileMenu } from './ProfileMenu'
import { Announcements } from './Announcements'
import { WhatsHappening } from './WhatsHappening'
import { BrandPicker } from './BrandPicker'
import { BrandPage } from './BrandPage'
import { AdminHub } from './AdminHub'
import { ExecutiveOverview } from './ExecutiveOverview'
import { AdminPanel } from './AdminPanel'
import { SopApp } from '../sop/SopApp'
import { OverviewFooter } from './OverviewFooter'
import { SopShortcut } from './SopShortcut'
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
  const { t } = useLang()
  const [roles, setRoles] = useState([])
  const [viewAsRoleKey, setViewAsRoleKey] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [adminPanelOpen, setAdminPanelOpen] = useState(false)
  const [nav, setNav] = useState({ stack: ['home'], pos: 0 })
  const [sopQuery, setSopQuery] = useState('')
  const [brand, setBrand] = useState(null)
  const view = nav.stack[nav.pos]
  // The OPS / S.O.P. tabs belong to a brand: shown on its page and on SOP screens reached from it, never on home.
  const inBrand = (() => {
    for (let i = nav.pos; i >= 0; i--) {
      if (nav.stack[i] === 'brand') return true
      if (nav.stack[i] === 'home') return false
    }
    return false
  })()

  const canManageUsers = hasPermission('users.manage')
  // Only Admin and Executive accounts get the role-preview header.
  const canSwitchView = ['admin', 'executive'].includes(user?.role.key)

  useEffect(() => {
    if (!canSwitchView && !canManageUsers) return
    fetchRoles()
      .then((data) => setRoles(data.roles))
      .catch(() => setRoles([]))
  }, [canSwitchView, canManageUsers])

  function navigate(next) {
    setNav((n) => (n.stack[n.pos] === next ? n : { stack: [...n.stack.slice(0, n.pos + 1), next], pos: n.pos + 1 }))
  }
  const go = (delta) => setNav((n) => ({ ...n, pos: Math.min(n.stack.length - 1, Math.max(0, n.pos + delta)) }))

  if (!user) return null

  const previewedRole =
    viewAsRoleKey && viewAsRoleKey !== user.role.key
      ? roles.find((r) => r.key === viewAsRoleKey) || null
      : null
  const effectivePermissions = previewedRole ? previewedRole.permissions : user.permissions
  const badgeSource = previewedRole ? previewedRole.label : user.role.label
  const effectiveRoleKey = previewedRole ? previewedRole.key : user.role.key

  return (
    <div className="dashboard">
      <TopNav
        canSwitchView={canSwitchView}
        roles={roles}
        activeRoleKey={viewAsRoleKey ?? user.role.key}
        onSelectRole={setViewAsRoleKey}
        onResetView={() => setViewAsRoleKey(null)}
        badgeLabel={badgeSource ? badgeSource[0].toUpperCase() : null}
        onToggleMenu={() => setMenuOpen((open) => !open)}
        view={view}
        brandName={inBrand && brand ? [brand.label, brand.sub_label].filter(Boolean).join(' ') : null}
        brandLogo={inBrand && brand ? brand.logo_url : null}
        showSop={inBrand && (hasPermission('sop.submit') || hasPermission('sop.approve'))}
        onNavigate={navigate}
      />

      {menuOpen && (
        <ProfileMenu
          user={user}
          onClose={() => setMenuOpen(false)}
          onSignOut={logout}
          canManageUsers={canManageUsers}
          onOpenAdminPanel={() => setAdminPanelOpen(true)}
        />
      )}

      {adminPanelOpen && <AdminPanel roles={roles} onClose={() => setAdminPanelOpen(false)} />}

      <main className="content">
        {view === 'sop' ? (
          <SopApp
            query={sopQuery}
            onClearQuery={() => setSopQuery('')}
          />
        ) : view === 'brand' && brand ? (
          <BrandPage key={brand.id} brand={brand} />
        ) : (
          <>
        {previewedRole && (
          <p className="preview-banner">
            {t('Previewing as')} <strong>{previewedRole.label}</strong>
          </p>
        )}

        {effectiveRoleKey === 'admin' ? (
          <AdminHub user={user} />
        ) : effectiveRoleKey === 'executive' ? (
          <ExecutiveOverview user={user} />
        ) : (
          <>
            <section className="welcome-panel">
              <p className="welcome-label">{t('WELCOME BACK')}</p>
              <h1 className="welcome-name">{user.name}</h1>
              <p className="welcome-title">{user.title || user.role.label}</p>
            </section>

            <Announcements />

            {(hasPermission('sop.submit') || hasPermission('sop.approve')) && <SopShortcut user={user} onOpen={() => navigate('sop')} />}

            <WhatsHappening />

            <section className="access-section" hidden>
              <p className="section-label">{previewedRole ? t('{role} ACCESS', { role: previewedRole.label }) : t('YOUR ACCESS')}</p>
              <div className="permission-grid">
                {Object.entries(PERMISSION_LABELS)
                  .filter(([key]) => effectivePermissions.includes(key))
                  .map(([key, label]) => (
                    <div className="card" key={key}>
                      {t(label)}
                    </div>
                  ))}
              </div>
            </section>
          </>
        )}

        <BrandPicker onOpen={(b) => { setBrand(b); navigate('brand') }} />
          </>
        )}
      </main>

      <div className="dashboard-footer">
        <OverviewFooter
          placeholder="Search SOPs, recipes, menus…"
          canBack={nav.pos > 0}
          canForward={nav.pos < nav.stack.length - 1}
          onBack={() => go(-1)}
          onForward={() => go(1)}
          onHome={() => {
            navigate('home')
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
          onSearch={(q) => {
            setSopQuery(q)
            navigate('sop')
          }}
        />
      </div>
    </div>
  )
}
