import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Scripts, ScriptOnce, createRootRouteWithContext } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { analyticsScript } from '@/lib/analytics'
import { viewerQuery } from '@/lib/queries'
import { appUrl } from '@/lib/site'
import { getThemePreference, ThemeProvider, themeScript, type Theme } from '@/lib/theme'
import type { SessionUser } from '@/server/auth/session'

import appCss from '../styles.css?url'
// The interface font's Latin subset, which every page uses.
import sansFont from '@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2?url'

interface RouterContext {
  queryClient: QueryClient
  viewer: SessionUser | null
  theme: Theme
}

const DESCRIPTION = 'Read and comment on the docs in your GitHub repos.'

// The --paper color of each theme, for the browser's toolbar.
const THEME_COLORS = { light: '#f6f7f9', dark: '#161b24' }

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context }) => ({
    viewer: await context.queryClient.ensureQueryData(viewerQuery()),
    theme: getThemePreference(),
  }),
  head: ({ matches }) => {
    const origin = appUrl()
    const url = new URL(matches.at(-1)?.pathname ?? '/', origin).toString()
    // Every page shares the same generic card. File pages are often in private
    // repositories, so previews never describe what's in them.
    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title: 'Reviews' },
        { name: 'description', content: DESCRIPTION },
        { name: 'author', content: 'Hugo Dias' },
        { property: 'og:site_name', content: 'Reviews' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Reviews' },
        { property: 'og:description', content: DESCRIPTION },
        { property: 'og:url', content: url },
        // Bump v after regenerating the card. Link previews cache images by URL.
        { property: 'og:image', content: new URL('/og-image.png?v=2', origin).toString() },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'Reviews: comment on the docs in your GitHub repos' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      links: [
        // Without the query, so the home page's ?returnTo= variants resolve to one URL.
        { rel: 'canonical', href: url },
        { rel: 'preload', href: sansFont, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
        { rel: 'stylesheet', href: appCss },
        // logo.svg is the source. Regenerate the ICO and PNGs from it with scripts/icons.sh.
        { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
        // For coding agents: how to connect over MCP. See src/server/agents/guide.ts.
        { rel: 'alternate', type: 'text/markdown', href: '/llms.txt', title: 'Reviews for coding agents' },
      ],
      scripts: [
        // Umami on stats.hugomrdias.dev. data-domains keeps local dev and Previews out of the stats,
        // and data-performance reports Web Vitals (TTFB, FCP, LCP, CLS, INP) per page view.
        // Private repositories stay out of it: data-before-send redacts file pages (analyticsScript,
        // in the body), and the search and hash go too, since ?returnTo= and heading anchors can
        // name what's in a repo.
        {
          src: 'https://stats.hugomrdias.dev/script.js',
          defer: true,
          'data-website-id': '2755915d-2321-4120-a782-f707b9d62e9e',
          'data-domains': 'reviews.hugodias.me',
          'data-before-send': 'umamiBeforeSend',
          'data-exclude-search': 'true',
          'data-exclude-hash': 'true',
          'data-performance': 'true',
        },
      ],
    }
  },
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { theme } = Route.useRouteContext()
  return (
    <html lang="en" className={theme === 'dark' ? 'dark' : undefined} suppressHydrationWarning>
      <head>
        <HeadContent />
        {/* Here, not in head(): HeadContent keeps one meta per name, and system needs two. */}
        {theme === 'system' ? (
          <>
            <meta name="theme-color" media="(prefers-color-scheme: light)" content={THEME_COLORS.light} />
            <meta name="theme-color" media="(prefers-color-scheme: dark)" content={THEME_COLORS.dark} />
          </>
        ) : (
          <meta name="theme-color" content={THEME_COLORS[theme]} />
        )}
      </head>
      <body>
        <ScriptOnce>{themeScript}</ScriptOnce>
        {/* Not in head(): the client's minified copy wouldn't match the server's, and it would add a second. */}
        <ScriptOnce>{analyticsScript}</ScriptOnce>
        <ThemeProvider initial={theme}>
          <TooltipProvider delay={300}>
            {children}
            <Toaster position="bottom-center" />
          </TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
