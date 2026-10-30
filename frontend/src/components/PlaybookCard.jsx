import { useLang } from '../i18n/LanguageContext'
import { BookIcon } from './icons'
import './ExecutiveOverview.css'

// Home entry to The Playbook; same look as the other call-to-action cards.
export function PlaybookCard({ onOpen }) {
  const { t } = useLang()
  return (
    <button type="button" className="playbook-cta" onClick={onOpen}>
      <span className="playbook-cta-icon">
        <BookIcon width="20" height="20" />
      </span>
      <div className="playbook-cta-eyebrow">{t('All Venues · Every Role')}</div>
      <div className="playbook-cta-title">{t('THE PLAYBOOK')}</div>
      <div className="playbook-cta-sub">{t('How we treat each other, and every guest.')}</div>
      <div className="playbook-cta-btn">{t('Open the Playbook →')}</div>
    </button>
  )
}
