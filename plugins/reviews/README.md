# Reviews for Github

The plugin connects an agent to Reviews and supplies two shared skills:

- `check-comments` reads and summarizes threads without making changes.
- `address-comments` works through requested feedback and marks committed fixes addressed for a person to confirm.

The same folder supports OpenAI's portable Agent Plugins format (`plugin.json` and `mcp.json`) and Claude Code's format (`.claude-plugin/plugin.json` and `.mcp.json`). Both clients read the same `skills/` directory. The server is the existing production endpoint; installing this plugin does not start a local copy of Reviews.

The bundled logo in `assets/logo.png` uses the site's `public/icon-512.png` artwork. OpenAI uses it for the plugin logo and composer icon; Claude's directory metadata points to the same asset.

## Package the plugin

From the repository root:

```sh
pnpm plugin:package
```

This uses the project's Node.js runtime to create `dist/reviews-plugin.zip` with the manifests at the archive root, including Claude's dotfiles. Each run replaces the archive, so deleted source files do not remain in it. The ZIP is useful for sharing or uploading; local marketplaces use the plugin folder directly.

## Codex

From the repository root, register and inspect the local marketplace:

```sh
codex plugin marketplace add .
codex plugin list --marketplace reviews --available --json
```

In the desktop app, open Plugins and select the **Reviews for Github** local marketplace. Install **Reviews for Github** and authenticate when prompted. Restart the app after changing the package. Invoke `$check-comments` or `$address-comments`, or ask to check or address Reviews comments.

Keep one connection per client. If you previously configured a standalone `reviews` server, remove it with `codex mcp remove reviews` before using the plugin's connection.

## Claude Code

From the repository root, validate and install from the local marketplace:

```sh
claude plugin validate ./plugins/reviews
claude plugin validate .
claude plugin marketplace add .
claude plugin install reviews@reviews
```

Authenticate the plugin's Reviews server through `/mcp`. Invoke `/reviews:check-comments` or `/reviews:address-comments`. For development without installing, launch `claude --plugin-dir ./plugins/reviews`.

If a standalone `reviews` server is already configured, remove that connection through `/mcp` before using the plugin's server.

## Web clients

Local marketplace files do not install an account connector on the web.

For ChatGPT, follow the official [plugin quickstart](https://developers.openai.com/plugins/quickstart) with `https://reviews.hugodias.me/mcp`, then test in a new Work chat. To bind this package's skills to that account connection, use its actual registered `plugin_asdk_app...` ID following the [packaging guide](https://developers.openai.com/plugins/build/plugins). This repository does not contain a registered connector ID or a public directory submission.

For Claude web or Desktop, add the same URL as a [custom connector](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp). That connection exposes the server's tools and instructions; it does not install the local Claude Code skills.

## Verification

After connecting, try each scenario in a disposable repository that the Reviews GitHub App can access:

1. Ask to list comments. Confirm the repository and ref, thread links and status. No reply or status update should be posted.
2. Ask to list comments on a repository with none. Confirm an empty result, distinct from an access or connection error.
3. Ask to address a comment requesting a small edit. Confirm the edit and relevant checks, then a reply and addressed status only after the fix is committed. A person confirms or reopens it.
4. Ask to address a question that needs a decision. Confirm it stays open with a question or blocker.

The manifests can be validated locally. OAuth and behavior in each client require separate end-to-end verification before publishing. Installing the plugin does not submit it to either public directory.
