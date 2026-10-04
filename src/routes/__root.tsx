import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Scripts, ScriptOnce, createRootRouteWithContext } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getViewer } from '@/functions/viewer'
import { appUrl } from '@/lib/site'
import { getThemePreference, ThemeProvider, themeScript, type Theme } from '@/lib/theme'
import type { SessionUser } from '@/server/auth/session'

import appCss from '../styles.css?url'

interface RouterContext {
  queryClient: QueryClient
  viewer: SessionUser | null
  theme: Theme
}

const DESCRIPTION = 'Read and comment on the docs in your GitHub repos.'

// The --paper color of each theme, for the browser's toolbar.
const THEME_COLORS = { light: '#f6f7f9', dark: '#161b24' }

const FONTS =
  'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:wght@400;600&family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..700&display=swap'

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    const [viewer, theme] = await Promise.all([getViewer(), getThemePreference()])
    return { viewer, theme }
  },
  head: ({ matches }) => {
    const origin = appUrl()
    // Every page shares the same generic card. File pages are often in private
    // repositories, so previews never describe what's in them.
    return {
      meta: [
        { charSet: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { title: 'Reviews' },
        { name: 'description', content: DESCRIPTION },
        { property: 'og:site_name', content: 'Reviews' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Reviews' },
        { property: 'og:description', content: DESCRIPTION },
        { property: 'og:url', content: new URL(matches.at(-1)?.pathname ?? '/', origin).toString() },
        { property: 'og:image', content: new URL('/og-image.png', origin).toString() },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        { property: 'og:image:alt', content: 'Reviews: comment on the docs in your GitHub repos' },
        { name: 'twitter:card', content: 'summary_large_image' },
      ],
      links: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
        { rel: 'stylesheet', href: FONTS },
        { rel: 'stylesheet', href: appCss },
        // logo.svg is the source. Regenerate the ICO and PNGs from it with scripts/icons.sh.
        { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'icon', href: '/logo.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' },
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
