import { env } from 'cloudflare:workers'
import { githubJson } from '../github/client'
import type { SessionUser } from './session'

export interface TokenSet {
  accessToken: string
  accessExpiresAt: number
  refreshToken: string
  refreshExpiresAt: number
}

export class OAuthError extends Error {
  constructor(readonly code: string) {
    super(`GitHub OAuth error: ${code}`)
  }
}

/** Where GitHub sends people back: browser sign-in, or `/oauth/callback` when connecting an agent. */
export function callbackUrl(path: '/auth/callback' | '/oauth/callback' = '/auth/callback') {
  return new URL(path, env.APP_URL).toString()
}

export function authorizeUrl(state: string, codeChallenge: string, redirectUri = callbackUrl()) {
  const url = new URL('https://github.com/login/oauth/authorize')
  url.searchParams.set('client_id', env.GITHUB_APP_CLIENT_ID)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

interface TokenResponse {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
  error?: string
}

async function requestToken(params: Record<string, string>): Promise<TokenSet> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'github-reviews',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_APP_CLIENT_ID,
      client_secret: env.GITHUB_APP_CLIENT_SECRET,
      ...params,
    }),
  })
  const data = (await res.json()) as TokenResponse
  if (!res.ok || data.error || !data.access_token) {
    throw new OAuthError(data.error ?? `http_${res.status}`)
  }
  const now = Date.now()
  if (!data.refresh_token || !data.expires_in) {
    // The app must have "Expire user authorization tokens" turned on.
    throw new OAuthError('token_expiration_disabled')
  }
  return {
    accessToken: data.access_token,
    accessExpiresAt: now + data.expires_in * 1000,
    refreshToken: data.refresh_token,
    refreshExpiresAt: now + (data.refresh_token_expires_in ?? 15_811_200) * 1000,
  }
}

export function exchangeCode(code: string, codeVerifier: string, redirectUri = callbackUrl()) {
  return requestToken({ code, code_verifier: codeVerifier, redirect_uri: redirectUri })
}

export function refreshTokens(refreshToken: string) {
  return requestToken({ grant_type: 'refresh_token', refresh_token: refreshToken })
}

/** Who the token belongs to on GitHub. */
export async function fetchGitHubUser(token: string): Promise<SessionUser> {
  const user = await githubJson<{ id: number; login: string; name: string | null; avatar_url: string }>(
    token,
    '/user',
  )
  return { id: user.id, login: user.login, name: user.name, avatarUrl: user.avatar_url }
}
