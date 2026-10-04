// Secrets are set with `wrangler secret put` (or .dev.vars locally), so
// `wrangler types` doesn't see them.
declare namespace Cloudflare {
  interface Env {
    GITHUB_APP_CLIENT_SECRET: string
    SESSION_SECRET: string
  }
}
