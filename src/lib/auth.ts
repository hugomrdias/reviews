// Sign-in helpers shared by the server and the browser, so nothing server-only here.

/** Only same-origin paths. Blocks "//evil.com" and "/\evil.com". */
export function isSafeReturnTo(value: string) {
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
}

/** The path when it's safe to send someone back to, otherwise the home page. */
export function safeReturnTo(value: string | null | undefined): string {
  return value && isSafeReturnTo(value) ? value : '/'
}

/** Signs in with GitHub, then comes back to `returnTo`. */
export function loginUrl(returnTo?: string) {
  return returnTo ? `/auth/login?returnTo=${encodeURIComponent(returnTo)}` : '/auth/login'
}
