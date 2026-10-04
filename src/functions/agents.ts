import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { z } from 'zod'
import { mcpUrl, oauthApi } from '@/server/agents/oauth'
import { authMiddleware } from '@/server/middleware'

export interface ConnectedAgent {
  grantId: string
  name: string
  /** Milliseconds since the epoch. */
  connectedAt: number
  canWrite: boolean
}

/** The agents the signed-in person has connected, and the address to connect more. */
export const listConnectedAgents = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { session } }) => {
    const { items } = await oauthApi(env).listUserGrants(String(session.user.id), { limit: 100 })
    const agents: ConnectedAgent[] = items
      .map((grant) => ({
        grantId: grant.id,
        name: typeof grant.metadata?.clientName === 'string' ? grant.metadata.clientName : grant.clientId,
        // The library counts in seconds.
        connectedAt: grant.createdAt * 1000,
        canWrite: grant.scope.includes('reviews:write'),
      }))
      .sort((a, b) => b.connectedAt - a.connectedAt)
    return { agents, mcpUrl: mcpUrl(env.APP_URL) }
  })

/** Revokes a connection and its tokens. The agent has to connect again to come back. */
export const disconnectAgent = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ grantId: z.string().min(1).max(200) }))
  .handler(async ({ data, context: { session } }) => {
    // revokeGrant only finds grants under this user, so nobody can revoke someone else's.
    await oauthApi(env).revokeGrant(data.grantId, String(session.user.id))
  })
