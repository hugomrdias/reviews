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
      {
        rel: 'icon',
        href: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%231b2230'/><rect x='8' y='13' width='16' height='7' rx='1.5' fill='%23ffd43b'/></svg>",
      },
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
          <TooltipProvider delayDuration={300}>
            {children}
            <Toaster position="bottom-center" />
          </TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}
