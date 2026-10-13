import { AuthProvider, useAuth } from './context/AuthContext'
import { LoginPage } from './components/LoginPage'
import { Dashboard } from './components/Dashboard'
import { AdminConsole, isConsolePath } from './console/AdminConsole'
import { LanguageProvider } from './i18n/LanguageContext'
import './App.css'

function AppShell() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="app-loading">Loading…</div>
  }

  if (!user) return <LoginPage />
  return isConsolePath() ? <AdminConsole /> : <Dashboard />
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
