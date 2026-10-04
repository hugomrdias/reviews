import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { finishOAuth } from '@/server/auth/flow'
import { exchangeCode, OAuthError } from '@/server/auth/oauth'
import { createSession } from '@/server/auth/session'
import { githubJson } from '@/server/github/client'

function redirect(path: string) {
  return new Response(null, { status: 302, headers: { Location: new URL(path, env.APP_URL).toString() } })
}

export const Route = createFileRoute('/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams
        const saved = await finishOAuth(params.get('state'))
        // "Cancel" on GitHub's consent screen. Keep where they were going so
        // they can try again in one click.
        if (params.get('error') === 'access_denied') {
          const back = saved && saved.returnTo !== '/' ? `&returnTo=${encodeURIComponent(saved.returnTo)}` : ''
          return redirect(`/?signin=cancelled${back}`)
        }
        const code = params.get('code')
        if (!saved || !code) return redirect('/?signin=expired')

        try {
          const tokens = await exchangeCode(code, saved.verifier)
          const user = await githubJson<{ id: number; login: string; name: string | null; avatar_url: string }>(
            tokens.accessToken,
            '/user',
          )
          await createSession({ id: user.id, login: user.login, name: user.name, avatarUrl: user.avatar_url }, tokens)
          return redirect(saved.returnTo)
        } catch (error) {
          // GitHub's error code (e.g. incorrect_client_credentials) says what to fix.
          console.error('Sign-in failed', error instanceof OAuthError ? error.code : error)
          return redirect('/?signin=failed')
        }
      },
    },
  },
})
