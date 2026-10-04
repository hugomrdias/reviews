import { defineConfig } from 'vitest/config'

// Unit tests run in Node (happy-dom per file where DOM is needed), without
// the Cloudflare and TanStack Start plugins.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
