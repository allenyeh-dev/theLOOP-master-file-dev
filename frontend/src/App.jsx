import { AuthProvider, useAuth } from './context/AuthContext'
import { stopImpersonating } from './api/auth'
import { LoginPage } from './components/LoginPage'
import { Dashboard } from './components/Dashboard'
import { AnnouncementSheet } from './components/AnnouncementSheet'
import { AdminConsole, isConsolePath } from './console/AdminConsole'
import { LanguageProvider } from './i18n/LanguageContext'
import './App.css'

function AppShell() {
  const { user, loading, impersonating } = useAuth()

  if (loading) {
    return <div className="app-loading">Loading…</div>
  }

  if (!user) return <LoginPage />
  if (isConsolePath()) return <AdminConsole />
  return (
    <>
      {impersonating && (
        <div className="impersonate-banner">
          正以 {user.name} 的身分檢視 ·{' '}
          <button type="button" onClick={() => stopImpersonating().then(() => window.location.assign('/admin#users')).catch(() => window.location.assign('/'))}>返回管理員</button>
        </div>
      )}
      <Dashboard />
      <AnnouncementSheet />
    </>
  )
}

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </LanguageProvider>
  )
}

export default App
