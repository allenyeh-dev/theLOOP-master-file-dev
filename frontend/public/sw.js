// Minimal service worker: caches the app shell and static assets;
// API requests always go to the network (data is auth-scoped and live).
const CACHE = 'loop-shell-v2'
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return

  // Navigations: network first, fall back to cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put('/', copy))
        return res
      }).catch(() => caches.match('/')),
    )
    return
  }

  // Static assets (hashed by Vite): stale-while-revalidate.
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)) }
        return res
      }).catch(() => hit)
      return hit || net
    }),
  )
})

// Web Push: every push must surface a visible notification (iOS revokes the
// subscription otherwise), so fall back to a generic one if the payload is unreadable.
self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch { /* use defaults */ }
  e.waitUntil(Promise.all([
    self.registration.showNotification(data.title || 'THE LOOP', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    }),
    // Open app windows refresh their "needs acknowledgement" sheet right away.
    self.clients.matchAll({ type: 'window' }).then((wins) => wins.forEach((w) => w.postMessage({ type: 'push' }))),
  ]))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const target = new URL(e.notification.data?.url || '/', self.location.origin).href
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => w.url.startsWith(self.location.origin))
      if (open) return open.focus()
      return self.clients.openWindow(target)
    }),
  )
})
