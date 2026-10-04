/// <reference types="@cloudflare/vitest-pool-workers/types" />
import type { OAuthResourceContext } from '@cloudflare/workers-oauth-provider'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { getDb } from '../db/client'
import type { RepoAccess } from '../github/access'
import { AuthError, GitHubError, NotFoundError, RateLimitError } from '../github/client'
import { READ, WRITE, type AgentProps } from './grant'
import { agentErrorMessage, buildServer, instructions, mcpHandler } from './mcp'
import { ToolError, type RepoReader } from './tools'

const repo: RepoAccess = {
  repoId: 1,
  owner: 'acme',
  name: 'docs',
  fullName: 'acme/docs',
  private: true,
  defaultBranch: 'main',
  ownerId: 1,
  permissions: { comment: true, moderate: false },
}

const github: RepoReader = {
  access: async () => repo,
  resolveRef: async (_, ref) => ({ ref, sha: 'b'.repeat(40) }),
  file: async () => null,
  commit: async () => null,
}

async function connect(reader: RepoReader = github) {
  const server = buildServer({ db: getDb(), appUrl: 'http://localhost:3000', github: reader, agent: { userId: 1, clientName: 'Test' } })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await server.connect(serverSide)
  const client = new Client({ name: 'test', version: '1.0.0' })
  await client.connect(clientSide)
  return client
}

describe('the MCP server', () => {
  it('offers the four tools, the prompt and the working rules', async () => {
    const client = await connect()
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual(['get_thread', 'list_threads', 'mark_addressed', 'reply'])
    expect(tools.find((t) => t.name === 'list_threads')?.annotations?.readOnlyHint).toBe(true)
    expect((await client.listPrompts()).prompts.map((p) => p.name)).toEqual(['address_comments'])
    expect(client.getInstructions()).toBe(instructions('http://localhost:3000'))
    expect(client.getInstructions()).toMatch(/^Reviews \(localhost:3000\)/)
  })

  it('returns threads as structured content and as text', async () => {
    const client = await connect()
    const result = await client.callTool({ name: 'list_threads', arguments: { repo: 'acme/docs' } })
    expect(result.structuredContent).toEqual({ repo: 'acme/docs', ref: 'main', sha: 'b'.repeat(40), threads: [], truncated: false })
    expect(result.content).toEqual([{ type: 'text', text: expect.stringMatching(/^No matching threads in acme\/docs/) }])
  })

  it('turns problems the agent can fix into tool errors', async () => {
    const client = await connect()
    const result = await client.callTool({
      name: 'reply',
      arguments: { repo: 'acme/docs', threadId: crypto.randomUUID(), body: 'Hi' },
    })
    expect(result).toMatchObject({ isError: true, content: [{ type: 'text', text: expect.stringMatching(/^No thread/) }] })
  })
})

describe('agentErrorMessage', () => {
  it.each([
    ['a tool error', new ToolError('No thread abc in acme/docs.'), /^No thread abc/],
    ['a repo it cannot read', new NotFoundError('Not found: /repos/acme/secret', 404), /doesn't exist, or the person you act for can't read it/],
    ['a revoked GitHub token', new AuthError('GitHub rejected the token', 401), /Disconnect the agent in Reviews/],
    ['the rate limit', new RateLimitError(Date.UTC(2026, 9, 4, 12)), /until 2026-10-04T12:00:00.000Z/],
  ])('explains %s', (_, error, message) => {
    expect(agentErrorMessage(error)).toMatch(message)
  })

  it.each([
    ['a GitHub outage', new GitHubError('GitHub 502 for /repos/acme/docs', 502)],
    ['a bug', new TypeError("Cannot read properties of undefined (reading 'sha')")],
    ['a thrown string', 'oops'],
  ])('leaves %s to stay an error', (_, error) => {
    expect(agentErrorMessage(error)).toBeNull()
  })
})

describe('the address_comments prompt', () => {
  const failing = (error: unknown): RepoReader => ({
    ...github,
    access: async () => {
      throw error
    },
  })
  const promptText = async (reader: RepoReader) => {
    const client = await connect(reader)
    const { messages } = await client.getPrompt({ name: 'address_comments', arguments: { repo: 'acme/secret' } })
    return (messages[0].content as { text: string }).text
  }

  it('explains a repo the agent cannot read the way the tools do', async () => {
    const text = await promptText(failing(new NotFoundError('Not found: /repos/acme/secret', 404)))
    expect(text).toContain(`Couldn't list the threads: ${agentErrorMessage(new NotFoundError('', 404))}`)
    expect(text).not.toContain('/repos/acme/secret')
  })

  it('fails as a request instead of putting other errors in the prompt', async () => {
    const client = await connect(failing(new Error('D1_ERROR: no such table: threads')))
    const result = client.getPrompt({ name: 'address_comments', arguments: { repo: 'acme/secret' } })
    await expect(result).rejects.toThrow(/^MCP error -32603/)
  })
})

describe('the MCP endpoint', () => {
  const props: AgentProps = {
    userId: 1,
    login: 'hugo',
    clientName: 'Test',
    github: { accessToken: 'gho_test', accessExpiresAt: Date.now() + 3600_000, refreshToken: 'r', refreshExpiresAt: Date.now() + 3600_000 },
  }
  const ctx = (scope: string[]) =>
    ({
      props,
      auth: { token: 't', audience: 'http://localhost:3000/mcp', scope },
      waitUntil: () => {},
      passThroughOnException: () => {},
    }) as unknown as OAuthResourceContext<AgentProps>

  const rpc = (body: object) =>
    new Request('http://localhost:3000/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify(body),
    })

  it('asks a read-only client to step up before writing', async () => {
    const call = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'reply', arguments: {} } }
    const res = await mcpHandler.fetch(rpc(call), env, ctx([READ]))
    expect(res.status).toBe(403)
    expect(res.headers.get('WWW-Authenticate')).toMatch(/insufficient_scope/)
    expect(res.headers.get('WWW-Authenticate')).toContain(WRITE)
  })

  it('answers JSON-RPC over HTTP without a session', async () => {
    const init = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
    }
    const res = await mcpHandler.fetch(rpc(init), env, ctx([READ]))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { result: { serverInfo: { name: string }; instructions: string } }
    expect(body.result.serverInfo.name).toBe('reviews')
    expect(body.result.instructions).toBe(instructions(env.APP_URL))
    expect(res.headers.get('mcp-session-id')).toBeNull()
  })
})
