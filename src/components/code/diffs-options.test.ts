import { realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { normalizeLang } from './diffs-options'

describe('normalizeLang', () => {
  it('maps GitHub fence names to Shiki languages', () => {
    expect(normalizeLang('ts')).toBe('typescript')
    expect(normalizeLang('Shell')).toBe('bash')
    expect(normalizeLang('rust')).toBe('rust')
  })

  it('keeps the languages Diffs renders itself', () => {
    expect(normalizeLang('ansi')).toBe('ansi')
    expect(normalizeLang('text')).toBe('text')
  })

  it('falls back to text for anything Shiki lacks', () => {
    expect(normalizeLang(undefined)).toBe('text')
    expect(normalizeLang('plaintext')).toBe('text')
    expect(normalizeLang('not-a-language')).toBe('text')
  })
})

describe('shiki', () => {
  // normalizeLang checks our shiki's language list, but Diffs loads grammars
  // from its own. Bump the shiki pin with @pierre/diffs so they stay one copy.
  it('is the copy @pierre/diffs uses', () => {
    const require = createRequire(import.meta.url)
    // Its exports hide package.json, so start from the installed folder.
    const diffs = createRequire(realpathSync('node_modules/@pierre/diffs/package.json'))
    expect(require('shiki/package.json').version).toBe(diffs('shiki/package.json').version)
  })
})
