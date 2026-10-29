import { canUseWASM } from '@pierre/diffs'
import { bundledLanguages } from 'shiki/langs'
import { useMemo } from 'react'
import { useTheme } from '@/lib/theme'

export const DIFFS_THEMES = { dark: 'pierre-dark', light: 'pierre-light' } as const

/**
 * Highlights is Diffs' Wasm highlighter: every lexer is in one module, so
 * there's no grammar to fetch per language. Languages it lacks render as
 * plain text. It needs WebAssembly with SIMD, so browsers without it (Safari
 * before 16.4) or that block Wasm fall back to Shiki. Diffs runs one
 * highlighter type at a time, so every view must use the same one.
 */
export function preferredHighlighter() {
  return canUseWASM() ? ('highlights' as const) : ('shiki-js' as const)
}

/**
 * Theme and highlighter options for @pierre/diffs. "system" follows the OS on
 * both sides (Diffs via color-scheme, the app via the theme script); explicit
 * choices are passed through so Diffs follows the app, not the OS.
 */
export function useDiffsTheme() {
  const { theme } = useTheme()
  return useMemo(
    () => ({
      theme: DIFFS_THEMES,
      themeType: theme,
      preferredHighlighter: preferredHighlighter(),
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
}

/** Languages Diffs renders itself, without a Shiki grammar. */
const BUILT_IN_LANGS = new Set(['text', 'ansi'])

/**
 * The Diffs language for a fence name. Anything else Shiki doesn't bundle
 * (plain text, unknown names, typos) renders as 'text', which Diffs
 * shows unhighlighted instead of throwing.
 */
export function normalizeLang(lang: string | undefined) {
  if (!lang) return 'text'
  const lower = lang.toLowerCase()
  const name = LANG_ALIASES[lower] ?? lower
  return BUILT_IN_LANGS.has(name) || Object.hasOwn(bundledLanguages, name) ? name : 'text'
}
