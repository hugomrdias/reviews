import { authorizationErrorRedirect, AuthorizationError } from '@cloudflare/workers-oauth-provider'
import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { callbackUrl, exchangeCode, fetchGitHubUser, OAuthError } from '@/server/auth/oauth'
import { upsertUser } from '@/server/auth/session'
import { errorPage } from '@/server/agents/consent'
import type { AgentProps } from '@/server/agents/grant'
import { oauthApi } from '@/server/agents/oauth'
import type { UpstreamData } from './authorize'

/** The longest name shown on comments; the client chose it. */
const MAX_CLIENT_NAME = 40

// GitHub sends the person back here after connecting an agent. Exchange the
// code for this connection's own GitHub tokens, then finish the agent's
// authorization with them in the grant.
export const Route = createFileRoute('/oauth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const oauth = oauthApi(env)
        let resumed
        try {
          resumed = await oauth.finishUpstream<UpstreamData>(request)
        } catch (error) {
          if (error instanceof AuthorizationError) return errorPage('This page expired, or was opened in another browser.')
          throw error
        }
        const { request: authRequest, data, headers } = resumed
        const params = new URL(request.url).searchParams
        const code = params.get('code')
        if (params.get('error') || !code) {
          headers.set('Location', authorizationErrorRedirect(authRequest, 'access_denied'))
          return new Response(null, { status: 302, headers })
        }

        try {
          const github = await exchangeCode(code, data.verifier, callbackUrl('/oauth/callback'))
          const user = await fetchGitHubUser(github.accessToken)
          await upsertUser(user)
          const clientName = (await oauth.describeConsent(authRequest)).clientName.trim().slice(0, MAX_CLIENT_NAME) || 'Agent'
          const props: AgentProps = { userId: user.id, login: user.login, clientName, github }
          const { redirectTo } = await oauth.completeAuthorization({
            request: authRequest,
            userId: String(user.id),
            metadata: { clientName },
            scope: authRequest.scope,
            props,
          })
          headers.set('Location', redirectTo)
          return new Response(null, { status: 302, headers })
        } catch (error) {
          // GitHub's error code (e.g. incorrect_client_credentials) says what to fix.
          console.error('Agent connection failed', error instanceof OAuthError ? error.code : error)
          headers.set('Location', authorizationErrorRedirect(authRequest, 'server_error'))
          return new Response(null, { status: 302, headers })
        }
      },
    },
  },
})
