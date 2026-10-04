// What a coding agent reads when someone says "use reviews.example.com to
// address the comments": served at GUIDE_PATH, and as / to clients that ask
// for markdown. Its job is getting the agent connected, with an outline of the
// work. The MCP server's own instructions have the full rules.

export const GUIDE_PATH = '/llms.txt'

/** The guide, naming this deployment's site and MCP endpoint. */
export function agentGuide(appUrl: string, mcpUrl: string) {
  const host = new URL(appUrl).host
  return `# Reviews

> Reviews (${host}) is where people comment on the markdown and source files in GitHub repositories. The comments live here, not in the repository. Coding agents read them and work through them over MCP.

## Connect

The MCP server is at ${mcpUrl} (Streamable HTTP, with OAuth). If you already have the Reviews tools (list_threads, get_thread, reply, mark_addressed), go straight to the work below.

Otherwise, add the server to the person's MCP config. Run the command once they ask you to connect or approve it:

- Codex: check with \`codex mcp get reviews\`, then add it with \`codex mcp add reviews --url ${mcpUrl}\`. If adding it doesn't start the sign-in, run \`codex mcp login reviews\`.
- Claude Code: run \`claude mcp add --transport http reviews ${mcpUrl}\`. The person signs in from \`/mcp\`.
- Other MCP clients: add it as a remote server with the URL above.

The sign-in opens in the person's browser with their GitHub account, so wait for them to finish it. If the tools still aren't there in this session, ask the person to restart their client and come back to this chat.

The site's pages need a signed-in browser, so until the tools work you can't see the comments. Tell the person the connection isn't set up yet, which is different from there being no comments.

## Work with comments

Find the repository with \`git remote get-url origin\`, and pass it to the tools as owner/name. Read the threads with list_threads, then get_thread for the ones that matter.

### Check comments

When asked to check, list or summarize the comments, report what the threads say. Checking is read-only.

### Address comments

Use the address_comments prompt, or read the threads as above. Change files where comments ask for clear changes, reply on threads that need a person, and call mark_addressed once the fix is committed. The server's instructions have the full rules.
`
}

/** The 404 for agents that asked for markdown: what's missing, and where to start instead. */
export function agentNotFound(appUrl: string, pathname: string) {
  return `# Not found

There's no page at \`${pathname}\` on Reviews. To connect a coding agent and work through review comments, read ${new URL(GUIDE_PATH, appUrl)}.
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
