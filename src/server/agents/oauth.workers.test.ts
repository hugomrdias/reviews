/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { createExecutionContext, env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { READ } from './grant'
import { routeAgentRequest } from './oauth'

const get = (path: string, init?: RequestInit) =>
  routeAgentRequest(new Request(`http://localhost:3000${path}`, init), env, createExecutionContext())

describe('discovery', () => {
  it('points an unauthenticated client at the resource metadata', async () => {
    const res = await routeAgentRequest(new Request('http://localhost:3000/mcp', { method: 'POST' }), env, createExecutionContext())
    expect(res?.status).toBe(401)
    expect(res?.headers.get('WWW-Authenticate')).toContain(
      'resource_metadata="http://localhost:3000/.well-known/oauth-protected-resource/mcp"',
    )
  })

  it('publishes the resource and authorization server metadata', async () => {
    const resource = await get('/.well-known/oauth-protected-resource/mcp')
    expect(await resource?.json()).toMatchObject({
      resource: 'http://localhost:3000/mcp',
      authorization_servers: ['http://localhost:3000'],
      scopes_supported: [READ],
    })
    const server = await get('/.well-known/oauth-authorization-server')
    expect(await server?.json()).toMatchObject({
      issuer: 'http://localhost:3000',
      authorization_endpoint: 'http://localhost:3000/oauth/authorize',
      registration_endpoint: 'http://localhost:3000/oauth/register',
    })
  })

  it('answers other discovery paths with a 404', async () => {
    for (const path of ['/.well-known/openid-configuration', '/.well-known/oauth-protected-resource', '/.well-known/x']) {
      expect((await get(path))?.status, path).toBe(404)
    }
  })

  it('leaves the app’s own routes to the app', () => {
    expect(get('/oauth/authorize')).toBeNull()
    expect(get('/acme/docs')).toBeNull()
  })
})

describe('the agent guide', () => {
  it('tells an agent how to connect to this deployment', async () => {
    const res = await get('/llms.txt')
    expect(res?.headers.get('Content-Type')).toBe('text/markdown; charset=utf-8')
    const text = await res!.text()
    expect(text).toMatch(/^# Reviews\n/)
    expect(text).toContain('Reviews (localhost:3000)')
    expect(text).toContain('claude mcp add --transport http reviews http://localhost:3000/mcp')
  })

  it('answers the home page with it only when markdown is preferred', async () => {
    const markdown = await get('/', { headers: { Accept: 'text/markdown, text/html;q=0.9' } })
    expect(markdown?.headers.get('Vary')).toBe('Accept')
    expect(await markdown?.text()).toMatch(/^# Reviews/)

    for (const accept of ['text/html,application/xhtml+xml,*/*;q=0.8', 'text/html, text/markdown;q=0.5', '*/*']) {
      expect(get('/', { headers: { Accept: accept } }), accept).toBeNull()
    }
    expect(get('/llms.txt', { method: 'POST' })).toBeNull()
  })
})
