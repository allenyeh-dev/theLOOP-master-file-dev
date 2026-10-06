import { useEffect, useState } from 'react'

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="cs-backdrop" onMouseDown={onClose}>
      <div className={`cs-modal ${wide ? 'cs-modal--wide' : ''}`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <header className="cs-modal-head">
          <h2>{title}</h2>
          <button type="button" className="cs-icon-btn" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="cs-modal-body">{children}</div>
        {footer && <footer className="cs-modal-foot">{footer}</footer>}
      </div>
    </div>
  )
}

export function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="cs-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="cs-btn cs-btn--danger" onClick={run} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <p>{message}</p>
      {error && <p className="cs-error">{error}</p>}
    </Modal>
  )
}

// Wraps a form submit with busy + error state and closes on success.
export function useSubmit(action, onDone) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  async function submit(e) {
    e?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await action()
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return { busy, error, submit }
}

export function Field({ label, hint, children }) {
  return (
    <label className="cs-field">
      <span className="cs-field-label">{label}</span>
      {children}
      {hint && <span className="cs-field-hint">{hint}</span>}
    </label>
  )
}

export function PageHead({ title, subtitle, action }) {
  return (
    <div className="cs-page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function useLoader(fetcher, pick) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    fetcher()
      .then((res) => !cancelled && (setData(pick(res)), setError(null)))
      .catch((err) => !cancelled && setError(err.message))
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])

  return { data, error, reload: () => setTick((t) => t + 1) }
}
