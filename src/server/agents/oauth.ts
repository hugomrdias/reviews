import { OAuthAuthorizationServer, OAuthError, OAuthResourceServer } from '@cloudflare/workers-oauth-provider'
import { OAuthError as GitHubOAuthError, refreshTokens } from '../auth/oauth'
import { READ, SCOPES, type AgentProps } from './grant'
import { agentGuide, prefersMarkdown } from './guide'
import { mcpHandler } from './mcp'

// Agents connect over MCP and sign in with OAuth 2.1. This Worker is their
// authorization server, with GitHub behind it as the identity step, and the
// MCP endpoint is its one protected resource. See docs/design/mcp-server.md.

/** GitHub user tokens last 8 hours and MCP access tokens 1 hour, so refresh GitHub's with a margin. */
const ACCESS_TOKEN_TTL = 60 * 60
const GITHUB_REFRESH_MARGIN_MS = (ACCESS_TOKEN_TTL + 5 * 60) * 1000
/** An agent in use stays connected; one left alone for a month signs in again. */
const IDLE_TTL = 30 * 24 * 60 * 60

export const AUTHORIZE_PATH = '/oauth/authorize'
const TOKEN_PATH = '/oauth/token'
const REGISTER_PATH = '/oauth/register'
export const MCP_PATH = '/mcp'
const GUIDE_PATH = '/llms.txt'

export function mcpUrl(appUrl: string) {
  return new URL(MCP_PATH, appUrl).toString()
}

/** The issuer is the app's origin, which differs per Preview, so servers are built per APP_URL. */
const servers = new Map<string, { auth: OAuthAuthorizationServer<Env>; mcp: OAuthResourceServer<Env, AgentProps> }>()

function serversFor(env: Env) {
  const issuer = new URL(env.APP_URL).origin
  let found = servers.get(issuer)
  if (!found) {
    const resource = mcpUrl(issuer)
    const auth = new OAuthAuthorizationServer<Env>({
      issuer,
      resources: [resource],
      authorizeEndpoint: AUTHORIZE_PATH,
      tokenEndpoint: TOKEN_PATH,
      clientRegistrationEndpoint: REGISTER_PATH,
      clientIdMetadataDocumentEnabled: true,
      scopesSupported: [...SCOPES, 'offline_access'],
      accessTokenTTL: ACCESS_TOKEN_TTL,
      refreshTokenIdleTTL: IDLE_TTL,
      tokenExchangeCallback: refreshGitHub,
    })
    const mcp = new OAuthResourceServer<Env, AgentProps>({
      resourceMetadata: { resource, authorization_servers: [issuer], resource_name: 'Reviews' },
      requiredScopes: [READ],
      validateToken: (env) => (resource, token) => auth.validateToken<AgentProps>(resource, token, env),
      handler: mcpHandler,
    })
    found = { auth, mcp }
    servers.set(issuer, found)
  }
  return found
}

/** OAuth helpers for our own routes: the consent page, the GitHub callback, Connected agents. */
export function oauthApi(env: Env) {
  return serversFor(env).auth.getOAuthApi(env)
}

/**
 * Keeps the agent's GitHub token outliving its MCP token. GitHub rotates
 * refresh tokens on use, and only this grant holds this pair, so there's no
 * race with browser sessions.
 */
async function refreshGitHub({ grantType, props }: { grantType: string; props: AgentProps }) {
  if (grantType !== 'refresh_token') return
  if (props.github.accessExpiresAt - Date.now() > GITHUB_REFRESH_MARGIN_MS) return
  try {
    const github = await refreshTokens(props.github.refreshToken)
    return { newProps: { ...props, github } satisfies AgentProps }
  } catch (error) {
    if (error instanceof GitHubOAuthError && error.code === 'bad_refresh_token') {
      // Revoked on GitHub, or expired: this grant can never work again.
      throw new OAuthError('invalid_grant', { description: 'GitHub access was revoked. Connect again.' })
    }
    throw new OAuthError('temporarily_unavailable', { description: 'GitHub is unavailable', statusCode: 503 })
  }
}

/**
 * Requests for the MCP endpoint, the protocol's OAuth endpoints, the agent
 * guide and the rest of `/.well-known/`, or null for everything else, which
 * TanStack Start serves. Our own OAuth pages (authorize, callback) are Start
 * routes.
 */
export function routeAgentRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> | null {
  const { pathname } = new URL(request.url)
  if (pathname === MCP_PATH || pathname.startsWith(`${MCP_PATH}/`) || pathname.startsWith('/.well-known/oauth-protected-resource')) {
    return serversFor(env).mcp.fetch(request, env, ctx)
  }
  if (
    pathname.startsWith('/.well-known/oauth-authorization-server') ||
    pathname === TOKEN_PATH ||
    pathname === REGISTER_PATH
  ) {
    return serversFor(env).auth.fetch(request, env, ctx)
  }
  // The home page stays HTML for browsers. Agents that ask for markdown get the guide.
  const markdownHome = pathname === '/' && prefersMarkdown(request.headers.get('Accept'))
  if ((request.method === 'GET' || request.method === 'HEAD') && (pathname === GUIDE_PATH || markdownHome)) {
    return Promise.resolve(guide(request, env, markdownHome))
  }
  // Clients probe other discovery paths, like OpenID's, and need a 404, not
  // the repo route reading `.well-known` as an owner and redirecting to sign in.
  if (pathname.startsWith('/.well-known/')) return Promise.resolve(new Response(null, { status: 404 }))
  return null
}

function guide(request: Request, env: Env, negotiated: boolean) {
  const headers = new Headers({ 'Content-Type': 'text/markdown; charset=utf-8' })
  if (negotiated) headers.set('Vary', 'Accept')
  return new Response(request.method === 'HEAD' ? null : agentGuide(env.APP_URL, mcpUrl(env.APP_URL)), { headers })
}
