import { useEffect, useState } from 'react'
import { fetchBrandNotices } from '../api/data'
import { useLang } from '../i18n/LanguageContext'
import { AnnouncementCard } from './Announcements'
import { OpsBoard } from './OpsBoard'
import { WhatsHappening } from './WhatsHappening'
import './BrandPicker.css'

// A brand's own page (the OPS tab): its notices (always listed, re-readable), the daily Ops Board and its events.
export function BrandPage({ brand }) {
  const { t } = useLang()
  const [notices, setNotices] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBrandNotices(brand.id)
      .then((d) => setNotices(d.notices))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [brand.id])

  return (
    <div className="brand-page">
      <section className="brand-notices">
        <p className="section-label">{t('BRAND NOTICES')}</p>
        {loading && <p className="muted">{t('Loading…')}</p>}
        {error && <p className="error-text">{t('Error: {msg}', { msg: t(error) })}</p>}
        {!loading && !error && notices.length === 0 && <p className="muted">{t('No notices for this brand.')}</p>}
        <div className="announcement-list">
          {notices.map((n) => <AnnouncementCard key={n.id} a={n} />)}
        </div>
      </section>

      <OpsBoard brand={brand} />

      <WhatsHappening brandId={brand.id} />
    </div>
  )
}
