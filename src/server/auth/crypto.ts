// Small Web Crypto helpers. Everything here runs in Workers and in Node (tests).

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlDecode(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function randomToken(byteLength = 32): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(byteLength)))
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input))
  return base64UrlEncode(new Uint8Array(digest))
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const ab = encoder.encode(a)
  const bb = encoder.encode(b)
  let diff = ab.length ^ bb.length
  const len = Math.max(ab.length, bb.length)
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0)
  return diff === 0
}

const keyCache = new Map<string, Promise<CryptoKey>>()

/**
 * Derives an AES-GCM key from the base secret. `purpose` separates keys, so a
 * value encrypted for one use can't be decrypted as another.
 */
export function deriveKey(secret: string, purpose: string): Promise<CryptoKey> {
  const cacheKey = `${purpose}:${secret}`
  let key = keyCache.get(cacheKey)
  if (!key) {
    key = (async () => {
      const base = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, [
        'deriveKey',
      ])
      return crypto.subtle.deriveKey(
        { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: encoder.encode(purpose) },
        base,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      )
    })()
    keyCache.set(cacheKey, key)
  }
  return key
}

export async function encrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext)),
  )
  const out = new Uint8Array(iv.length + ciphertext.length)
  out.set(iv)
  out.set(ciphertext, iv.length)
  return base64UrlEncode(out)
}

/** Returns null when the value was tampered with or encrypted under another key. */
export async function decrypt(key: CryptoKey, value: string): Promise<string | null> {
  try {
    const bytes = base64UrlDecode(value)
    const iv = bytes.slice(0, 12)
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, bytes.slice(12))
    return decoder.decode(plaintext)
  } catch {
    return null
  }
}
