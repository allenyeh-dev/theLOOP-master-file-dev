import { getLang } from '../i18n/lang'

export async function request(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Lang': getLang(), ...options.headers },
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `Request failed: ${res.status}`)
  }
  return data
}
