import { useEffect, useState } from 'react'
import { consoleApi } from '../api/console'
import { Field, PageHead } from './ui'

const OPTIONS = [
  ['T1', 'T1 and above — every service alert'],
  ['T2', 'T2 and above — Moderate and Serious'],
  ['T3', 'T3 only — Serious'],
  ['off', 'Off — never notify (alerts are still logged)'],
]

export function AlertSettingsPage() {
  const [value, setValue] = useState(null)
  const [state, setState] = useState({ busy: false, error: null, saved: false })

  useEffect(() => {
    consoleApi.getAlertSettings().then((r) => setValue(r.service_min_tier)).catch((e) => setState((s) => ({ ...s, error: e.message })))
  }, [])

  async function change(next) {
    const prev = value
    setValue(next)
    setState({ busy: true, error: null, saved: false })
    try {
      await consoleApi.updateAlertSettings({ service_min_tier: next })
      setState({ busy: false, error: null, saved: true })
    } catch (e) {
      setValue(prev)
      setState({ busy: false, error: e.message, saved: false })
    }
  }

  return (
    <>
      <PageHead title="Alerts" subtitle="Service alerts are always saved to Logs. Choose which tier also sends a push notification to Admin and Executive accounts." />
      <div className="cs-form" style={{ maxWidth: 480 }}>
        <Field label="Notify from tier" hint="Emergency alerts (red triangle) always notify Admin and Executive, regardless of this setting.">
          <select value={value ?? ''} disabled={value === null || state.busy} onChange={(e) => change(e.target.value)}>
            {OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </Field>
        {state.saved && <p className="cs-muted">Saved.</p>}
        {state.error && <p className="cs-error">{state.error}</p>}
      </div>
    </>
  )
}
