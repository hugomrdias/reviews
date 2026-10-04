const API = 'https://api.github.com'

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

export async function githubFetch(token: string, path: string, init: GitHubRequestInit = {}) {
  const res = await fetch(path.startsWith('https://') ? path : `${API}${path}`, {
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
