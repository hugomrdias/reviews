import { env } from 'cloudflare:workers'
import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'
import { safeReturnTo } from '@/lib/auth'
import { cookieOptions } from './session'
import { decrypt, deriveKey, encrypt, randomToken, safeEqual, sha256Base64Url } from './crypto'

const OAUTH_COOKIE = 'oauth'
const RETURN_COOKIE = 'return_to'

interface OAuthState {
  state: string
  verifier: string
  returnTo: string
}

function stateKey() {
  return deriveKey(env.SESSION_SECRET, 'oauth-state')
}

/** Starts a sign-in: remembers state + PKCE verifier, returns the challenge. */
export async function beginOAuth(returnTo: string) {
  const value: OAuthState = { state: randomToken(), verifier: randomToken(48), returnTo: safeReturnTo(returnTo) }
  setCookie(OAUTH_COOKIE, await encrypt(await stateKey(), JSON.stringify(value)), cookieOptions(600))
  return { state: value.state, challenge: await sha256Base64Url(value.verifier) }
}

/** Checks the callback's state against the cookie. Single use. */
export async function finishOAuth(state: string | null): Promise<OAuthState | null> {
  const raw = getCookie(OAUTH_COOKIE)
  deleteCookie(OAUTH_COOKIE, { path: '/' })
  if (!raw || !state) return null
  const json = await decrypt(await stateKey(), raw)
  if (!json) return null
  const saved = JSON.parse(json) as OAuthState
  return safeEqual(saved.state, state) ? saved : null
}

/** Where to send someone after they install the app on GitHub. */
export function rememberReturnTo(path: string) {
  setCookie(RETURN_COOKIE, safeReturnTo(path), cookieOptions(3600))
}

export function takeReturnTo() {
  const value = safeReturnTo(getCookie(RETURN_COOKIE))
  deleteCookie(RETURN_COOKIE, { path: '/' })
  return value
}
