import { useEffect, useState } from 'react'
import { clearCompletedTasks, createTask, deleteTask, fetchTasks, setTaskDone } from '../api/tasks'
import { useLang } from '../i18n/LanguageContext'
import './TasksBoard.css'

const PRIORITIES = [['high', 'HIGH'], ['med', 'MED'], ['low', 'LOW']]
const pad = (n) => String(n).padStart(2, '0')
const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatTime(hhmm, lang) {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(lang === 'zh' ? 'zh-TW' : 'en-US', { hour: 'numeric', minute: '2-digit' })
}

function dueLabel(task, t, lang) {
  if (!task.due_date) return t('No due date')
  const time = task.due_time ? formatTime(task.due_time, lang) : null
  if (task.due_date === todayIso()) return time ? t('Due {when}', { when: time }) : t('Due today')
  const day = new Date(`${task.due_date}T00:00:00`).toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { month: 'short', day: 'numeric' })
  return t('Due {when}', { when: time ? `${day} ${time}` : day })
}

function completedLabel(task, t, lang) {
  const at = new Date(`${task.completed_at.replace(' ', 'T')}Z`) // stored as UTC
  const time = at.toLocaleTimeString(lang === 'zh' ? 'zh-TW' : 'en-US', { hour: 'numeric', minute: '2-digit' })
  const day = at.toDateString() === new Date().toDateString() ? '' : `${at.toLocaleDateString(lang === 'zh' ? 'zh-TW' : 'en-US', { month: 'short', day: 'numeric' })} `
  return t('Completed {time}', { time: `${day}${time}` }) + (task.completed_by ? ` · ${task.completed_by}` : '')
}

function AddTaskForm({ brandId, onAdded, onCancel }) {
  const { t } = useLang()
  const [form, setForm] = useState({ title: '', priority: 'med', due_date: '', due_time: '', assigned_to: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  async function submit(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    setBusy(true)
    setError(null)
    try {
      const { task } = await createTask({ brand_id: brandId, ...form })
      onAdded(task)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form className="tk-form" onSubmit={submit}>
      <input autoFocus value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder={t('What needs to be done?')} maxLength={200} required />
      <div className="tk-form-row">
        <select value={form.priority} onChange={(e) => set({ priority: e.target.value })} aria-label={t('Priority')}>
          {PRIORITIES.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <input type="date" value={form.due_date} onChange={(e) => set({ due_date: e.target.value, due_time: e.target.value ? form.due_time : '' })} aria-label={t('Due date')} />
        <input type="time" value={form.due_time} disabled={!form.due_date} onChange={(e) => set({ due_time: e.target.value })} aria-label={t('Due time')} />
      </div>
      <input value={form.assigned_to} onChange={(e) => set({ assigned_to: e.target.value })} placeholder={t('Assigned to (optional)')} maxLength={100} />
      {error && <p className="error-text">{t('Error: {msg}', { msg: t(error) })}</p>}
      <div className="tk-form-actions">
        <button type="button" className="tk-btn" onClick={onCancel} disabled={busy}>{t('Cancel')}</button>
        <button type="submit" className="tk-btn tk-btn--primary" disabled={busy || !form.title.trim()}>{busy ? t('Saving…') : t('Add Task')}</button>
      </div>
    </form>
  )
}

function TaskRow({ task, onToggle, onDelete }) {
  const { t, lang } = useLang()
  const done = Boolean(task.completed_at)
  const meta = done
    ? completedLabel(task, t, lang)
    : [dueLabel(task, t, lang), task.assigned_to && t('Assigned: {who}', { who: task.assigned_to })].filter(Boolean).join(' · ')
  return (
    <div className={`tk-row${done ? ' is-done' : ''}`}>
      <input type="checkbox" className="tk-check" checked={done} onChange={() => onToggle(task)} aria-label={task.title} />
      <div className="tk-main">
        <strong>{task.title}</strong>
        <small>{meta}</small>
      </div>
      {done ? (
        <>
          <span className="tk-badge tk-badge--done">{t('DONE')}</span>
          <button type="button" className="tk-delete" onClick={() => onDelete(task)} aria-label={t('Delete')}>×</button>
        </>
      ) : (
        <span className={`tk-badge tk-badge--${task.priority}`}>{task.priority.toUpperCase()}</span>
      )}
    </div>
  )
}

// A brand's to-do list (the TASKS tab): open tasks on top, done tasks below until deleted or cleared.
export function TasksBoard({ brand }) {
  const { t } = useLang()
  const [state, setState] = useState({ loading: true, error: null, tasks: [] })
  const [adding, setAdding] = useState(false)
  const [actionError, setActionError] = useState(null)

  useEffect(() => {
    let live = true
    fetchTasks(brand.id)
      .then((d) => live && setState({ loading: false, error: null, tasks: d.tasks }))
      .catch((err) => live && setState({ loading: false, error: err.message, tasks: [] }))
    return () => { live = false }
  }, [brand.id])

  const open = state.tasks.filter((x) => !x.completed_at)
  const done = state.tasks.filter((x) => x.completed_at)
  const reload = () => fetchTasks(brand.id).then((d) => setState({ loading: false, error: null, tasks: d.tasks })).catch(() => {})

  // The server sorts, so after any change just refetch instead of re-implementing the ordering here.
  async function run(action) {
    setActionError(null)
    try {
      await action()
    } catch (err) {
      setActionError(err.message)
    }
    reload()
  }

  const toggle = (task) => run(() => setTaskDone(task.id, !task.completed_at))
  const remove = (task) => run(() => deleteTask(task.id))
  const clearAll = () => {
    if (window.confirm(t('Clear all {n} completed tasks?', { n: done.length }))) run(() => clearCompletedTasks(brand.id))
  }

  return (
    <div className="tasks-board">
      <p className="section-label">{t('OPEN')} ({open.length})</p>
      {state.loading && <p className="muted">{t('Loading…')}</p>}
      {state.error && <p className="error-text">{t('Error: {msg}', { msg: t(state.error) })}</p>}
      {!state.loading && !state.error && open.length === 0 && <p className="muted">{t('No open tasks.')}</p>}
      {open.length > 0 && (
        <div className="tk-card">
          {open.map((task) => <TaskRow key={task.id} task={task} onToggle={toggle} onDelete={remove} />)}
        </div>
      )}

      {adding ? (
        <AddTaskForm brandId={brand.id} onAdded={() => { setAdding(false); reload() }} onCancel={() => setAdding(false)} />
      ) : (
        <button type="button" className="tk-add" onClick={() => setAdding(true)}>+ {t('Add Task')}</button>
      )}

      {actionError && <p className="error-text">{t('Error: {msg}', { msg: t(actionError) })}</p>}

      {done.length > 0 && (
        <>
          <div className="tk-done-head">
            <p className="section-label">{t('COMPLETED')} ({done.length})</p>
            <button type="button" className="tk-clear" onClick={clearAll}>{t('Clear all completed')}</button>
          </div>
          <div className="tk-card">
            {done.map((task) => <TaskRow key={task.id} task={task} onToggle={toggle} onDelete={remove} />)}
          </div>
        </>
      )}
    </div>
  )
}
