import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Unit tests run in Node (happy-dom per file where DOM is needed), without
// the Cloudflare and TanStack Start plugins.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { 'cloudflare:workers': fileURLToPath(new URL('./src/test/cloudflare-workers.ts', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
