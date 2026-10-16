import { useEffect, useState } from 'react'
import { useLang } from '../i18n/LanguageContext'
import { ChartIcon, GearIcon, SignOutIcon } from './icons'
import { disablePush, enablePush, getPushState } from '../utils/push'
import './ProfileMenu.css'

export function ProfileMenu({ user, onSignOut, onClose, canManageUsers, onOpenAdminPanel }) {
  const { lang: language, setLang: setLanguage, t } = useLang()
  const [push, setPush] = useState(null)
  const [pushBusy, setPushBusy] = useState(false)

  useEffect(() => { getPushState().then(setPush) }, [])

  async function togglePush() {
    setPushBusy(true)
    try {
      setPush(push === 'on' ? await disablePush() : await enablePush())
    } catch {
      setPush(await getPushState())
    } finally {
      setPushBusy(false)
    }
  }

  const pushHint = {
    'needs-install': t('Add to Home Screen to enable notifications'),
    denied: t('Blocked — enable in system settings'),
    unsupported: t('Not supported on this device'),
  }[push]

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

        {push && (
          <div className="profile-menu-row profile-menu-row--language">
            <span>
              {t('Notifications')}
              {pushHint && <small style={{ display: 'block', opacity: 0.6, fontSize: 11 }}>{pushHint}</small>}
            </span>
            <div className="language-toggle">
              <button type="button" className={push === 'on' ? 'is-active' : ''} onClick={push === 'on' ? undefined : togglePush} disabled={pushBusy || Boolean(pushHint)}>
                {t('On')}
              </button>
              <button type="button" className={push !== 'on' ? 'is-active' : ''} onClick={push === 'on' ? togglePush : undefined} disabled={pushBusy || Boolean(pushHint)}>
                {t('Off')}
              </button>
            </div>
          </div>
        )}

        <button type="button" className="profile-menu-row profile-menu-row--link" disabled>
          <ChartIcon />
          {t('Access Logs')}
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
          {t('Admin Panel')}
        </button>

        {user.role.key === 'admin' && (
          <a href="/admin" className="profile-menu-row profile-menu-row--link">
            <GearIcon />
            {t('Admin Console')}
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
          {t('Sign Out')}
        </button>
      </div>
    </>
  )
}
