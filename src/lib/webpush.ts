// Web Push (RFC 8030) with VAPID (RFC 8292) and aes128gcm payload encryption (RFC 8291),
// implemented on WebCrypto so it runs on Workers without Node-only dependencies.

export type PushEnv = { VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string }
export type PushSubscriptionRow = { endpoint: string; p256dh: string; auth: string }

const enc = new TextEncoder()

export const b64uDecode = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '='))
  return Uint8Array.from(b, (ch) => ch.charCodeAt(0))
}
export const b64uEncode = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) (out.set(p, o), (o += p.length))
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8))
}

export async function encryptPayload(sub: PushSubscriptionRow, plaintext: Uint8Array) {
  const uaPublic = b64uDecode(sub.p256dh)
  const authSecret = b64uDecode(sub.auth)

  const as = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair
  const asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', as.publicKey)) as ArrayBuffer)
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as any, as.privateKey, 256))

  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // 0x02 = final-record padding delimiter.
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aes, concat(plaintext, new Uint8Array([2]))))

  const header = new Uint8Array(21)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = asPublic.length
  return concat(header, asPublic, cipher)
}

async function vapidHeader(env: PushEnv, endpoint: string) {
  const pub = b64uDecode(env.VAPID_PUBLIC_KEY!)
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: env.VAPID_PRIVATE_KEY!, x: b64uEncode(pub.slice(1, 33)), y: b64uEncode(pub.slice(33, 65)) },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
  const head = b64uEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64uEncode(
    enc.encode(JSON.stringify({
      aud: new URL(endpoint).origin,
      exp: Math.floor(Date.now() / 1000) + 12 * 3600,
      sub: env.VAPID_SUBJECT || 'mailto:admin@theloop.dev',
    }))
  )
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${claims}`))
  return `vapid t=${head}.${claims}.${b64uEncode(sig)}, k=${env.VAPID_PUBLIC_KEY}`
}

export const pushConfigured = (env: PushEnv) => Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)

export type PushResult = 'sent' | 'gone' | 'failed'

// 'gone' (404/410) means the subscription is dead and should be deleted.
export async function sendPush(env: PushEnv, sub: PushSubscriptionRow, payload: unknown): Promise<PushResult> {
  try {
    const body = await encryptPayload(sub, enc.encode(JSON.stringify(payload)))
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidHeader(env, sub.endpoint),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
        // High urgency wakes the device so it shows on the lock screen immediately.
        Urgency: 'high',
      },
      body,
    })
    if (res.ok) return 'sent'
    return res.status === 404 || res.status === 410 ? 'gone' : 'failed'
  } catch {
    return 'failed'
  }
}
