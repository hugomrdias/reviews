# Connect Reviews

The plugin connects to `https://reviews.hugodias.me/mcp` over Streamable HTTP. Authentication is OAuth through Reviews and GitHub, using the person's repository access.

When the tools are missing or a call fails authentication, ask the person to sign in to the plugin's Reviews server again from the client's MCP or plugin settings (`/mcp` in Claude Code). Avoid adding a second standalone server to work around the plugin's connection; if one is already configured, ask the person to remove it.

Without the plugin, read `https://reviews.hugodias.me/llms.txt`. It has the current setup steps for each client. Set the server up only when the person asks for it or approves it.

Let the person complete browser sign-in and authorization. Until the tools work you can't see comments, which is different from there being none. For an access error, explain the returned error; seeing comments requires both GitHub access and the Reviews GitHub App installation for that repository.
