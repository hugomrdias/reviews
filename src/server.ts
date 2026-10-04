import handler from '@tanstack/react-start/server-entry'
import { routeAgentRequest, routeAppRequest } from '@/server/agents/oauth'

// The Worker's entry. The MCP endpoint and the OAuth protocol endpoints are
// answered before TanStack Start: they're bearer-token and client calls, not
// browser requests, so Start's CSRF check and pages don't apply to them.
export default {
  fetch(request, env, ctx) {
    return routeAgentRequest(request, env, ctx) ?? routeAppRequest(request, env, (request) => handler.fetch(request))
  },
} satisfies ExportedHandler<Env>
