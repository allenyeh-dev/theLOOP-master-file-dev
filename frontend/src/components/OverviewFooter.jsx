import { useState } from 'react'
import { useLang } from '../i18n/LanguageContext'
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from './icons'

export function OverviewFooter({ placeholder, onHome, onBack, onForward, canBack = false, canForward = false, onSearch }) {
  const { t } = useLang()
  const [query, setQuery] = useState('')

  function submit(e) {
    e.preventDefault()
    if (query.trim()) onSearch?.(query.trim())
  }

  return (
    <>
      <form className="ov-search-bar" onSubmit={submit}>
        <div className="ov-search-inner">
          <SearchIcon />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t(placeholder)} />
        </div>
      </form>
      <div className="ov-bottom-nav">
        <button type="button" className="ov-bnav-btn" disabled={!canBack} onClick={onBack} aria-label={t('Back')}>
          <ChevronLeftIcon width="16" height="16" />
        </button>
        <button type="button" className="ov-bnav-btn ov-bnav-home" onClick={onHome} aria-label={t('Home')}>
          <img src="/theloop_logo.png" alt="" width="34" height="34" style={{ objectFit: "contain" }} />
        </button>
        <button type="button" className="ov-bnav-btn" disabled={!canForward} onClick={onForward} aria-label={t('Forward')}>
          <ChevronRightIcon width="16" height="16" />
        </button>
      </div>
    </>
  )
}
