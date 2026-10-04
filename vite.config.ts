import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

const diffsStub = fileURLToPath(new URL('./src/stubs/diffs-ssr-stub.tsx', import.meta.url))

/**
 * Code highlighting (@pierre/diffs + Shiki) only renders in the browser, so
 * the server gets a stub instead. This keeps Shiki's grammars out of the
 * Worker bundle.
 */
function diffsClientOnly(): Plugin {
  return {
    name: 'diffs-client-only',
    enforce: 'pre',
    resolveId(id) {
      if (this.environment.name === 'ssr' && (id === '@pierre/diffs/react' || id === '@pierre/diffs')) {
        return diffsStub
      }
    },
  }
}

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // Pre-bundle up front: discovering these mid-session re-optimizes and can
  // leave two copies of React in the page.
  optimizeDeps: {
    include: [
      '@pierre/diffs',
      '@pierre/diffs/react',
      '@pierre/trees',
      '@pierre/trees/react',
      'diff',
      'approx-string-match',
      'react-markdown',
      'remark-gfm',
      'remark-frontmatter',
      'rehype-raw',
      'rehype-sanitize',
      'github-slugger',
      'unist-util-visit',
      'radix-ui',
      'cmdk',
      'vaul',
      'sonner',
    ],
  },
  plugins: [
    diffsClientOnly(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})
