import { useEffect, useState } from 'react'
import { fetchBrands } from '../api/data'
import { useLang } from '../i18n/LanguageContext'
import { LockIcon } from './icons'
import './BrandPicker.css'

export function BrandLogo({ brand }) {
  const [failed, setFailed] = useState(false)
  if (!brand.logo_url || failed) return <span className="brand-logo-text">{brand.label}</span>
  return <img className="brand-logo-img" src={brand.logo_url} alt={brand.label} onError={() => setFailed(true)} />
}

// "Your outlets" grid at the bottom of the home page. Brands the user doesn't belong to are shown locked.
export function BrandPicker({ onOpen }) {
  const { t } = useLang()
  const [brands, setBrands] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchBrands()
      .then((d) => setBrands(d.brands))
      .catch((err) => setError(err.message))
  }, [])

  return (
    <section className="brand-picker">
      <p className="section-label">{t('YOUR OUTLETS')}</p>
      {error && <p className="error-text">{t('Error: {msg}', { msg: t(error) })}</p>}
      <div className="brand-grid">
        {brands.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`brand-tile ${b.accessible ? '' : 'brand-tile--locked'}`}
            style={{ background: b.bg_color || 'var(--panel)' }}
            disabled={!b.accessible}
            onClick={() => onOpen(b)}
            aria-label={b.sub_label ? `${b.label} ${b.sub_label}` : b.label}
          >
            <BrandLogo brand={b} />
            {b.sub_label && <span className="brand-tile-sub">{b.sub_label}</span>}
            {!b.accessible && <LockIcon className="brand-tile-lock" width="14" height="14" />}
          </button>
        ))}
      </div>
    </section>
  )
}
