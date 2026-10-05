// @vitest-environment happy-dom
// @vitest-environment-options { "url": "https://reviews.hugodias.me/" }
import { describe, expect, it } from 'vitest'
import { analyticsScript, redactAnalytics } from './analytics'

const origin = 'https://reviews.hugodias.me'

describe('redactAnalytics', () => {
  it('redacts file pages', () => {
    const payload = {
      website: 'id',
      url: `${origin}/acme/secret-repo/docs/plan.md`,
      title: 'plan.md in acme/secret-repo',
      referrer: '/acme/secret-repo',
    }
    expect(redactAnalytics('event', payload)).toEqual({
      website: 'id',
      url: `${origin}/:owner/:repo`,
      title: 'File',
      referrer: '/:owner/:repo',
    })
  })

  it("keeps the app's own pages", () => {
    const payload = { url: `${origin}/`, title: 'Reviews', referrer: '/github/installed' }
    expect(redactAnalytics('event', payload)).toEqual(payload)
    expect(redactAnalytics('event', { url: `${origin}/privacy` }).url).toBe(`${origin}/privacy`)
    expect(redactAnalytics('event', { url: `${origin}/auth/login` }).url).toBe(`${origin}/auth/login`)
  })

  it('keeps external referrers and missing fields', () => {
    const payload = { url: `${origin}/acme/repo`, title: 'repo in acme/repo', referrer: 'https://github.com/' }
    expect(redactAnalytics('performance', payload)).toMatchObject({ referrer: 'https://github.com/' })
    expect(redactAnalytics('event', { url: `${origin}/` })).toEqual({ url: `${origin}/`, title: undefined, referrer: undefined })
  })

  it('works from its serialized source', () => {
    const define = new Function('window', analyticsScript)
    const target: { umamiBeforeSend?: typeof redactAnalytics } = {}
    define(target)
    expect(target.umamiBeforeSend?.('event', { url: `${origin}/acme/repo/README.md` })).toMatchObject({
      url: `${origin}/:owner/:repo`,
      title: 'File',
    })
  })
})
