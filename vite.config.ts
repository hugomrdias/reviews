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
      if (this.environment.name === 'ssr' && (id === '@pierre/diffs/react' || id === '@pierre/diffs' || id === 'shiki')) {
        return diffsStub
      }
    },
  }
}

// Pre-bundled up front in both environments. A dependency discovered
// mid-session re-optimizes, and the page or the Worker can end up with two
// copies of React until the next reload.
const sharedDeps = [
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
  '@base-ui/react/avatar',
  '@base-ui/react/button',
  '@base-ui/react/dialog',
  '@base-ui/react/drawer',
  '@base-ui/react/input',
  '@base-ui/react/menu',
  '@base-ui/react/merge-props',
  '@base-ui/react/popover',
  '@base-ui/react/preview-card',
  '@base-ui/react/scroll-area',
  '@base-ui/react/select',
  '@base-ui/react/separator',
  '@base-ui/react/tabs',
  '@base-ui/react/toggle',
  '@base-ui/react/toggle-group',
  '@base-ui/react/tooltip',
  '@base-ui/react/use-render',
  'cmdk',
  'sonner',
  'react',
  'react-dom',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  '@tanstack/react-query',
  '@tanstack/react-router-ssr-query',
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
  'lucide-react',
  'zod',
  'hast-util-sanitize',
  '@pierre/trees/ssr',
]

export default defineConfig({
  resolve: { tsconfigPaths: true },
  optimizeDeps: {
    // Highlighting is stubbed out of the Worker, so only the browser bundles it.
    include: [...sharedDeps, '@pierre/diffs', '@pierre/diffs/react', 'shiki', 'react-dom/client'],
  },
  environments: {
    ssr: {
      optimizeDeps: {
        include: [...sharedDeps, 'react-dom/server', 'drizzle-orm', 'drizzle-orm/d1', 'drizzle-orm/sqlite-core'],
      },
    },
  },
  plugins: [
    diffsClientOnly(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})
