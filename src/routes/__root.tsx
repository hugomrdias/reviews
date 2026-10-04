import type { QueryClient } from '@tanstack/react-query'
import { HeadContent, Scripts, ScriptOnce, createRootRouteWithContext } from '@tanstack/react-router'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { getViewer } from '@/functions/viewer'
import { getThemePreference, ThemeProvider, themeScript, type Theme } from '@/lib/theme'
import type { SessionUser } from '@/server/auth/session'

import appCss from '../styles.css?url'

interface RouterContext {
  queryClient: QueryClient
  viewer: SessionUser | null
  theme: Theme
}

const FONTS =
  'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:wght@400;600&family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Literata:ital,opsz,wght@0,7..72,400..700;1,7..72,400..700&display=swap'

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    const [viewer, theme] = await Promise.all([getViewer(), getThemePreference()])
    return { viewer, theme }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Reviews' },
      { name: 'description', content: 'Read and comment on the docs in your GitHub repos.' },
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
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { theme } = Route.useRouteContext()
  return (
    <html lang="en" className={theme === 'dark' ? 'dark' : undefined} suppressHydrationWarning>
      <head>
        <HeadContent />
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
