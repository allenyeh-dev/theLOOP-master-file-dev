// PBKDF2-SHA256 password hashing using the Web Crypto API (crypto.subtle),
// which is natively available in the Workers runtime with no extra bindings.
// Stored format: pbkdf2$<iterations>$<saltHex>$<hashHex>
const ITERATIONS = 100_000
const KEY_LENGTH_BITS = 256

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    KEY_LENGTH_BITS
  )
  return new Uint8Array(bits)
}

// crypto.subtle.timingSafeEqual is a non-standard extension available in the
// Workers runtime. Fall back to a manual constant-time compare so this module
// also works in plain Node.js (e.g. the demo-user seed script).
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (a: BufferSource, b: BufferSource) => boolean
  }

  if (typeof subtle.timingSafeEqual === 'function') {
    if (a.byteLength !== b.byteLength) {
      // Perform an equal-cost comparison first so a length mismatch
      // doesn't leak timing information, then report failure.
      subtle.timingSafeEqual(a, a)
      return false
    }
    return subtle.timingSafeEqual(a, b)
  }

  if (a.byteLength !== b.byteLength) return false
  let diff = 0
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await deriveBits(password, salt, ITERATIONS)
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${toHex(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false

  const [, iterationsStr, saltHex, hashHex] = parts
  const iterations = Number(iterationsStr)
  if (!Number.isInteger(iterations) || iterations <= 0) return false

  const salt = fromHex(saltHex)
  const expected = fromHex(hashHex)
  const actual = await deriveBits(password, salt, iterations)

  return constantTimeEqual(actual, expected)
}
