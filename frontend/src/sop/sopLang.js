// Which language of a SOP version to show. `sop.lang` is the author's language; `content_alt` is the
// confirmed translation into the other one (may be missing).
export function localized(sop, lang) {
  if (sop.lang === lang) return { title: sop.title, content: sop.content, original: false }
  if (sop.content_alt) return { title: sop.title_alt || sop.content_alt.title || sop.title, content: sop.content_alt, original: false }
  return { title: sop.title, content: sop.content, original: true }
}

// Stable fingerprint of the translatable fields, to tell whether a translation is out of date.
export function snap(c) {
  const t = (v) => (v ?? '').trim()
  return JSON.stringify([
    t(c.title), t(c.purpose), t(c.audience), t(c.tools), t(c.mistakes),
    (c.steps ?? []).filter((s) => t(s.action) || t(s.caution)).map((s) => [t(s.action), t(s.caution)]),
  ])
}
