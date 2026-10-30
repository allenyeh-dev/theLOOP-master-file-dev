// Which language of a SOP version to show. `sop.lang` is the author's language; `content_alt` is the
// confirmed translation into the other one (may be missing).
export function localized(sop, lang) {
  if (sop.lang === lang) return { title: sop.title, content: sop.content, original: false }
  if (sop.content_alt) return { title: sop.title_alt || sop.content_alt.title || sop.title, content: sop.content_alt, original: false }
  return { title: sop.title, content: sop.content, original: true }
}

// Title only, for rows that carry just the title columns (lists, flags, read receipts).
export function localizedTitle(row, lang) {
  if (row.lang === lang) return row.title
  return row.title_alt || row.content_alt?.title || row.title
}

// Stable fingerprint of the translatable fields, to tell whether a translation is out of date.
export function snap(c) {
  const t = (v) => (v ?? '').trim()
  return JSON.stringify([
    t(c.title), t(c.purpose), t(c.audience), t(c.tools), t(c.mistakes), t(c.notes),
    (c.standards ?? []).map(t).filter(Boolean),
    (c.steps ?? []).filter((s) => t(s.action) || t(s.caution)).map((s) => [t(s.action), t(s.caution)]),
  ])
}
