import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../i18n/LanguageContext'
import './LoginPage.css'

export function LoginPage() {
  const { login } = useAuth()
  const { lang, setLang, t } = useLang()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(t(err.message))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="logo">THE LOOP</div>
        <div className="language-toggle login-lang">
          <button type="button" className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>EN</button>
          <button type="button" className={lang === 'zh' ? 'is-active' : ''} onClick={() => setLang('zh')}>中文</button>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label>
            {t('Email')}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </label>

          <label>
            {t('Password')}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" disabled={submitting}>
            {submitting ? t('Signing in…') : t('Sign In')}
          </button>
        </form>
      </div>
    </div>
  )
}
