// Sign-in helpers shared by the server and the browser, so nothing server-only here.

// Any origin works: only whether the path leaves it matters.
const BASE = 'https://return-to.invalid'

/**
 * Only same-origin paths. URL parsing drops tabs and newlines and reads "\" as
 * "/", so "/\t/evil.com" would become "//evil.com". Reject control characters,
 * then check where the path actually resolves.
 */
export function isSafeReturnTo(value: string) {
  if (!value.startsWith('/') || /[\u0000-\u001f\u007f]/.test(value)) return false
  try {
    return new URL(value, BASE).origin === BASE
  } catch {
    return false
  }
}

/** The path when it's safe to send someone back to, otherwise the home page. */
export function safeReturnTo(value: string | null | undefined): string {
  return value && isSafeReturnTo(value) ? value : '/'
}

/** Signs in with GitHub, then comes back to `returnTo`. */
export function loginUrl(returnTo?: string) {
  return returnTo ? `/auth/login?returnTo=${encodeURIComponent(returnTo)}` : '/auth/login'
}
