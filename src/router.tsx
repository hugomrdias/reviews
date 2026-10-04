import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'

/** A session that died mid-visit: send the person back through sign-in. */
function onError(error: unknown) {
  if (typeof window === 'undefined' || window.location.pathname.startsWith('/dev/')) return
  if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
    const returnTo = window.location.pathname + window.location.search
    window.location.assign(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`)
  }
}

export function getRouter() {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      queries: {
        retry: (count, error) => count < 2 && !(error instanceof Error && /UNAUTHENTICATED|NO_ACCESS/.test(error.message)),
        refetchOnWindowFocus: false,
      },
    },
  })

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient, viewer: null, theme: 'system' },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
