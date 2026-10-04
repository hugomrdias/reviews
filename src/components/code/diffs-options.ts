import { useMemo } from 'react'
import { useTheme } from '@/lib/theme'

/**
 * Theme options for @pierre/diffs. "system" follows the OS on both sides
 * (Diffs via color-scheme, the app via the theme script); explicit choices
 * are passed through so Diffs follows the app, not the OS.
 */
export function useDiffsTheme() {
  const { theme } = useTheme()
  return useMemo(
    () => ({
      theme: { dark: 'pierre-dark', light: 'pierre-light' } as const,
      themeType: theme,
      preferredHighlighter: 'shiki-js' as const,
    }),
    [theme],
  )
}

/** Shiki language ids for fence names GitHub accepts but Shiki spells differently. */
const LANG_ALIASES: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  console: 'shellsession',
  yml: 'yaml',
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  md: 'markdown',
  text: 'plaintext',
  txt: 'plaintext',
  plain: 'plaintext',
}

export function normalizeLang(lang: string | undefined) {
  if (!lang) return 'plaintext'
  const lower = lang.toLowerCase()
  return LANG_ALIASES[lower] ?? lower
}
