import { afterEach, describe, expect, it, vi } from 'vitest'
import { GitHubError, NotFoundError } from './client'
import { pickLongestRef, resolveLocation, splitRefPath } from './refs'

describe('pickLongestRef', () => {
  it('prefers the longest branch that matches whole segments', () => {
    const refs = ['feature', 'feature/auth', 'featureful']
    expect(pickLongestRef('feature/auth/docs/a.md', refs)).toBe('feature/auth')
    expect(pickLongestRef('feature/docs/a.md', refs)).toBe('feature')
    expect(pickLongestRef('feature', refs)).toBe('feature')
  })

  it('does not match partial segments', () => {
    expect(pickLongestRef('featureful-x/a.md', ['featureful'])).toBeNull()
  })
})

describe('splitRefPath', () => {
  it('splits the path after the ref', () => {
    expect(splitRefPath('feature/auth/docs/a.md', 'feature/auth')).toBe('docs/a.md')
    expect(splitRefPath('main', 'main')).toBe('')
  })
})

describe('resolveLocation', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Answers matching-refs with no refs and the commits API with `commits`. */
  function stubGitHub(commits: () => Response, matchingRefs = () => Response.json([])) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (url.includes('/git/matching-refs/') ? matchingRefs() : commits())),
    )
  }

  it('treats a 422 from the commits API as an unknown ref', async () => {
    stubGitHub(() => Response.json({ message: 'No commit found for SHA: AGENTS.md' }, { status: 422 }))
    const result = resolveLocation('token', 'octo', 'unknown-ref', 'AGENTS.md', 'main')
    await expect(result).rejects.toBeInstanceOf(NotFoundError)
    await expect(result).rejects.toThrow('Unknown ref: AGENTS.md')
  })

  it('resolves refs the commits API accepts, such as a short SHA', async () => {
    stubGitHub(() => new Response('a'.repeat(40)))
    await expect(resolveLocation('token', 'octo', 'short-sha', 'abc1234/docs/a.md', 'main')).resolves.toEqual({
      ref: 'abc1234',
      sha: 'a'.repeat(40),
      path: 'docs/a.md',
    })
  })

  it('looks a branch up once for every file on it', async () => {
    const sha = 'b'.repeat(40)
    stubGitHub(
      () => new Response(sha),
      () => Response.json([{ ref: 'refs/heads/main', object: { sha, type: 'commit' } }]),
    )
    await expect(resolveLocation('token', 'octo', 'shared-branch', 'main/a.md', 'main')).resolves.toEqual({
      ref: 'main',
      sha,
      path: 'a.md',
    })
    await expect(resolveLocation('token', 'octo', 'shared-branch', 'main/docs/b.md', 'main')).resolves.toEqual({
      ref: 'main',
      sha,
      path: 'docs/b.md',
    })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("resolves the root from HEAD without waiting for the default branch's name", async () => {
    const sha = 'c'.repeat(40)
    stubGitHub(() => new Response(sha))
    let name!: (branch: string) => void
    const defaultBranch = new Promise<string>((resolve) => (name = resolve))
    const result = resolveLocation('token', 'octo', 'root', '', defaultBranch)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/commits/HEAD'), expect.anything()))
    name('trunk')
    await expect(result).resolves.toEqual({ ref: 'trunk', sha, path: '' })
  })

  it('does not hide 422s from other endpoints', async () => {
    stubGitHub(
      () => new Response('a'.repeat(40)),
      () => Response.json({ message: 'Validation Failed' }, { status: 422 }),
    )
    const result = resolveLocation('token', 'octo', 'other-422', 'main/a.md', 'main')
    await expect(result).rejects.toBeInstanceOf(GitHubError)
    await expect(result).rejects.not.toBeInstanceOf(NotFoundError)
  })
})
