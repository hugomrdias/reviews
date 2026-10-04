import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

export type Theme = 'light' | 'dark' | 'system'

export const THEME_COOKIE = 'theme'

function parseTheme(value: string | undefined | null): Theme {
  return value === 'light' || value === 'dark' ? value : 'system'
}

/**
 * The theme cookie. The server reads it so the first paint already has the
 * right class; the browser reads its own copy, which setTheme keeps current.
 */
export const getThemePreference = createIsomorphicFn()
  .server(() => parseTheme(getCookie(THEME_COOKIE)))
  .client(() => parseTheme(document.cookie.match(/(?:^|; )theme=(light|dark)/)?.[1]))

/**
 * Runs before first paint. For "system" the server can't know the OS
 * setting, so this applies it and follows changes.
 */
export const themeScript = `(function(){var c=document.cookie.match(/(?:^|; )theme=(light|dark)/);var t=c?c[1]:'system';var m=window.matchMedia('(prefers-color-scheme: dark)');function a(){var d=t==='dark'||(t==='system'&&m.matches);document.documentElement.classList.toggle('dark',d)}a();if(t==='system')m.addEventListener('change',a)})()`

interface ThemeContextValue {
  theme: Theme
  /** What's on screen. "system" resolves to the OS setting. */
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function systemPrefersDark() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ initial, children }: { initial: Theme; children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(initial)
  const [systemDark, setSystemDark] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    setSystemDark(media.matches)
    const onChange = () => setSystemDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark')
  }, [resolvedTheme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    if (next === 'system') setSystemDark(systemPrefersDark())
    document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax`
  }, [])

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
