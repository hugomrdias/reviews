# Reviews

Read the markdown in a GitHub repository the way GitHub renders it, select any passage, and leave a comment for your team. Comments live in this app's database, never in the repository.

- **Access follows GitHub.** People sign in with GitHub and see a repository, and its comments, only if their account can read it.
- **Links stay in the app.** Relative links between files open here, not on github.com. Images in private repositories load through the app.
- **Comments survive edits.** Each comment remembers the quoted text and its surroundings. When the file changes, the comment follows the text. If the text was reworded, the comment is marked as edited. If the text was removed, the comment is marked as outdated, and you can still open the file as it was or see what changed.
- **Three views per file.** *Page* shows rendered markdown with notes in the margin. *Source* shows the raw file, where you comment on lines. *Changes* shows a diff between two commits, with comments on both sides.

Built with TanStack Start, React, [@pierre/trees](https://trees.software) for the file tree, [@pierre/diffs](https://diffs.com) for code, source and diffs, and shadcn/ui. It runs on Cloudflare Workers, with comments stored in D1.

## Run it locally

Requirements: pnpm 12. It installs the pinned Node 24 for the project's scripts (`devEngines` in `package.json`).

1. Register a GitHub App for development (see [GitHub App](#github-app)), using `http://localhost:3000/auth/callback` as the callback URL.
2. Copy `.dev.vars.example` to `.dev.vars`. Fill in the app's client ID, slug and client secret, and a session secret (`openssl rand -base64 32`). The vars in `wrangler.jsonc` are production values; `.dev.vars` overrides them locally.
3. Install, create the local database, and start:

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
| Logo | `public/icon-512.png`, with badge background `#1b2230` |

Generate a client secret. The app doesn't need a private key.

A person sees a repository only when two things are true: their GitHub account can read it, and the app is installed on the repository's owner with that repository selected. When either isn't true, the app shows what's missing and links to the fix.

## Deploy to Cloudflare

GitHub Actions deploys (`.github/workflows/ci.yml`). Once the checks pass:

- **Production.** Each push to `main` applies D1 migrations and deploys to https://reviews.hugodias.me.
- **Pull request Previews.** Each pull request from this repository gets a [Worker Preview](https://developers.cloudflare.com/workers/previews/) at `https://pr-<number>-github-reviews.hugomrdias.workers.dev`. The URL is posted on the pull request, and the Preview is deleted when the pull request closes. Previews use the dev GitHub App and share the `github-reviews-preview` database, so they never touch production data. Pull requests from forks get no Preview.

The Workers Paid plan is recommended: rendering large documents can exceed the free plan's 10 ms CPU limit.

### One-time setup

1. Create both databases. Put the production `database_id` in `d1_databases` in `wrangler.jsonc`, and the preview one in `previews.d1_databases` and in `wrangler.preview-migrations.jsonc`:

   ```bash
   pnpm exec wrangler d1 create github-reviews
   ```

   ```bash
   pnpm exec wrangler d1 create github-reviews-preview
   ```

2. In `wrangler.jsonc`, set `GITHUB_APP_CLIENT_ID` and `GITHUB_APP_SLUG` under `vars` to the production GitHub App.
3. Set the production secrets, from the production GitHub App:

   ```bash
   pnpm exec wrangler secret put GITHUB_APP_CLIENT_SECRET
   ```

   ```bash
   pnpm exec wrangler secret put SESSION_SECRET
   ```

4. Set the Preview secrets, from the dev GitHub App. Each new Preview copies them when it's created:

   ```bash
   pnpm exec wrangler preview base-config secret put GITHUB_APP_CLIENT_SECRET
   ```

   ```bash
   pnpm exec wrangler preview base-config secret put SESSION_SECRET
   ```

5. Create a Cloudflare API token from the **Edit Cloudflare Workers** template, and add **Account → D1 → Edit**. Scope the zone resources to `hugodias.me`. Add it and your account ID to the repository's Actions secrets:

   ```bash
   gh secret set CLOUDFLARE_API_TOKEN
   ```

   ```bash
   gh secret set CLOUDFLARE_ACCOUNT_ID
   ```

### Signing in on a Preview

GitHub only redirects to callback URLs registered on the app, with no wildcards. To sign in on a Preview, add `https://pr-<number>-github-reviews.hugomrdias.workers.dev/auth/callback` to the dev GitHub App's callback URLs. Pages that don't need a session work without it.

### Migrations on Previews

All Previews share one database, so a pull request's migrations reach it before the pull request merges. If a migration would break other open Previews, give that branch its own database: change `database_id` in both `previews.d1_databases` and `wrangler.preview-migrations.jsonc`.

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
| `scripts/icons.sh` | Regenerate the favicon and app icons from `public/logo.svg` (needs ImageMagick 7) |

## How it fits together

- `src/routes/$owner/$repo/$.tsx` is the viewer. The URL keeps the branch name, but every read is pinned to the commit it resolves to, so cached data never goes stale.
- `src/server/` runs only on the Worker. It holds GitHub access checks, sessions (tokens encrypted in D1, with refresh handled safely when requests race), file reads and the comment store.
- `src/functions/` holds the server functions the UI calls. Every one checks that the signed-in user can read the repository.
- `src/lib/anchoring/` places comments on the current version of a file. Text comments are matched by quote and context. Line comments are followed through a line diff.
- Code highlighting runs only in the browser. The Worker never bundles Shiki.

Dependency versions are pinned exactly. TanStack Start is a release candidate and @pierre/trees is in beta, so upgrade them deliberately.
