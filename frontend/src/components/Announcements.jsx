import { useEffect, useState } from 'react'
import { fetchAnnouncements } from '../api/data'
import './Announcements.css'

function formatDate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function Announcements() {
  const [announcements, setAnnouncements] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnnouncements()
      .then((data) => setAnnouncements(data.announcements))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="announcements">
      <p className="section-label">ANNOUNCEMENTS</p>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error-text">Error: {error}</p>}

      <div className="announcement-list">
        {announcements.map((a) => (
          <article key={a.id} className={`announcement-card accent-${a.accent}`}>
            <div className="announcement-tags">
              {a.tags.map((tag) => (
                <span key={tag.label} className={`tag tag-${tag.variant}`}>
                  {tag.label}
                </span>
              ))}
            </div>
            <h3>{a.title}</h3>
            <p className="announcement-body">{a.body}</p>
            <p className="announcement-footer">
              {a.posted_by} · {formatDate(a.posted_at)}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
