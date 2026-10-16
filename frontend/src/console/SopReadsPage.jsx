import { useMemo, useState } from 'react'
import { consoleApi } from '../api/console'
import { PageHead, formatUtc, useLoader } from './ui'

const names = (list) => (list.length ? list.map((x) => x.label).join(', ') : '—')

export function SopReadsPage() {
  const data = useLoader(consoleApi.sopReads, (r) => r)
  const [view, setView] = useState('sop')
  const [sopId, setSopId] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(true)
  const [search, setSearch] = useState('')

  const { sops = [], users = [], pairs = [] } = data.data ?? {}
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const sopById = useMemo(() => new Map(sops.map((s) => [s.sop_id, s])), [sops])

  // Per SOP: readers vs. audience. Per person: SOPs they still have to read.
  const bySop = useMemo(() => {
    const m = new Map()
    for (const p of pairs) m.set(p.sop_id, [...(m.get(p.sop_id) ?? []), p])
    return m
  }, [pairs])
  const byUser = useMemo(() => {
    const m = new Map()
    for (const p of pairs) m.set(p.user_id, [...(m.get(p.user_id) ?? []), p])
    return m
  }, [pairs])

  const q = search.trim().toLowerCase()
  const userMatch = (u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q)

  const sopRows = (bySop.get(Number(sopId)) ?? [])
    .filter((p) => (!unreadOnly || !p.read_at) && userMatch(userById.get(p.user_id)))
    .sort((a, b) => Number(Boolean(a.read_at)) - Number(Boolean(b.read_at)) || userById.get(a.user_id).name.localeCompare(userById.get(b.user_id).name))

  const personRows = users
    .map((u) => {
      const mine = byUser.get(u.id) ?? []
      return { u, total: mine.length, unread: mine.filter((p) => !p.read_at) }
    })
    .filter((r) => r.total > 0 && userMatch(r.u) && (!unreadOnly || r.unread.length > 0))
    .sort((a, b) => b.unread.length - a.unread.length || a.u.name.localeCompare(b.u.name))

  return (
    <>
      <PageHead title="SOP · Readership" subtitle="Who has read each published SOP. A new version resets everyone to unread." />
      {data.error && <p className="cs-error">{data.error}</p>}
      {!data.data && !data.error && <p className="cs-muted">Loading…</p>}
      {data.data && (
        <>
          <div className="cs-toolbar">
            <button className={`cs-btn ${view === 'sop' ? 'cs-btn--primary' : ''}`} onClick={() => setView('sop')}>By SOP</button>
            <button className={`cs-btn ${view === 'person' ? 'cs-btn--primary' : ''}`} onClick={() => setView('person')}>By person</button>
            {view === 'sop' && (
              <select value={sopId} onChange={(e) => setSopId(e.target.value)}>
                <option value="">Select a SOP…</option>
                {sops.map((s) => {
                  const list = bySop.get(s.sop_id) ?? []
                  return <option key={s.sop_id} value={s.sop_id}>{s.code ?? '—'} · {s.title} ({list.filter((p) => p.read_at).length}/{list.length})</option>
                })}
              </select>
            )}
            <input placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
            <label className="cs-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Unread only
            </label>
          </div>

          {view === 'sop' && !sopId && (
            <table className="cs-table">
              <thead><tr><th>Code</th><th>Title</th><th>Dept</th><th>Version</th><th>Read</th></tr></thead>
              <tbody>
                {sops.length === 0 && <tr><td colSpan={5} className="cs-muted">No published SOPs yet.</td></tr>}
                {sops.map((s) => {
                  const list = bySop.get(s.sop_id) ?? []
                  const read = list.filter((p) => p.read_at).length
                  return (
                    <tr key={s.sop_id}>
                      <td><code>{s.code ?? '—'}</code></td>
                      <td><button className="cs-link" onClick={() => setSopId(String(s.sop_id))}>{s.title}</button></td>
                      <td>{s.dept_label ?? '—'}</td>
                      <td>v{s.version_no}</td>
                      <td><span className={`cs-tag ${read === list.length && list.length ? 'cs-tag--ok' : 'cs-tag--muted'}`}>{read}/{list.length}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {view === 'sop' && sopId && sopById.has(Number(sopId)) && (
            <table className="cs-table">
              <thead><tr><th>Name</th><th>Role</th><th>Brands</th><th>Departments</th><th>Status</th></tr></thead>
              <tbody>
                {sopRows.length === 0 && <tr><td colSpan={5} className="cs-muted">{unreadOnly ? 'Everyone has read this SOP.' : 'No matching people.'}</td></tr>}
                {sopRows.map((p) => {
                  const u = userById.get(p.user_id)
                  return (
                    <tr key={p.user_id}>
                      <td className="cs-strong">{u.name}<br /><span className="cs-muted">{u.email}</span></td>
                      <td>{u.role_label ?? '—'}</td>
                      <td>{names(u.brands)}</td>
                      <td>{names(u.departments)}</td>
                      <td>{p.read_at ? <span className="cs-tag cs-tag--ok">Read {formatUtc(p.read_at)}</span> : <span className="cs-tag cs-tag--off">Unread</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {view === 'person' && (
            <table className="cs-table">
              <thead><tr><th>Name</th><th>Role</th><th>Brands</th><th>Unread</th><th>Unread SOPs</th></tr></thead>
              <tbody>
                {personRows.length === 0 && <tr><td colSpan={5} className="cs-muted">{unreadOnly ? 'Nobody has unread SOPs.' : 'No matching people.'}</td></tr>}
                {personRows.map(({ u, total, unread }) => (
                  <tr key={u.id}>
                    <td className="cs-strong">{u.name}<br /><span className="cs-muted">{u.email}</span></td>
                    <td>{u.role_label ?? '—'}</td>
                    <td>{names(u.brands)}</td>
                    <td><span className={`cs-tag ${unread.length ? 'cs-tag--off' : 'cs-tag--ok'}`}>{unread.length}/{total}</span></td>
                    <td>{unread.map((p) => sopById.get(p.sop_id)?.code ?? `#${p.sop_id}`).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  )
}
