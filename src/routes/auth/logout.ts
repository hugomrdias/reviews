import { createFileRoute } from '@tanstack/react-router'
import { destroySession } from '@/server/auth/session'

// POST only, so a cross-site link or image can't sign people out.
export const Route = createFileRoute('/auth/logout')({
  server: {
    handlers: {
      POST: async () => {
        await destroySession()
        return new Response(null, { status: 303, headers: { Location: '/' } })
      },
    },
  },
})
