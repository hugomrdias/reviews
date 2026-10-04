import { createFileRoute } from '@tanstack/react-router'
import { takeReturnTo } from '@/server/auth/flow'
import { loadSession } from '@/server/auth/session'
import { forgetInstallations } from '@/server/github/access'

// The GitHub App's Setup URL. GitHub sends people here after they install or
// change the app: forget their cached installations so new repositories show
// up, then take them back to the page that asked them to install.
export const Route = createFileRoute('/github/installed')({
  server: {
    handlers: {
      GET: async () => {
        const session = await loadSession()
        if (session) await forgetInstallations(session.user.id)
        return new Response(null, { status: 302, headers: { Location: takeReturnTo() } })
      },
    },
  },
})
