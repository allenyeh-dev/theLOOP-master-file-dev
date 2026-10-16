import { useEffect, useRef, useState } from 'react'
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
  showSopEdit,
  brandName,
  brandLogo,
}) {
  const { t } = useLang()
  const [sopOpen, setSopOpen] = useState(false)
  const sopRef = useRef(null)
  const [logoFailed, setLogoFailed] = useState(false)
  useEffect(() => { setLogoFailed(false) }, [brandLogo])
  const sopActive = view === 'sop' || view === 'sop-edit'

  useEffect(() => {
    if (!sopOpen) return undefined
    const close = (e) => { if (!sopRef.current?.contains(e.target)) setSopOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setSopOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc) }
  }, [sopOpen])

  const pick = (v) => { setSopOpen(false); onNavigate(v) }

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
            <button type="button" className="logo-brand-btn" aria-label={brandName} onClick={() => { setSopOpen(false); onNavigate('brand') }}>
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
          <button type="button" className={`topnav-tab ${view === 'brand' ? 'is-active' : ''}`} onClick={() => { setSopOpen(false); onNavigate('brand') }}>OPS</button>
          <div className="topnav-tab-wrap" ref={sopRef}>
            <button
              type="button"
              className={`topnav-tab ${sopActive ? 'is-active' : ''}`}
              aria-haspopup="menu"
              aria-expanded={sopOpen}
              onClick={() => setSopOpen((o) => !o)}
            >
              S.O.P. <span className="topnav-caret" aria-hidden="true">▾</span>
            </button>
            {sopOpen && (
              <div className="topnav-menu" role="menu">
                <button type="button" role="menuitem" className={view === 'sop' ? 'is-active' : ''} onClick={() => pick('sop')}>{t('查看 SOP')}</button>
                {showSopEdit && (
                  <button type="button" role="menuitem" className={view === 'sop-edit' ? 'is-active' : ''} onClick={() => pick('sop-edit')}>{t('新增 / 編輯 SOP')}</button>
                )}
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  )
}
