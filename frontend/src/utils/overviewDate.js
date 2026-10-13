const locale = (lang) => (lang === 'zh' ? 'zh-TW' : 'en-US')

export function dashDateLong(offsetDays, lang = 'en') {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString(locale(lang), { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
}

export function dashDateShort(offsetDays, lang = 'en') {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return d.toLocaleDateString(locale(lang), { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

// Returns a source-text key; callers pass it through t().
export function greetingForNow() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}
