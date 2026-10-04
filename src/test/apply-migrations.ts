/// <reference types="@cloudflare/vitest-plugin/types" />
import { applyD1Migrations, env, type D1Migration } from 'cloudflare:test'

// Workers tests get their own D1; bring it to the current schema.
const { TEST_MIGRATIONS } = env as unknown as { TEST_MIGRATIONS: D1Migration[] }
await applyD1Migrations(env.DB, TEST_MIGRATIONS)
