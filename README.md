# Reviews

Read the markdown in a GitHub repository the way GitHub renders it, select any passage, and leave a comment for your team. Comments live in this app's database, never in the repository.

- **Access follows GitHub.** People sign in with GitHub and see a repository, and its comments, only if their account can read it.
- **Links stay in the app.** Relative links between files open here, not on github.com. Images in private repositories load through the app.
- **Comments survive edits.** Each comment remembers the quoted text and its surroundings. When the file changes, the comment follows the text. If the text was reworded, the comment is marked as edited. If the text was removed, the comment is marked as outdated, and you can still open the file as it was or see what changed.
- **Three views per file.** *Page* shows rendered markdown with notes in the margin. *Source* shows the raw file, where you comment on lines. *Changes* shows a diff between two commits, with comments on both sides.

Built with TanStack Start, React, [@pierre/trees](https://trees.software) for the file tree, [@pierre/diffs](https://diffs.com) for code, source and diffs, and shadcn/ui. It runs on Cloudflare Workers, with comments stored in D1.

## Run it locally

Requirements: Node 22.12 or later and pnpm 12.

1. Register a GitHub App for development (see [GitHub App](#github-app)), using `http://localhost:3000/auth/callback` as the callback URL.
2. Put the app's client ID and slug in `wrangler.jsonc` under `vars`.
3. Copy `.dev.vars.example` to `.dev.vars`. Fill in the client secret and a session secret (`openssl rand -base64 32`).
4. Install, create the local database, and start:

```bash
pnpm install
pnpm db:migrate:local
pnpm dev
```

Open http://localhost:3000.

To work on the viewer without signing in, open http://localhost:3000/dev/preview. It shows a fixture document with comments in every state. The route only exists in development.

## GitHub App

Create the app at **GitHub → Settings → Developer settings → GitHub Apps → New GitHub App**. Use one app for development and another for production, so the production secret never sits on a laptop.

| Setting | Value |
|---|---|
| Callback URL | `https://<your domain>/auth/callback` |
| Expire user authorization tokens | On |
| Request user authorization (OAuth) during installation | Off |
| Setup URL | `https://<your domain>/github/installed` |
| Redirect on update | On |
| Webhook | Off |
| Repository permissions | Contents: Read-only, Metadata: Read-only |
| Where can this app be installed | Any account |

Generate a client secret. The app doesn't need a private key.

A person sees a repository only when two things are true: their GitHub account can read it, and the app is installed on the repository's owner with that repository selected. When either isn't true, the app shows what's missing and links to the fix.

## Deploy to Cloudflare

1. Create the database, and put the printed `database_id` in `wrangler.jsonc`:

   ```bash
   pnpm exec wrangler d1 create github-reviews
   ```

2. Set the secrets:

   ```bash
   pnpm exec wrangler secret put GITHUB_APP_CLIENT_SECRET
   ```

   ```bash
   pnpm exec wrangler secret put SESSION_SECRET
   ```

3. In `wrangler.jsonc`, set `APP_URL`, `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_SLUG` to the production values, and uncomment `routes` with your custom domain. The Cache API, which caches files and images, doesn't run on `*.workers.dev`.
4. In the Cloudflare dashboard, open **Workers & Pages → Create → Import a repository**, and pick this repository. Use these build settings:
   - Build command: `pnpm run build`
   - Deploy command: `pnpm run db:migrate:remote && pnpm exec wrangler deploy`
   - Environment variable: `NODE_VERSION=22`

Every push to the main branch then deploys. The Workers Paid plan is recommended: rendering large documents can exceed the free plan's 10 ms CPU limit.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server on port 3000, with the local D1 database |
| `pnpm build` | Production build |
| `pnpm test` | Unit tests |
| `pnpm typecheck` | TypeScript check |
| `pnpm db:generate` | New migration from `src/server/db/schema.ts` |
| `pnpm db:migrate:local` / `db:migrate:remote` | Apply migrations |
| `pnpm cf-typegen` | Regenerate binding types after changing `wrangler.jsonc` |

## How it fits together

- `src/routes/$owner/$repo/$.tsx` is the viewer. The URL keeps the branch name, but every read is pinned to the commit it resolves to, so cached data never goes stale.
- `src/server/` runs only on the Worker. It holds GitHub access checks, sessions (tokens encrypted in D1, with refresh handled safely when requests race), file reads and the comment store.
- `src/functions/` holds the server functions the UI calls. Every one checks that the signed-in user can read the repository.
- `src/lib/anchoring/` places comments on the current version of a file. Text comments are matched by quote and context. Line comments are followed through a line diff.
- Code highlighting runs only in the browser. The Worker never bundles Shiki.

Dependency versions are pinned exactly. TanStack Start is a release candidate and @pierre/trees is in beta, so upgrade them deliberately.
