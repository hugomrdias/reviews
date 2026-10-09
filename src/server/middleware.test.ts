import { afterEach, describe, expect, it, vi } from 'vitest'
import { CodedError } from '@/lib/errors'
import type { ActiveSession } from './auth/session'
import type { RepoAccess } from './github/access'
import { AuthError, githubJson } from './github/client'
import { authMiddleware, commentableRepoMiddleware, repoMiddleware } from './middleware'

const sessions = vi.hoisted(() => ({ loadSession: vi.fn(), renewAccessToken: vi.fn() }))
vi.mock('./auth/session', () => sessions)

// Each test signs in as a new user, so cached access checks never leak between tests.
let nextUserId = 1
function session(): ActiveSession {
  const id = nextUserId++
  return { id: `s${id}`, user: { id, login: `u${id}`, name: null, avatarUrl: null }, accessToken: 'token' }
}

/** Calls a middleware's server step the way Start does, with `next` recording the context it passes on. */
async function runServer(middleware: { options: object }, input: { data?: unknown; context?: object }) {
  const next = vi.fn(async (passed?: { context?: object }) => passed?.context ?? {})
  const server = (middleware.options as { server: (ctx: object) => Promise<unknown> }).server
  await server({ data: input.data, context: input.context ?? {}, next })
  return next
}

/** GitHub with octo/docs as a public repo, installed only when `installed` is set. */
function stubGitHub({ installed }: { installed: boolean }) {
  const repo = {
    id: 200,
    name: 'docs',
    full_name: 'octo/docs',
    private: false,
    default_branch: 'main',
    owner: { login: 'octo', id: 100 },
    permissions: { admin: false, push: false, pull: true },
  }
  const account = { login: 'octo', id: 100, type: 'Organization' }
  const installations = installed ? [{ id: 7, account, repository_selection: 'all' }] : []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.endsWith('/repos/octo/docs')) return Response.json(repo)
      if (url.includes('/user/installations?')) return Response.json({ installations })
      return new Response(null, { status: 404 })
    }),
  )
}

const access = (comment: boolean) => ({ permissions: { comment, moderate: false } }) as RepoAccess

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('authMiddleware', () => {
  it('throws UNAUTHENTICATED without a session', async () => {
    sessions.loadSession.mockResolvedValue(null)
    await expect(runServer(authMiddleware, {})).rejects.toEqual(new CodedError('UNAUTHENTICATED'))
  })

  it('throws UNAUTHENTICATED when GitHub rejects the token', async () => {
    sessions.loadSession.mockResolvedValue(session())
    const server = (authMiddleware.options as { server: (ctx: object) => Promise<unknown> }).server
    const next = async () => {
      throw new AuthError('GitHub rejected the token', 401)
    }
    await expect(server({ context: {}, next })).rejects.toEqual(new CodedError('UNAUTHENTICATED'))
  })

  it('retries GitHub calls with a token another request refreshed', async () => {
    const active = session()
    sessions.loadSession.mockResolvedValue(active)
    sessions.renewAccessToken.mockResolvedValue('refreshed')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        const auth = (init.headers as Record<string, string>).Authorization
        return auth === 'Bearer refreshed' ? Response.json({ login: 'u' }) : new Response(null, { status: 401 })
      }),
    )
    const server = (authMiddleware.options as { server: (ctx: object) => Promise<unknown> }).server
    const next = async () => ({ result: await githubJson(active.accessToken, '/user') })
    await expect(server({ context: {}, next })).resolves.toEqual({ result: { login: 'u' } })
    expect(sessions.renewAccessToken).toHaveBeenCalledWith(active, 'token')
  })
})

describe('repoMiddleware', () => {
  const validator = (repoMiddleware.options as { inputValidator: { parse: (input: unknown) => unknown } }).inputValidator

  it('validates the repo and leaves the rest for the server function', () => {
    expect(validator.parse({ owner: 'octo', repo: 'docs', path: 'README.md' })).toEqual({
      owner: 'octo',
      repo: 'docs',
      path: 'README.md',
    })
    expect(() => validator.parse({ owner: 'octo', repo: '../docs' })).toThrow()
  })

  it('passes the access on', async () => {
    stubGitHub({ installed: true })
    const next = await runServer(repoMiddleware, { data: { owner: 'octo', repo: 'docs' }, context: { session: session() } })
    expect(next).toHaveBeenCalledWith({ context: { access: expect.objectContaining({ repoId: 200, fullName: 'octo/docs' }) } })
  })

  it('throws NO_ACCESS for a repo the user cannot read', async () => {
    stubGitHub({ installed: false })
    const result = runServer(repoMiddleware, { data: { owner: 'octo', repo: 'docs' }, context: { session: session() } })
    await expect(result).rejects.toEqual(new CodedError('NO_ACCESS'))
  })
})

describe('commentableRepoMiddleware', () => {
  it('lets commenters through', async () => {
    const next = await runServer(commentableRepoMiddleware, { context: { access: access(true) } })
    expect(next).toHaveBeenCalled()
  })

  it('throws NO_WRITE_ACCESS for readers', async () => {
    const result = runServer(commentableRepoMiddleware, { context: { access: access(false) } })
    await expect(result).rejects.toEqual(new CodedError('NO_WRITE_ACCESS'))
  })
})
