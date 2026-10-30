import { useEffect, useState } from 'react'
import { sopApi } from '../api/sops'
import { useLang } from '../i18n/LanguageContext'
import { Field, PageHead } from './ui'

const sideOf = (c) => (
  <div className="cs-form">
    <Field label="Title"><p style={{ margin: 0 }}>{c?.title || '—'}</p></Field>
    <Field label="Purpose"><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{c?.purpose || '—'}</p></Field>
    <Field label="Key principles">
      {c?.standards?.length ? <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>{c.standards.map((x, i) => <li key={i}>{x}</li>)}</ul> : '—'}
    </Field>
    <Field label="Steps">
      {c?.steps?.length
        ? <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>{c.steps.map((st, i) => <li key={i}>{st.action}{st.caution && <em className="cs-muted"> ({st.caution})</em>}</li>)}</ol>
        : '—'}
    </Field>
  </div>
)

// Admin view of one SOP awaiting approval: both language versions, the approval progress, approve / reject.
export function SopReviewPage({ sopId, onBack }) {
  const { t } = useLang()
  const [sop, setSop] = useState(null)
  const [error, setError] = useState(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)

  const load = () => sopApi.get(sopId).then((r) => setSop(r.sop)).catch((e) => setError(e.message))
  useEffect(() => { load() }, [sopId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function decide(kind) {
    setBusy(true); setError(null)
    try {
      await sopApi[kind](sopId, comment)
      onBack() // the list reloads and shows the new status
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  const back = <button type="button" className="cs-btn" onClick={onBack}>{t('← Back')}</button>
  if (!sop) return <><PageHead title="SOP" action={back} />{error ? <p className="cs-error">{error}</p> : <p className="cs-muted">{t('Loading…')}</p>}</>

  const other = sop.lang === 'en' ? 'zh' : 'en'
  const docs = { [sop.lang]: sop.content, [other]: sop.content_alt }
  return (
    <>
      <PageHead
        title={`${sop.code ?? '—'} · ${sop.title}`}
        subtitle={`${t('Submitted by')} ${sop.editor_name} · ${sop.dept_label ?? '—'} · ${sop.brands.length ? sop.brands.map((b) => b.label).join(', ') : t('All')} · v${sop.version_no}`}
        action={back}
      />
      {error && <p className="cs-error">{error}</p>}

      <h3>{t('Approval progress')}</h3>
      <table className="cs-table">
        <thead><tr><th>#</th><th>{t('Approver')}</th><th>{t('Status')}</th><th>{t('Comment')}</th></tr></thead>
        <tbody>
          {sop.approvals.map((a) => (
            <tr key={a.step_no}>
              <td>{a.step_no}</td>
              <td className="cs-strong">{a.assignee_name ?? a.role_label}</td>
              <td>{a.decision === 'approved' ? <span className="cs-tag cs-tag--ok">{t('Approved')}</span> : a.decision === 'rejected' ? <span className="cs-tag cs-tag--off">{t('Rejected')}</span> : <span className="cs-tag cs-tag--muted">{t('Pending')}</span>}
                {a.approver_name && a.approver_name !== a.assignee_name && <span className="cs-muted"> {a.approver_name}</span>}</td>
              <td style={{ whiteSpace: 'pre-wrap' }}>{a.comment ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', margin: '1.5rem 0' }}>
        <div><h3>English</h3>{docs.en ? sideOf(docs.en) : <p className="cs-muted">{t('No translation')}</p>}</div>
        <div><h3>中文</h3>{docs.zh ? sideOf(docs.zh) : <p className="cs-muted">{t('No translation')}</p>}</div>
      </div>

      {sop.can_act ? (
        <div className="cs-form" style={{ maxWidth: '40rem' }}>
          <Field label={t('Comment')} hint={t('Required when rejecting.')}>
            <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button type="button" className="cs-btn" disabled={busy || !comment.trim()} onClick={() => decide('reject')}>{t('Reject')}</button>
            <button type="button" className="cs-btn cs-btn--primary" disabled={busy} onClick={() => decide('approve')}>{t('Approve')}</button>
          </div>
        </div>
      ) : <p className="cs-muted">{t('This SOP is not waiting for your approval.')}</p>}
    </>
  )
}
