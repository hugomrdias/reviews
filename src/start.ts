import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start'

const securityHeaders = createMiddleware().server(async ({ next, request }) => {
  const result = await next()
  const headers = result.response.headers
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('X-Frame-Options', 'DENY')
  // The home page stays indexable: favicon services only know a site's icon once
  // its home page is crawled. Without one, claude.ai's connector list showed the
  // parent domain's icon instead of ours.
  if (new URL(request.url).pathname !== '/') headers.set('X-Robots-Tag', 'noindex')
  return result
})

// Rejects cross-site requests that change state (server function POSTs, sign-out).
const csrf = createCsrfMiddleware({
  filter: ({ request }) => request.method !== 'GET' && request.method !== 'HEAD',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrf, securityHeaders],
}))
