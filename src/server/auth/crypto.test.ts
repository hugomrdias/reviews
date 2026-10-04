import { describe, expect, it } from 'vitest'
import { base64UrlDecode, base64UrlEncode, decrypt, deriveKey, encrypt, safeEqual } from './crypto'

const secret = 'test-secret-that-is-long-enough-1234567890'

describe('encrypt / decrypt', () => {
  it('round-trips', async () => {
    const key = await deriveKey(secret, 'session-tokens')
    const sealed = await encrypt(key, 'ghu_token')
    expect(sealed).not.toContain('ghu_token')
    expect(await decrypt(key, sealed)).toBe('ghu_token')
  })

  it('rejects tampered values', async () => {
    const key = await deriveKey(secret, 'session-tokens')
    const sealed = await encrypt(key, 'ghu_token')
    const bytes = base64UrlDecode(sealed)
    bytes[bytes.length - 1] ^= 1
    expect(await decrypt(key, base64UrlEncode(bytes))).toBeNull()
  })

  it('keeps purposes apart', async () => {
    const tokens = await deriveKey(secret, 'session-tokens')
    const oauth = await deriveKey(secret, 'oauth-state')
    expect(await decrypt(oauth, await encrypt(tokens, 'x'))).toBeNull()
  })
})

describe('safeEqual', () => {
  it('compares strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
  })
})
