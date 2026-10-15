import { request } from '../api/client'
import { getLang } from '../i18n/lang'

const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) })

const urlBase64ToUint8Array = (s) => {
  const raw = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

// 'unsupported' | 'needs-install' (iOS Safari tab) | 'denied' | 'off' | 'on'
export async function getPushState() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported'
  }
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

function subscriptionBody(sub) {
  const json = sub.toJSON()
  return { endpoint: json.endpoint, keys: json.keys, lang: getLang() }
}

// Must be called from a user gesture (iOS requires it for the permission prompt).
export async function enablePush() {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return getPushState()

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const { publicKey } = await request('/api/push/public-key')
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
  }
  await post('/api/push/subscribe', subscriptionBody(sub))
  return 'on'
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await post('/api/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {})
    await sub.unsubscribe()
  }
  return getPushState()
}

// Re-registers this device for the signed-in user (also refreshes the language).
// Silent: never prompts, so it is safe to run on every app start.
export async function syncPush() {
  try {
    if ((await getPushState()) !== 'on') return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) await post('/api/push/subscribe', subscriptionBody(sub))
  } catch { /* best effort */ }
}

// On sign-out: stop this device receiving the previous user's pushes, but keep the
// browser subscription so the next sign-in can re-attach it via syncPush().
export async function detachPush() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) await post('/api/push/unsubscribe', { endpoint: sub.endpoint })
  } catch { /* best effort */ }
}
