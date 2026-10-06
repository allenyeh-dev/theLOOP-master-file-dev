import { ChevronLeftIcon, ChevronRightIcon, HomeIcon, SearchIcon } from './icons'
import './OverviewShared.css'

export function OverviewFooter({ placeholder, onHome }) {
  return (
    <>
      <div className="ov-search-bar">
        <div className="ov-search-inner">
          <SearchIcon />
          <input type="text" placeholder={placeholder} />
        </div>
      </div>
      <div className="ov-bottom-nav">
        <button type="button" className="ov-bnav-btn" disabled aria-label="Back">
          <ChevronLeftIcon width="16" height="16" />
        </button>
        <button type="button" className="ov-bnav-btn ov-bnav-home" onClick={onHome} aria-label="Home">
          <HomeIcon />
        </button>
        <button type="button" className="ov-bnav-btn" disabled aria-label="Forward">
          <ChevronRightIcon width="16" height="16" />
        </button>
      </div>
    </>
  )
}
