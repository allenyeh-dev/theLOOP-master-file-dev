import { useEffect, useState } from 'react'
import { AlertTriangleIcon, PersonIcon } from './icons'
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
  showRecipes,
  brandName,
  brandLogo,
  onEmergency,
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

        <div className="topnav-actions">
          {onEmergency && (
            <button type="button" className="avatar-button alert-button" onClick={onEmergency} aria-label={t('Emergency Alert')}>
              <AlertTriangleIcon />
            </button>
          )}
          <button type="button" className="avatar-button" onClick={onToggleMenu} aria-label={t('Account menu')}>
            <PersonIcon />
            {badgeLabel && <span className="avatar-badge">{badgeLabel}</span>}
          </button>
        </div>
      </div>

      {brandName && (
        <nav className="topnav-tabs" aria-label="Sections">
          {[
            ['brand', 'OPS', true],
            ['logs', 'LOGS', true],
            ['schedule', 'SCHEDULE', true],
            ['tasks', 'TASKS', true],
            ['recipes', 'RECIPES', showRecipes],
            ['sop', 'S.O.P.', showSop],
          ].filter(([, , shown]) => shown).map(([id, label]) => (
            <button type="button" key={id} className={`topnav-tab ${view === id ? 'is-active' : ''}`} onClick={() => onNavigate(id)}>{label}</button>
          ))}
        </nav>
      )}
    </header>
  )
}
