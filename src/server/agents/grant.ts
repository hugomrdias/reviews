import type { TokenSet } from '../auth/oauth'

// What an agent's grant carries, shared by the OAuth server and the MCP handler.

export const READ = 'reviews:read'
export const WRITE = 'reviews:write'
export const SCOPES = [READ, WRITE]

/** What a grant stores, encrypted with its tokens. MCP handlers get it as `ctx.props`. */
export interface AgentProps {
  userId: number
  login: string
  /** From the client's registration, such as "Claude Code". Becomes comments.via. */
  clientName: string
  /** The agent's own GitHub tokens, from its own sign-in. */
  github: TokenSet
}
