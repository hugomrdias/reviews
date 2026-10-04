import { createFileRoute } from '@tanstack/react-router'
import { authorizeUrl } from '@/server/auth/oauth'
import { beginOAuth } from '@/server/auth/flow'

export const Route = createFileRoute('/auth/login')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const returnTo = new URL(request.url).searchParams.get('returnTo') ?? '/'
        const { state, challenge } = await beginOAuth(returnTo)
        return new Response(null, { status: 302, headers: { Location: authorizeUrl(state, challenge) } })
      },
    },
  },
})
