import { fileURLToPath } from 'node:url'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

const WORKERS_TESTS = 'src/**/*.workers.test.{ts,tsx}'

export default defineConfig(async () => {
  const migrations = await readD1Migrations(fileURLToPath(new URL('./migrations', import.meta.url)))
  return {
    test: {
      projects: [
        {
          // Unit tests run in Node (happy-dom per file where DOM is needed), without
          // the Cloudflare and TanStack Start plugins.
          resolve: {
            tsconfigPaths: true,
            alias: { 'cloudflare:workers': fileURLToPath(new URL('./src/test/cloudflare-workers.ts', import.meta.url)) },
          },
          test: { name: 'unit', include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'], exclude: [WORKERS_TESTS] },
        },
        {
          // Tests that need the Workers runtime and a real D1, with the migrations applied.
          // No `main`: they import the modules they test, not the whole Worker.
          resolve: { tsconfigPaths: true },
          plugins: [
            cloudflareTest({
              miniflare: {
                // The newest date this pool's workerd supports; wrangler.jsonc's is later.
                compatibilityDate: '2026-08-22',
                compatibilityFlags: ['nodejs_compat'],
                d1Databases: ['DB'],
                kvNamespaces: ['OAUTH_KV'],
                bindings: { APP_URL: 'http://localhost:3000', TEST_MIGRATIONS: migrations },
              },
            }),
          ],
          test: { name: 'workers', include: [WORKERS_TESTS], setupFiles: ['src/test/apply-migrations.ts'] },
        },
      ],
    },
  }
})
