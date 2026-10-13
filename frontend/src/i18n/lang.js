// Language store usable outside React (api client sends it as X-Lang).
const KEY = 'loop_lang'

function initial() {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'en' || v === 'zh') return v
  } catch {
    /* storage unavailable */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

let current = initial()

export const getLang = () => current

export function storeLang(lang) {
  current = lang
  try {
    localStorage.setItem(KEY, lang)
  } catch {
    /* ignore */
  }
  document.documentElement.lang = lang === 'zh' ? 'zh-Hant' : 'en'
}
