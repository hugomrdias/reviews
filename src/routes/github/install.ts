import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { rememberReturnTo } from '@/server/auth/flow'

// Sends people to install the GitHub App on an account, remembering the page
// to return to when GitHub calls the Setup URL (/github/installed).
export const Route = createFileRoute('/github/install')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const params = new URL(request.url).searchParams
        rememberReturnTo(params.get('returnTo') ?? '/')
        const targetId = params.get('target_id')
        const url = new URL(`https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`)
        if (targetId && /^\d+$/.test(targetId)) {
          url.pathname += '/permissions'
          url.searchParams.set('target_id', targetId)
        }
        return new Response(null, { status: 302, headers: { Location: url.toString() } })
      },
    },
  },
})
