import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { fetchMe, login as loginRequest, logout as logoutRequest } from '../api/auth'
import { detachPush, syncPush } from '../utils/push'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [impersonating, setImpersonating] = useState(false)

  useEffect(() => {
    fetchMe()
      .then((data) => { setUser(data.user); setImpersonating(Boolean(data.impersonating)); syncPush() })
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await loginRequest(email, password)
    setUser(data.user)
    syncPush()
    return data.user
  }, [])

  const logout = useCallback(async () => {
    await detachPush() // needs the session, so before logoutRequest
    await logoutRequest().catch(() => {})
    setUser(null)
  }, [])

  const hasPermission = useCallback(
    (permission) => Boolean(user?.permissions?.includes(permission)),
    [user]
  )

  return (
    <AuthContext.Provider value={{ user, loading, impersonating, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
