import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'

// Liveness check that also proves the D1 binding and migrations are in place.
// It's public, so it doesn't say how many users there are.
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        await env.DB.prepare('SELECT 1 FROM users LIMIT 1').first()
        return Response.json({ ok: true })
      },
    },
  },
})
