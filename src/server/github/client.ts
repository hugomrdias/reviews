import { AsyncLocalStorage } from 'node:async_hooks'

const API = 'https://api.github.com'

/** The REST API path of a repo, which every repo endpoint starts with. */
export function repoBase(owner: string, repo: string) {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
}

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}
/** The token is invalid, expired or revoked. */
export class AuthError extends GitHubError {}
export class NotFoundError extends GitHubError {}
export class RateLimitError extends GitHubError {
  constructor(readonly resetAt: number) {
    super('GitHub rate limit exceeded', 429)
  }
}

export interface GitHubRequestInit {
  accept?: string
  method?: string
  body?: unknown
}

/** Finds a newer token after GitHub rejected `rejected`, or returns null when there isn't one. */
export type TokenRenewer = (rejected: string) => Promise<string | null>

const renewers = new AsyncLocalStorage<TokenRenewer>()

/** Runs `fn` so that GitHub calls made inside it try `renew`'s token once when GitHub rejects theirs. */
export function withTokenRenewal<T>(renew: TokenRenewer, fn: () => Promise<T>) {
  return renewers.run(renew, fn)
}

function send(token: string, path: string, init: GitHubRequestInit) {
  return fetch(path.startsWith('https://') ? path : `${API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: init.accept ?? 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'github-reviews',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
}

export async function githubFetch(token: string, path: string, init: GitHubRequestInit = {}) {
  let res = await send(token, path, init)
  if (res.status === 401) {
    // Another request may have refreshed the token since this one read it,
    // which kills the old one. GitHub didn't act on a 401, so a retry is safe.
    const renew = renewers.getStore()
    const renewed = await renew?.(token)
    if (renewed && renewed !== token) {
      res = await send(renewed, path, init)
      // Lets the renewer drop the session if GitHub rejects its newest token too.
      if (res.status === 401) await renew?.(renewed)
    }
  }
  if (res.ok) return res
  if (res.status === 401) throw new AuthError('GitHub rejected the token', 401)
  if (
    (res.status === 403 || res.status === 429) &&
    res.headers.get('x-ratelimit-remaining') === '0'
  ) {
    throw new RateLimitError(Number(res.headers.get('x-ratelimit-reset') ?? 0) * 1000)
  }
  if (res.status === 404) throw new NotFoundError(`Not found: ${path}`, 404)
  throw new GitHubError(`GitHub ${res.status} for ${path}`, res.status)
}

export async function githubJson<T>(token: string, path: string, init?: GitHubRequestInit) {
  const res = await githubFetch(token, path, init)
  return (await res.json()) as T
}
