import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { getLang, storeLang } from './lang'
import { en, zh } from './strings'

const dicts = { en, zh }
const LanguageContext = createContext(null)

storeLang(getLang()) // sync <html lang> on boot

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(getLang)

  const setLang = useCallback((next) => {
    storeLang(next)
    setLangState(next)
  }, [])

  const t = useCallback(
    (text, vars) => {
      let out = dicts[lang][text] ?? text
      if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
      return out
    },
    [lang]
  )

  // Pick the localized column of a DB row: pick(row, 'title') -> row.title_zh in zh (falls back to row.title).
  const pick = useCallback(
    (row, field) => (lang === 'zh' && row[`${field}_zh`]) || row[field],
    [lang]
  )

  const value = useMemo(() => ({ lang, setLang, t, pick }), [lang, setLang, t, pick])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLang() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider')
  return ctx
}
