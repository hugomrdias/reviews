import { env } from 'cloudflare:workers'

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

export function callbackUrl() {
  return new URL('/auth/callback', env.APP_URL).toString()
}

export function authorizeUrl(state: string, codeChallenge: string) {
  const url = new URL('https://github.com/login/oauth/authorize')
  url.searchParams.set('client_id', env.GITHUB_APP_CLIENT_ID)
  url.searchParams.set('redirect_uri', callbackUrl())
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

export function exchangeCode(code: string, codeVerifier: string) {
  return requestToken({ code, code_verifier: codeVerifier, redirect_uri: callbackUrl() })
}

export function refreshTokens(refreshToken: string) {
  return requestToken({ grant_type: 'refresh_token', refresh_token: refreshToken })
}
