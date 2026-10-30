import { useMemo, useState } from 'react'
import { consoleApi } from '../api/console'
import { sopApi } from '../api/sops'
import { useLang } from '../i18n/LanguageContext'
import { ConfirmDialog, LangToggle, PageHead, formatUtc, useLoader } from './ui'
import { localizedTitle } from '../sop/sopLang'
import { SopUploadPage } from './SopUploadPage'
import { SopReviewPage } from './SopReviewPage'
import { UserManagersPage } from './UserManagersPage'

const STATUS = { draft: 'Draft', in_review: 'In review', rejected: 'Rejected', published: 'Published' }
const names = (list) => (list.length ? list.map((x) => x.label).join(', ') : '—')

// All SOPs in one place: edit/publish a new version, and see who has (not) read each published one.
export function SopManagePage() {
  const { t, lang } = useLang()
  const titleOf = (row) => localizedTitle(row, lang)
  const [editId, setEditId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [managing, setManaging] = useState(false)
  const [reviewId, setReviewId] = useState(null)
  const [readSopId, setReadSopId] = useState(null)
  const [view, setView] = useState('sop')
  const [delSop, setDelSop] = useState(null)
  const [unreadOnly, setUnreadOnly] = useState(true)
  const [search, setSearch] = useState('')
  const [sopQ, setSopQ] = useState('')
  const { data, error, reload } = useLoader(() => Promise.all([sopApi.list('all'), consoleApi.sopReads(), sopApi.flags()]), ([l, r, f]) => ({ list: l.sops, reads: r, flags: f.flags }))

  const { users = [], pairs = [] } = data?.reads ?? {}
  const flags = data?.flags ?? []
  const flagCount = useMemo(() => {
    const m = new Map()
    for (const f of flags) m.set(f.sop_id, (m.get(f.sop_id) ?? 0) + 1)
    return m
  }, [flags])
  const [busyFlag, setBusyFlag] = useState(null)
  const resolve = async (id) => {
    setBusyFlag(id)
    try { await sopApi.resolveFlag(id); await reload() } finally { setBusyFlag(null) }
  }
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const sopById = useMemo(() => new Map((data?.reads.sops ?? []).map((s) => [s.sop_id, s])), [data])
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

  if (reviewId) return <SopReviewPage sopId={reviewId} onBack={() => { setReviewId(null); reload() }} />
  if (managing) return <UserManagersPage onBack={() => setManaging(false)} />
  if (creating) return <SopUploadPage onBack={() => { setCreating(false); reload() }} />
  if (editId) return <SopUploadPage editId={editId} onBack={() => { setEditId(null); reload() }} />

  const q = search.trim().toLowerCase()
  const sops = (data?.list ?? []).filter((s) => !sopQ.trim() || `${s.code ?? ''} ${titleOf(s)} ${s.dept_label ?? ''}`.toLowerCase().includes(sopQ.trim().toLowerCase()))
  const userMatch = (u) => !q || `${u.name} ${u.email}`.toLowerCase().includes(q)
  const back = (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
      <LangToggle />
      <button type="button" className="cs-btn" onClick={() => setReadSopId(null)}>{t('← Back')}</button>
    </div>
  )

  const searchBar = (
    <>
      <input placeholder={t('Search name or email')} value={search} onChange={(e) => setSearch(e.target.value)} />
      <label className="cs-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> {t('Unread only')}
      </label>
    </>
  )

  // Readers of one SOP.
  if (readSopId) {
    const s = sopById.get(readSopId)
    const rows = (bySop.get(readSopId) ?? [])
      .filter((p) => (!unreadOnly || !p.read_at) && userMatch(userById.get(p.user_id)))
      .sort((a, b) => Number(Boolean(a.read_at)) - Number(Boolean(b.read_at)) || userById.get(a.user_id).name.localeCompare(userById.get(b.user_id).name))
    return (
      <>
        <PageHead title={`${s?.code ?? '—'} · ${s ? titleOf(s) : ''}`} subtitle={t('Who has read this SOP. A new version resets everyone to unread.')} action={back} />
        <div className="cs-toolbar">{searchBar}</div>
        <table className="cs-table">
          <thead><tr><th>{t('Name')}</th><th>{t('Role')}</th><th>{t('Brands')}</th><th>{t('Departments')}</th><th>{t('Status')}</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="cs-muted">{unreadOnly ? t('Everyone has read this SOP.') : t('No matching people.')}</td></tr>}
            {rows.map((p) => {
              const u = userById.get(p.user_id)
              return (
                <tr key={p.user_id}>
                  <td className="cs-strong">{u.name}<br /><span className="cs-muted">{u.email}</span></td>
                  <td>{u.role_label ?? '—'}</td>
                  <td>{names(u.brands)}</td>
                  <td>{names(u.departments)}</td>
                  <td>{p.read_at ? <span className="cs-tag cs-tag--ok">{t('Read')} {formatUtc(p.read_at)}</span> : <span className="cs-tag cs-tag--off">{t('Unread')}</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </>
    )
  }

  const personRows = users
    .map((u) => {
      const mine = byUser.get(u.id) ?? []
      return { u, total: mine.length, unread: mine.filter((p) => !p.read_at) }
    })
    .filter((r) => r.total > 0 && userMatch(r.u) && (!unreadOnly || r.unread.length > 0))
    .sort((a, b) => b.unread.length - a.unread.length || a.u.name.localeCompare(b.u.name))

  return (
    <>
      <PageHead title="SOP" subtitle={t('Edit a SOP (fix text, add images) and publish the new version, or check who has read it.')} action={<div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}><LangToggle /><button type="button" className="cs-btn" onClick={() => setManaging(true)}>{t('Managers')}</button><button type="button" className="cs-btn cs-btn--primary" onClick={() => setCreating(true)}>{t('+ Create')}</button></div>} />
      {error && <p className="cs-error">{error}</p>}
      {!data && !error && <p className="cs-muted">{t('Loading…')}</p>}
      {data && (
        <>
          <div className="cs-toolbar">
            <button className={`cs-btn ${view === 'sop' ? 'cs-btn--primary' : ''}`} onClick={() => setView('sop')}>{t('By SOP')}</button>
            <button className={`cs-btn ${view === 'person' ? 'cs-btn--primary' : ''}`} onClick={() => setView('person')}>{t('By person')}</button>
            <button className={`cs-btn ${view === 'flags' ? 'cs-btn--primary' : ''}`} onClick={() => setView('flags')}>{t('Flags')}{flags.length ? ` (${flags.length})` : ''}</button>
            {view === 'sop' && <input placeholder={t('Search code, title or department')} value={sopQ} onChange={(e) => setSopQ(e.target.value)} />}
            {view === 'person' && searchBar}
          </div>

          {view === 'sop' && (
            <table className="cs-table">
              <thead><tr><th>{t('Code')}</th><th>{t('Title')}</th><th>{t('Department')}</th><th>{t('Status')}</th><th>{t('Read')}</th><th>{t('Flags')}</th><th /></tr></thead>
              <tbody>
                {sops.length === 0 && <tr><td colSpan={7} className="cs-muted">{sopQ ? t('No matching SOPs.') : t('No SOPs yet.')}</td></tr>}
                {sops.map((s) => {
                  const list = bySop.get(s.sop_id) ?? []
                  const read = list.filter((p) => p.read_at).length
                  return (
                    <tr key={s.sop_id}>
                      <td>{s.code ?? '—'}</td>
                      <td>{titleOf(s)}</td>
                      <td>{s.dept_label ?? '—'}</td>
                      <td>{t(STATUS[s.status] ?? s.status)}</td>
                      <td>
                        {sopById.has(s.sop_id)
                          ? <button type="button" className="cs-link" onClick={() => setReadSopId(s.sop_id)}><span className={`cs-tag ${read === list.length && list.length ? 'cs-tag--ok' : 'cs-tag--muted'}`}>{read}/{list.length}</span></button>
                          : '—'}
                      </td>
                      <td>{flagCount.get(s.sop_id) ? <button type="button" className="cs-link" onClick={() => setView('flags')}><span className="cs-tag cs-tag--off">⚑ {flagCount.get(s.sop_id)}</span></button> : '—'}</td>
                      <td>
                        {s.status === 'in_review'
                          ? <button type="button" className="cs-link" onClick={() => setReviewId(s.sop_id)}>{t('Review')}</button>
                          : <button type="button" className="cs-link" onClick={() => setEditId(s.sop_id)}>{t('Edit')}</button>}
                        {' '}<button type="button" className="cs-link cs-link--danger" onClick={() => setDelSop(s)}>{t('Delete')}</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {view === 'flags' && (
            <table className="cs-table">
              <thead><tr><th>SOP</th><th>{t('Reported by')}</th><th>{t('Reason')}</th><th>{t('When')}</th><th /></tr></thead>
              <tbody>
                {flags.length === 0 && <tr><td colSpan={5} className="cs-muted">{t('No open flags.')}</td></tr>}
                {flags.map((f) => (
                  <tr key={f.id}>
                    <td>{f.code ? `${f.code} · ` : ''}{titleOf(f)}</td>
                    <td>{f.flagged_by}</td>
                    <td style={{ whiteSpace: 'pre-wrap' }}>{f.reason}</td>
                    <td>{formatUtc(f.created_at)}</td>
                    <td>
                      <button type="button" className="cs-link" onClick={() => setEditId(f.sop_id)}>{t('Edit SOP')}</button>{' · '}
                      <button type="button" className="cs-link" disabled={busyFlag === f.id} onClick={() => resolve(f.id)}>{t('Mark resolved')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {view === 'person' && (
            <table className="cs-table">
              <thead><tr><th>{t('Name')}</th><th>{t('Role')}</th><th>{t('Brands')}</th><th>{t('Unread')}</th><th>{t('Unread SOPs')}</th></tr></thead>
              <tbody>
                {personRows.length === 0 && <tr><td colSpan={5} className="cs-muted">{unreadOnly ? t('Nobody has unread SOPs.') : t('No matching people.')}</td></tr>}
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
      {delSop && (
        <ConfirmDialog
          title={t('Delete SOP')}
          message={t('Permanently delete {name} with all its versions, read records and flags? This cannot be undone.', { name: `${delSop.code ? `${delSop.code} · ` : ''}"${titleOf(delSop)}"` })}
          onClose={() => setDelSop(null)}
          onConfirm={async () => { await sopApi.remove(delSop.sop_id); await reload() }}
        />
      )}
    </>
  )
}
