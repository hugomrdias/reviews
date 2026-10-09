import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthError, githubJson, withTokenRenewal } from './client'

/** GitHub accepting only `valid`, recording the token of each call. */
function stubGitHub(valid: string) {
  const tokens: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      const token = (init.headers as Record<string, string>).Authorization.replace('Bearer ', '')
      tokens.push(token)
      return token === valid ? Response.json({ ok: true }) : new Response(null, { status: 401 })
    }),
  )
  return tokens
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('githubFetch', () => {
  it('throws AuthError on a 401 when nothing can renew the token', async () => {
    const tokens = stubGitHub('new')
    await expect(githubJson('old', '/user')).rejects.toBeInstanceOf(AuthError)
    expect(tokens).toEqual(['old'])
  })

  it('retries once with the renewed token', async () => {
    const tokens = stubGitHub('new')
    const renew = vi.fn(async () => 'new')
    await expect(withTokenRenewal(renew, () => githubJson('old', '/user'))).resolves.toEqual({ ok: true })
    expect(renew).toHaveBeenCalledWith('old')
    expect(tokens).toEqual(['old', 'new'])
  })

  it('sends the body again on the retry', async () => {
    stubGitHub('new')
    const renew = async () => 'new'
    await withTokenRenewal(renew, () => githubJson('old', '/repos/o/r/issues', { method: 'POST', body: { title: 'x' } }))
    const calls = vi.mocked(fetch).mock.calls
    expect(calls.map(([, init]) => init?.body)).toEqual(['{"title":"x"}', '{"title":"x"}'])
  })

  it('throws AuthError when there is no newer token', async () => {
    const tokens = stubGitHub('new')
    const renew = vi.fn(async () => null)
    await expect(withTokenRenewal(renew, () => githubJson('old', '/user'))).rejects.toBeInstanceOf(AuthError)
    expect(tokens).toEqual(['old'])
  })

  it('reports the renewed token too when GitHub rejects it, then gives up', async () => {
    const tokens = stubGitHub('newest')
    const renew = vi.fn(async (rejected: string) => (rejected === 'old' ? 'new' : 'newest'))
    await expect(withTokenRenewal(renew, () => githubJson('old', '/user'))).rejects.toBeInstanceOf(AuthError)
    expect(renew.mock.calls).toEqual([['old'], ['new']])
    expect(tokens).toEqual(['old', 'new'])
  })
})
