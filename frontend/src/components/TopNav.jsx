import { PersonIcon } from './icons'
import './TopNav.css'

export function TopNav({
  canSwitchView,
  roles,
  activeRoleKey,
  onSelectRole,
  onResetView,
  badgeLabel,
  onToggleMenu,
}) {
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
        <div className="logo">THE LOOP</div>

        <button type="button" className="avatar-button" onClick={onToggleMenu} aria-label="Account menu">
          <PersonIcon />
          {badgeLabel && <span className="avatar-badge">{badgeLabel}</span>}
        </button>
      </div>
    </header>
  )
}
