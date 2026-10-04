// What a coding agent reads when someone says "use reviews.example.com to
// address the comments": served as /llms.txt, and as / to clients that ask
// for markdown. Its job is getting the agent connected, with an outline of the
// work. The MCP server's own instructions have the full rules.

/** The guide, naming this deployment's site and MCP endpoint. */
export function agentGuide(appUrl: string, mcpUrl: string) {
  const host = new URL(appUrl).host
  return `# Reviews

> Reviews (${host}) is where people comment on the markdown and source files in GitHub repositories. The comments live here, not in the repository. Coding agents read them and work through them over MCP.

## Connect

The MCP server is at ${mcpUrl} (Streamable HTTP, with OAuth). If you already have the Reviews tools (list_threads, get_thread, reply, mark_addressed), go straight to the work below.

Otherwise, set the server up with the person. It adds a server to their MCP config, so run the command once they ask you to connect or approve it:

- Codex: check with \`codex mcp get reviews\`, then add it with \`codex mcp add reviews --url ${mcpUrl}\`. If adding it doesn't start the sign-in, run \`codex mcp login reviews\`.
- Claude Code: run \`claude mcp add --transport http reviews ${mcpUrl}\`. The person signs in from \`/mcp\`.
- Other MCP clients: add a remote Streamable HTTP server with the URL above.

The sign-in opens in the person's browser with their GitHub account, so wait for them to finish it. If the tools still aren't there in this session, ask the person to restart their client and come back to this chat.

Until the tools work, you can't see the comments. Tell the person the connection isn't set up yet, which is different from there being no comments. The site's pages need a signed-in browser, so the tools are the only way in.

## Work with comments

Find the repository with \`git remote get-url origin\`, and pass it to the tools as owner/name.

### Check comments

When asked to check, list or summarize the comments, call list_threads, then get_thread for the threads that matter. Report each one with its file, lines and url. Checking is read-only: files and threads stay as they are until the person asks you to address them.

### Address comments

1. Use the address_comments prompt, or call list_threads and then get_thread.
2. Change files where a comment asks for a clear change. Reply on the thread when it asks a question or needs a decision.
3. After committing, call mark_addressed with a short summary and the commit SHA. A person confirms it.

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
