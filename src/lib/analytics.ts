/**
 * Umami's before-send hook, for every event it sends (page views, performance).
 * File pages live at /$owner/$repo/$, and repos are often private, so their
 * URLs and titles ("README.md in owner/repo") leave the browser as
 * /:owner/:repo and "File". Same-origin referrers get the same treatment.
 *
 * The page gets this function's source, so it can't use anything outside its own body.
 */
export function redactAnalytics(_type: string, payload: Record<string, unknown>) {
  // The first path segment of every page in src/routes besides /$owner/$repo. Anything else is a file page.
  const sections = ['', 'privacy', 'auth', 'oauth', 'github', 'dev']
  const redact = (value: unknown) => {
    if (typeof value !== 'string' || !URL.canParse(value, location.origin)) return value
    const url = new URL(value, location.origin)
    if (url.origin !== location.origin || sections.includes(url.pathname.split('/')[1])) return value
    // Umami sends the page URL in full and same-origin referrers as a path. Keep each form.
    return value.startsWith('/') ? '/:owner/:repo' : `${url.origin}/:owner/:repo`
  }
  const url = redact(payload.url)
  const title = url === payload.url ? payload.title : 'File'
  return { ...payload, url, title, referrer: redact(payload.referrer) }
}

/** Defines the hook named by the Umami script's data-before-send. */
export const analyticsScript = `window.umamiBeforeSend=${redactAnalytics.toString()}`
