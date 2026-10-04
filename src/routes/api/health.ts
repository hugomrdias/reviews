import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'

// Liveness check that also proves the D1 binding and migrations are in place.
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: async () => {
        const row = await env.DB.prepare('SELECT count(*) AS users FROM users').first<{ users: number }>()
        return Response.json({ ok: true, users: row?.users ?? 0 })
      },
    },
  },
})
