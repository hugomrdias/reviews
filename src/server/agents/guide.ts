// What a coding agent reads when someone says "use reviews.example.com to
// address the comments": served as /llms.txt, and as / to clients that ask
// for markdown. It only has to get the agent connected. The MCP server's own
// instructions cover the work.

/** The guide, naming this deployment's site and MCP endpoint. */
export function agentGuide(appUrl: string, mcpUrl: string) {
  const host = new URL(appUrl).host
  return `# Reviews

> Reviews (${host}) is where people comment on the markdown and source files in GitHub repositories. The comments live here, not in the repository. Coding agents read them and work through them over MCP.

## Connect

The MCP server is at ${mcpUrl} (Streamable HTTP, with OAuth). Signing in happens in the person's browser with their GitHub account, so the person has to add the server and approve the sign-in:

- Claude Code: run \`claude mcp add --transport http reviews ${mcpUrl}\`, then sign in from \`/mcp\`.
- Other MCP clients: add a remote HTTP server with the URL above.

If you don't have the Reviews tools (list_threads, get_thread, reply, mark_addressed), give the person these steps and stop. Don't read the site's pages instead: they need a signed-in browser.

## Address comments

1. Find the repository with \`git remote get-url origin\`, and pass it to the tools as owner/name.
2. Use the address_comments prompt, or call list_threads and then get_thread.
3. Change files where a comment asks for a clear change. Reply on the thread when it asks a question or needs a decision.
4. After committing, call mark_addressed with a short summary and the commit SHA. A person confirms it.

The server's instructions have the full rules.
`
}

/** Whether a request for a page would rather have markdown than HTML, as some agents' fetchers ask. */
export function prefersMarkdown(accept: string | null) {
  if (!accept) return false
  const quality = (type: string) => {
    for (const part of accept.split(',')) {
      const [name, ...params] = part.split(';').map((s) => s.trim().toLowerCase())
      if (name !== type) continue
      const q = params.find((p) => p.startsWith('q='))
      return q ? Number(q.slice(2)) || 0 : 1
    }
    return 0
  }
  const markdown = quality('text/markdown')
  return markdown > 0 && markdown >= quality('text/html')
}
