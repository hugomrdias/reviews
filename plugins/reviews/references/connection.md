# Connect Reviews

Endpoint: `https://reviews.hugodias.me/mcp`. Transport: Streamable HTTP. Authentication: OAuth through Reviews and GitHub, using the person's repository access.

Use the plugin's bundled connection when installed. Complete authentication through the client's MCP or connector settings. Avoid adding a second standalone server to work around a plugin connection.

For an agent without the plugin, offer the appropriate setup. When the user authorizes configuration, you can run these commands:

- **Codex:** check `codex mcp get reviews`. If missing, run `codex mcp add reviews --url https://reviews.hugodias.me/mcp`. Adding may start OAuth automatically; wait for its result before running `codex mcp login reviews` separately. If the connection succeeds but tools remain unavailable, restart the client and return to the chat.
- **Claude Code:** run `claude mcp add --transport http reviews https://reviews.hugodias.me/mcp`, then authenticate through `/mcp`.
- **ChatGPT web:** add the endpoint through Plugins in developer mode and complete OAuth. See the official [plugin quickstart](https://developers.openai.com/plugins/quickstart).
- **Claude web or Desktop:** add the endpoint as a custom connector and complete OAuth. See the official [custom connector guide](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp).

Let the person complete browser sign-in and authorization when their interaction is required. Verify that the read tools are available before reporting comments. For an access error, explain the returned error; seeing comments requires both GitHub access and the Reviews GitHub App installation for that repository.
