import { useEffect, useState } from 'react'
import { sopApi } from '../api/sops'
import { ConfirmDialog, formatUtc } from './ui'

const STATUS = { draft: 'Draft', in_review: 'In review', rejected: 'Rejected', published: 'Published', superseded: 'Superseded' }

const FIELDS = [
  ['Title', (c) => [c.title]],
  ['Purpose', (c) => [c.purpose]],
  ['Key standards', (c) => c.standards ?? []],
  ['Steps', (c) => (c.steps ?? []).map((st) => (st.caution ? `${st.action} (Caution: ${st.caution})` : st.action))],
  ['Submission notes', (c) => [c.notes]],
  ['Audience', (c) => [c.audience]],
  ['Tools / ingredients', (c) => [c.tools]],
  ['Common mistakes', (c) => [c.mistakes]],
].map(([label, get]) => [label, (c) => get(c).filter(Boolean)])

// Line diff (longest common subsequence) between two lists of strings.
function diffLines(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  }
  const out = []
  let i = 0, j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { out.push({ type: 'same', text: a[i] }); i++; j++ }
    else if (j < b.length && (i === a.length || dp[i][j + 1] >= dp[i + 1][j])) out.push({ type: 'add', text: b[j++] })
    else out.push({ type: 'del', text: a[i++] })
  }
  return out
}

const LINE_STYLE = {
  add: { background: 'rgba(22, 163, 74, 0.16)' },
  del: { background: 'rgba(220, 38, 38, 0.14)', textDecoration: 'line-through' },
  same: { opacity: 0.6 },
}
const MARK = { add: '+', del: '−', same: ' ' }

function Changes({ prev, version }) {
  const parts = FIELDS.map(([label, get]) => [label, diffLines(prev ? get(prev.content) : [], get(version.content))])
    .filter(([, lines]) => lines.some((l) => l.type !== 'same'))
  if (parts.length === 0) return <p className="cs-muted">No text changes{prev ? ` since v${prev.version_no}` : ''} (images or SOP details may differ).</p>
  return (
    <div className="cs-form">
      {parts.map(([label, lines]) => (
        <div key={label}>
          <strong>{label}</strong>
          {lines.map((l, i) => (
            <div key={i} style={{ ...LINE_STYLE[l.type], padding: '0.1rem 0.4rem', whiteSpace: 'pre-wrap' }}>{MARK[l.type]} {l.text}</div>
          ))}
        </div>
      ))}
    </div>
  )
}

// Version list of one SOP with per-version changes (vs the previous version) and restore.
export function SopVersionHistory({ sopId, refreshKey, onRestored }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(null)
  const [restore, setRestore] = useState(null)

  useEffect(() => {
    sopApi.versions(sopId).then(setData).catch((e) => setError(e.message))
  }, [sopId, refreshKey])

  if (error) return <p className="cs-error">{error}</p>
  if (!data) return <p className="cs-muted">Loading…</p>

  const { versions, current_id, can_restore } = data
  return (
    <div className="cs-form">
      {versions.map((v, i) => {
        const prev = versions[i + 1]
        return (
          <div key={v.id}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong>v{v.version_no}</strong>
              <span>{STATUS[v.status] ?? v.status}{v.id === current_id ? ' · current' : ''}</span>
              <span className="cs-muted">{v.editor_name} · {formatUtc(v.published_at ?? v.submitted_at ?? v.created_at)}</span>
              <button type="button" className="cs-link" onClick={() => setOpen(open === v.id ? null : v.id)}>{open === v.id ? 'Hide changes' : 'Changes'}</button>
              {can_restore && v.id !== current_id && <button type="button" className="cs-link" onClick={() => setRestore(v)}>Restore</button>}
            </div>
            {open === v.id && <div style={{ margin: '0.5rem 0 0.75rem 1rem' }}><Changes prev={prev} version={v} /></div>}
          </div>
        )
      })}
      {restore && (
        <ConfirmDialog
          title={`Restore v${restore.version_no}`}
          message={`Use the content of v${restore.version_no} as the newest version? Nothing is deleted — it is added to the history as a new version, and unsaved edits in the form are discarded.`}
          confirmLabel="Restore"
          onClose={() => setRestore(null)}
          onConfirm={async () => { await sopApi.restoreVersion(sopId, restore.id); onRestored() }}
        />
      )}
    </div>
  )
}
