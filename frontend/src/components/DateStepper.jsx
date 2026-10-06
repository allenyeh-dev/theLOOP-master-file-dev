import './OverviewShared.css'

export function DateStepper({ label, isToday, onPrev, onNext, canNext }) {
  return (
    <div className="date-stepper">
      <button type="button" className="ds-arrow" onClick={onPrev} aria-label="Previous day">
        ‹
      </button>
      <span className="ds-label">
        {label}
        {isToday && <span className="ds-today-tag">TODAY</span>}
      </span>
      <button type="button" className="ds-arrow" onClick={onNext} disabled={!canNext} aria-label="Next day">
        ›
      </button>
    </div>
  )
}
