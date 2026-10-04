import { AuthorizationError, CimdFetchError } from '@cloudflare/workers-oauth-provider'
import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { randomToken, sha256Base64Url } from '@/server/auth/crypto'
import { authorizeUrl, callbackUrl } from '@/server/auth/oauth'
import { consentPage, errorPage } from '@/server/agents/consent'
import { oauthApi } from '@/server/agents/oauth'

/** Saved with the GitHub round trip and handed back at /oauth/callback. */
export interface UpstreamData {
  verifier: string
}

/** Validation failures are shown here; only a validated client gets redirected to. */
function failed(error: unknown) {
  if (error instanceof AuthorizationError && error.redirectTo) return Response.redirect(error.redirectTo, 302)
  if (error instanceof AuthorizationError) return errorPage(error.description ?? 'The request was invalid or has expired.')
  if (error instanceof CimdFetchError) return errorPage('This app couldn’t be verified: its metadata document didn’t load.')
  throw error
}

// An agent asks to connect: ask the person, then send them through GitHub,
// which tells us who they are and gives this connection its own token.
export const Route = createFileRoute('/oauth/authorize')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const oauth = oauthApi(env)
          const authRequest = await oauth.parseAuthRequest(request)
          // Describe first: a failed client lookup then leaves nothing in KV.
          const details = await oauth.describeConsent(authRequest)
          const consent = await oauth.beginConsent(authRequest)
          consent.headers.set('Content-Type', 'text/html; charset=utf-8')
          consent.headers.set('Cache-Control', 'no-store')
          return new Response(consentPage(details, consent.handle), { headers: consent.headers })
        } catch (error) {
          return failed(error)
        }
      },
      POST: async ({ request }) => {
        try {
          const oauth = oauthApi(env)
          const form = await request.formData()
          const handle = String(form.get('handle') ?? '')
          if (form.get('decision') !== 'approve') {
            const denied = await oauth.denyConsent(request, handle)
            denied.headers.set('Location', denied.redirectTo)
            return new Response(null, { status: 302, headers: denied.headers })
          }
          const approved = await oauth.approveConsent(request, handle, { scope: form.getAll('scope').map(String) })
          const verifier = randomToken(48)
          const { state, headers } = await oauth.beginUpstream(approved.request, {
            data: { verifier } satisfies UpstreamData,
            headers: approved.headers,
          })
          headers.set('Location', authorizeUrl(state, await sha256Base64Url(verifier), callbackUrl('/oauth/callback')))
          return new Response(null, { status: 302, headers })
        } catch (error) {
          return failed(error)
        }
      },
    },
  },
})
