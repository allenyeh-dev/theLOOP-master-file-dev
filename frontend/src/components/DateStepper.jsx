import { useLang } from '../i18n/LanguageContext'
import './OverviewShared.css'

export function DateStepper({ label, isToday, onPrev, onNext, canNext }) {
  const { t } = useLang()
  return (
    <div className="date-stepper">
      <button type="button" className="ds-arrow" onClick={onPrev} aria-label={t('Previous day')}>
        ‹
      </button>
      <span className="ds-label">
        {label}
        {isToday && <span className="ds-today-tag">{t('TODAY')}</span>}
      </span>
      <button type="button" className="ds-arrow" onClick={onNext} disabled={!canNext} aria-label={t('Next day')}>
        ›
      </button>
    </div>
  )
}
