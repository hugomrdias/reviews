import { describe, expect, it } from 'vitest'
import { isSafeReturnTo, loginUrl, safeReturnTo } from './auth'

const APP_URL = 'https://reviews.example.com'

const unsafe = [
  '',
  'evil.com',
  'https://evil.com',
  'javascript:alert(1)',
  '//evil.com',
  '/\\evil.com',
  '\\/evil.com',
  // URL parsing drops tabs and newlines, leaving "//evil.com".
  '/\t/evil.com',
  '/\n/evil.com',
  '/\r/evil.com',
  '/\t\\evil.com',
  '\t//evil.com',
  '/\u0000/evil.com',
  '/repo\nSet-Cookie: x=1',
]

describe('isSafeReturnTo', () => {
  it('accepts same-origin paths', () => {
    expect(isSafeReturnTo('/')).toBe(true)
    expect(isSafeReturnTo('/acme/widgets/blob/main/README.md')).toBe(true)
    expect(isSafeReturnTo('/acme/widgets?path=docs%2Fapi.md#L10')).toBe(true)
    expect(isSafeReturnTo('/acme/widgets/blob/main/a%5Cb.md')).toBe(true)
  })

  it.each(unsafe)('rejects %j', (value) => {
    expect(isSafeReturnTo(value)).toBe(false)
  })

  it('rejects values decoded from an encoded tab or newline', () => {
    for (const encoded of ['%2F%09%2Fevil.com', '%2F%0A%2Fevil.com', '%2F%0D%2Fevil.com']) {
      const value = new URLSearchParams(`returnTo=${encoded}`).get('returnTo')!
      expect(isSafeReturnTo(value)).toBe(false)
    }
  })

  it('only accepts paths that stay on the app when the callback resolves them', () => {
    for (const value of [...unsafe, '/', '/acme/widgets', '/a/../b', '/./x']) {
      if (isSafeReturnTo(value)) expect(new URL(value, APP_URL).origin).toBe(APP_URL)
    }
  })
})

describe('safeReturnTo', () => {
  it('falls back to the home page', () => {
    expect(safeReturnTo(undefined)).toBe('/')
    expect(safeReturnTo(null)).toBe('/')
    expect(safeReturnTo('/\t/evil.com')).toBe('/')
    expect(safeReturnTo('/acme/widgets')).toBe('/acme/widgets')
  })
})

describe('loginUrl', () => {
  it('encodes returnTo', () => {
    expect(loginUrl()).toBe('/auth/login')
    expect(loginUrl('/acme/widgets?x=1')).toBe('/auth/login?returnTo=%2Facme%2Fwidgets%3Fx%3D1')
  })
})
