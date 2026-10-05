import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start'

// Public pages that search engines may index; every other page sends noindex.
// The home page must stay on the list: favicon services only know a site's icon
// once its home page is crawled. Without one, claude.ai's connector list showed
// the parent domain's icon instead of ours.
const INDEXABLE = new Set(['/', '/privacy'])

const securityHeaders = createMiddleware().server(async ({ next, request }) => {
  const result = await next()
  const headers = result.response.headers
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('X-Frame-Options', 'DENY')
  if (!INDEXABLE.has(new URL(request.url).pathname)) headers.set('X-Robots-Tag', 'noindex')
  return result
})

// Rejects cross-site requests that change state (server function POSTs, sign-out).
const csrf = createCsrfMiddleware({
  filter: ({ request }) => request.method !== 'GET' && request.method !== 'HEAD',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrf, securityHeaders],
}))
