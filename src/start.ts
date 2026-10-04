import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start'

const securityHeaders = createMiddleware().server(async ({ next }) => {
  const result = await next()
  const headers = result.response.headers
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-Robots-Tag', 'noindex')
  return result
})

// Rejects cross-site requests that change state (server function POSTs, sign-out).
const csrf = createCsrfMiddleware({
  filter: ({ request }) => request.method !== 'GET' && request.method !== 'HEAD',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrf, securityHeaders],
}))
