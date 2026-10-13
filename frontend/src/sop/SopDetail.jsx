import { useEffect, useState } from 'react'
import { sopApi } from '../api/sops'
import { useAuth } from '../context/AuthContext'
import { useLang } from '../i18n/LanguageContext'
import { AiReview } from './SopWizard'
import { localized } from './sopLang'

const STATUS_KEYS = { draft: '草稿', in_review: '簽核中', rejected: '被退回', published: '已發布', superseded: '舊版' }

export function SopDetail({ id, onBack, onEdit, onChanged }) {
  const { lang, t } = useLang()
  const { user, hasPermission } = useAuth()
  const [sop, setSop] = useState(null)
  const [error, setError] = useState(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [fullOpen, setFullOpen] = useState(false)
  const [flagOpen, setFlagOpen] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  const [flagSent, setFlagSent] = useState(false)

  const load = () => sopApi.get(id).then((r) => setSop(r.sop)).catch((e) => setError(t(e.message)))
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function run(fn) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(t(e.message))
    }
    setBusy(false)
  }

  const decide = (kind) => run(async () => {
    await sopApi[kind](id, comment)
    setComment('')
    onChanged()
    await load()
  })
  const markRead = () => run(async () => {
    await sopApi.markRead(id)
    onChanged()
    await load()
  })
  const sendFlag = () => run(async () => {
    await sopApi.flag(id, flagReason)
    setFlagSent(true)
    setFlagOpen(false)
    setFlagReason('')
  })

  if (error && !sop) return <p className="sop-error">{error}</p>
  if (!sop) return <p className="sop-sub">{t('載入中…')}</p>
  const { title, content: c, original } = localized(sop, lang)
  const origLang = sop.lang === 'en' ? t('英文') : t('中文')

  return (
    <div>
      <button type="button" className="sop-link" onClick={onBack}>{t('← 返回')}</button>
      {sop.code && <p className="sop-code sop-code--lg">{sop.code}</p>}
      <h1 className="sop-title">{title}</h1>
      {sop.status !== 'published' && <p className="sop-sub">{t(STATUS_KEYS[sop.status])} · {sop.author_name}</p>}
      {original && <p className="sop-notice">{t('此版本尚無翻譯，顯示原文')} · {t('原文（{lang}）', { lang: origLang })}</p>}

      <div className="sop-grid">
        <Meta label={t('部門')} value={sop.dept_label ?? '—'} />
        <Meta label={t('負責人')} value={sop.owner_label ?? '—'} />
        <Meta label={t('適用範圍')} value={sop.brands.length ? sop.brands.map((b) => b.label).join('、') : t('全公司')} />
        <Meta label={t('版本')} value={`v${sop.version_no}.0`} />
      </div>

      {sop.can_read && (
        <div className="sop-readflag">
          <button type="button" className={`sop-btn sop-btn--read ${sop.is_read ? 'is-done' : ''}`} disabled={busy || sop.is_read} onClick={markRead}>
            {sop.is_read ? t('已讀 ✓') : t('標為已讀')}
          </button>
          <button type="button" className="sop-btn sop-btn--ghost" onClick={() => setFlagOpen((o) => !o)}>⚑ {t('標記此 SOP 有問題')}</button>
          {flagOpen && (
            <div>
              <textarea className="sop-input" rows={3} placeholder={t('請寫下哪裡有問題')} value={flagReason} onChange={(e) => setFlagReason(e.target.value)} />
              <button type="button" className="sop-btn sop-btn--primary" disabled={busy || !flagReason.trim()} onClick={sendFlag}>{t('送出標記')}</button>
            </div>
          )}
          {flagSent && <p className="sop-notice">{t('已通知管理員')}</p>}
        </div>
      )}
      {sop.flag_count > 0 && <p className="sop-error">⚑ {t('{n} 則未處理標記', { n: sop.flag_count })}</p>}

      <h3 className="sop-label">{t('目的')}</h3>
      <p>{c.purpose}</p>

      <button type="button" className="sop-btn sop-btn--wide" onClick={() => setFullOpen((o) => !o)}>
        {fullOpen ? t('收合完整流程 ▲') : t('顯示完整流程 ▼')}
      </button>
      {fullOpen && (
        <div className="sop-full">
          <ol>{c.steps?.map((s, i) => <li key={i}>{s.action}{s.caution && <em>{t('（注意：{c}）', { c: s.caution })}</em>}</li>)}</ol>
          {c.mistakes && <><h3 className="sop-label">{t('常見錯誤')}</h3><p>{c.mistakes}</p></>}
        </div>
      )}

      {sop.approvals.length > 0 && (
        <Block title={t('簽核進度')}>
          <ul className="sop-timeline">
            {sop.approvals.map((a) => (
              <li key={a.step_no}>
                {t('第 {n} 關 · {role}：', { n: a.step_no, role: a.role_label })}
                {a.decision === 'approved' ? t(' ✓ {name} 通過', { name: a.approver_name }) : a.decision === 'rejected' ? t(' ✗ {name} 退回', { name: a.approver_name }) : t(' 等待中')}
                {a.comment && <em>{lang === 'zh' ? `「${a.comment}」` : `“${a.comment}”`}</em>}
              </li>
            ))}
          </ul>
        </Block>
      )}

      {sop.ai_review && <AiReview review={sop.ai_review} />}
      {error && <p className="sop-error">{error}</p>}

      {sop.status === 'in_review' && !sop.can_act && sop.created_by === user.id && hasPermission('sop.approve') && (
        <p className="sop-notice">{t('你是這份 SOP 的建立者，不能簽核自己的 SOP，請由其他人簽核')}</p>
      )}

      {sop.status === 'published' && sop.latest_status === 'in_review' && <p className="sop-notice">{t('已有新版本簽核中，通過前仍顯示目前版本')}</p>}
      {sop.can_edit && (
        <button type="button" className="sop-btn sop-btn--primary sop-btn--wide" onClick={() => onEdit(sop)}>
          {sop.status === 'published' ? t('編輯此 SOP（需重新簽核）') : t('修改後再送出')}
        </button>
      )}

      {sop.can_act && (
        <div className="sop-actions">
          <textarea className="sop-input" rows={2} placeholder={t('意見（退回時必填）')} value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="sop-nav">
            <button type="button" className="sop-btn" disabled={busy || !comment.trim()} onClick={() => decide('reject')}>{t('退回')}</button>
            <button type="button" className="sop-btn sop-btn--primary" disabled={busy} onClick={() => decide('approve')}>{t('通過')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

function Meta({ label, value }) {
  return <div className="sop-meta"><span>{label}</span><strong>{value}</strong></div>
}

function Block({ title, children }) {
  return <div className="sop-section"><strong>{title}</strong><div>{children}</div></div>
}
