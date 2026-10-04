import { afterEach, describe, expect, it, vi } from 'vitest'
import { canResolve } from '@/lib/threads'
import type { ActiveSession } from '../auth/session'
import { requireRepoAccess } from './access'
import { NotFoundError } from './client'

// Each test signs in as a new user, so cached answers never leak between tests.
let nextUserId = 1
function session(): ActiveSession {
  const id = nextUserId++
  return { id: `s${id}`, user: { id, login: `u${id}`, name: null, avatarUrl: null }, accessToken: 'token' }
}

const OWNER_ID = 100
const REPO_ID = 200

function repo(overrides: { private?: boolean; permissions?: Record<string, boolean> } = {}) {
  return {
    id: REPO_ID,
    name: 'docs',
    full_name: 'octo/docs',
    private: overrides.private ?? false,
    default_branch: 'main',
    owner: { login: 'octo', id: OWNER_ID },
    permissions: overrides.permissions ?? { admin: false, maintain: false, push: false, triage: false, pull: true },
  }
}

function installation(selection: 'all' | 'selected') {
  return { id: 7, account: { login: 'octo', id: OWNER_ID, type: 'Organization' }, repository_selection: selection }
}

/** Answers the repo, the user's installations and installation 7's repos. */
function stubGitHub({
  repoBody = repo(),
  installations = [] as unknown[],
  installedRepoIds = [] as number[],
}) {
  const fetch = vi.fn(async (url: string) => {
    if (url.endsWith('/repos/octo/docs')) return Response.json(repoBody)
    if (url.includes('/user/installations?')) return Response.json({ installations })
    if (url.includes('/user/installations/7/repositories')) {
      const repositories = installedRepoIds.map((id) => ({ ...repo(), id }))
      return Response.json({ total_count: repositories.length, repositories })
    }
    return new Response(null, { status: 404 })
  })
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('requireRepoAccess', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('refuses a public repo when the app is not installed on its owner', async () => {
    stubGitHub({})
    await expect(requireRepoAccess(session(), 'octo', 'docs')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('refuses a public repo that is not selected in the installation', async () => {
    stubGitHub({ installations: [installation('selected')], installedRepoIds: [999] })
    await expect(requireRepoAccess(session(), 'octo', 'docs')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('allows a public repo selected in the installation', async () => {
    stubGitHub({ installations: [installation('selected')], installedRepoIds: [REPO_ID] })
    await expect(requireRepoAccess(session(), 'octo', 'docs')).resolves.toMatchObject({ repoId: REPO_ID })
  })

  it('allows a public repo when the installation covers all repos', async () => {
    const fetch = stubGitHub({ installations: [installation('all')] })
    await expect(requireRepoAccess(session(), 'octo', 'docs')).resolves.toMatchObject({ repoId: REPO_ID })
    expect(fetch.mock.calls.some(([url]) => url.includes('/repositories'))).toBe(false)
  })

  it('skips the installation check for private repos', async () => {
    const fetch = stubGitHub({ repoBody: repo({ private: true }) })
    await expect(requireRepoAccess(session(), 'octo', 'docs')).resolves.toMatchObject({ private: true })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['read', { pull: true, triage: false, push: false, maintain: false, admin: false }, false, false],
    ['triage', { pull: true, triage: true, push: false, maintain: false, admin: false }, false, false],
    ['write', { pull: true, triage: true, push: true, maintain: false, admin: false }, true, false],
    ['maintain', { pull: true, triage: true, push: true, maintain: true, admin: false }, true, true],
    ['admin', { pull: true, triage: true, push: true, maintain: true, admin: true }, true, true],
  ])('maps the %s role to comment permissions', async (_, permissions, comment, moderate) => {
    stubGitHub({ repoBody: repo({ private: true, permissions }) })
    const access = await requireRepoAccess(session(), 'octo', 'docs')
    expect(access.permissions).toEqual({ comment, moderate })
  })
})

describe('canResolve', () => {
  it('lets commenters resolve their own threads and maintainers resolve any', () => {
    const writer = { comment: true, moderate: false }
    const maintainer = { comment: true, moderate: true }
    expect(canResolve(writer, 1, 1)).toBe(true)
    expect(canResolve(writer, 2, 1)).toBe(false)
    expect(canResolve(maintainer, 2, 1)).toBe(true)
    expect(canResolve({ comment: false, moderate: false }, 1, 1)).toBe(false)
  })
})
