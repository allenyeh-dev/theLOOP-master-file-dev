import { useState } from 'react'
import { ChartIcon, GearIcon, SignOutIcon } from './icons'
import './ProfileMenu.css'

export function ProfileMenu({ user, onSignOut, onClose, canManageUsers, onOpenAdminPanel }) {
  const [language, setLanguage] = useState('en')

  return (
    <>
      <div className="profile-menu-backdrop" onClick={onClose} />
      <div className="profile-menu">
        <div className="profile-menu-header">
          <p className="profile-name">{user.name}</p>
          <p className="profile-role">{user.role.label.toUpperCase()}</p>
        </div>

        <div className="profile-menu-row profile-menu-row--language">
          <span>Language / 語言</span>
          <div className="language-toggle">
            <button
              type="button"
              className={language === 'en' ? 'is-active' : ''}
              onClick={() => setLanguage('en')}
            >
              EN
            </button>
            <button
              type="button"
              className={language === 'zh' ? 'is-active' : ''}
              onClick={() => setLanguage('zh')}
            >
              中文
            </button>
          </div>
        </div>

        <button type="button" className="profile-menu-row profile-menu-row--link" disabled>
          <ChartIcon />
          Access Logs
        </button>

        <button
          type="button"
          className="profile-menu-row profile-menu-row--link"
          disabled={!canManageUsers}
          onClick={() => {
            onClose()
            onOpenAdminPanel()
          }}
        >
          <GearIcon />
          Admin Panel
        </button>

        {['admin', 'ownership'].includes(user.role.key) && (
          <a href="/admin" className="profile-menu-row profile-menu-row--link">
            <GearIcon />
            Admin Console
          </a>
        )}

        <button
          type="button"
          className="profile-menu-row profile-menu-row--signout"
          onClick={() => {
            onClose()
            onSignOut()
          }}
        >
          <SignOutIcon />
          Sign Out
        </button>
      </div>
    </>
  )
}
