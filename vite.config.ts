import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

const diffsStub = fileURLToPath(new URL('./src/stubs/diffs-ssr-stub.tsx', import.meta.url))
const mermaidStub = fileURLToPath(new URL('./src/stubs/mermaid-ssr-stub.ts', import.meta.url))

const ssrStubs: Record<string, string> = {
  '@pierre/diffs/react': diffsStub,
  '@pierre/diffs': diffsStub,
  shiki: diffsStub,
  'shiki/langs': diffsStub,
  mermaid: mermaidStub,
}

/**
 * Code highlighting (@pierre/diffs + Shiki) and Mermaid diagrams only render
 * in the browser, so the server gets stubs instead. This keeps Shiki's
 * grammars and Mermaid out of the Worker bundle.
 */
function clientOnly(): Plugin {
  return {
    name: 'client-only',
    enforce: 'pre',
    resolveId(id) {
      if (this.environment.name === 'ssr' && Object.hasOwn(ssrStubs, id)) return ssrStubs[id]
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
    // Highlighting and Mermaid are stubbed out of the Worker, so only the browser bundles them.
    include: [...sharedDeps, '@pierre/diffs', '@pierre/diffs/react', 'shiki', 'shiki/langs', 'mermaid', 'react-dom/client'],
  },
  environments: {
    ssr: {
      optimizeDeps: {
        include: [...sharedDeps, 'react-dom/server', 'drizzle-orm', 'drizzle-orm/d1', 'drizzle-orm/sqlite-core'],
      },
    },
  },
  plugins: [
    clientOnly(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})
