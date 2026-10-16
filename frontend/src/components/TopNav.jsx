import { useEffect, useState } from 'react'
import { PersonIcon } from './icons'
import { useLang } from '../i18n/LanguageContext'
import './TopNav.css'

export function TopNav({
  canSwitchView,
  roles,
  activeRoleKey,
  onSelectRole,
  onResetView,
  badgeLabel,
  onToggleMenu,
  view,
  onNavigate,
  showSop,
  brandName,
  brandLogo,
}) {
  const { t } = useLang()
  const [logoFailed, setLogoFailed] = useState(false)
  useEffect(() => { setLogoFailed(false) }, [brandLogo])


  return (
    <header className="topnav">
      {canSwitchView && (
        <nav className="role-tabs">
			{/* <span>
				DEMO
			</span> */}
			<button
			// type='button'
			className='role-tab--demo' disabled>
				DEMO
			</button>
          {/* <button
            type="button"
            className={`role-tab role-tab--demo ${!activeRoleKey ? 'is-active' : ''}`}
            onClick={onResetView}
          >
            DEMO
          </button> */}
          {roles.map((role) => (
            <button
              type="button"
              key={role.key}
              className={`role-tab ${activeRoleKey === role.key ? 'is-active' : ''}`}
              onClick={() => onSelectRole(role.key)}
            >
              {role.label}
            </button>
          ))}
        </nav>
      )}

      <div className="topnav-main">
        {brandName ? (
          brandLogo && !logoFailed ? (
            <button type="button" className="logo-brand-btn" aria-label={brandName} onClick={() => { onNavigate('brand') }}>
              <img className="logo-brand-img" src={brandLogo} alt="" onError={() => setLogoFailed(true)} />
            </button>
          ) : <span />
        ) : (
          <div className="logo">THE LOOP</div>
        )}

        <button type="button" className="avatar-button" onClick={onToggleMenu} aria-label={t('Account menu')}>
          <PersonIcon />
          {badgeLabel && <span className="avatar-badge">{badgeLabel}</span>}
        </button>
      </div>

      {showSop && (
        <nav className="topnav-tabs" aria-label="Sections">
          <button type="button" className={`topnav-tab ${view === 'brand' ? 'is-active' : ''}`} onClick={() => { onNavigate('brand') }}>OPS</button>
          <button type="button" className={`topnav-tab ${view === 'sop' ? 'is-active' : ''}`} onClick={() => onNavigate('sop')}>S.O.P.</button>
        </nav>
      )}
    </header>
  )
}
