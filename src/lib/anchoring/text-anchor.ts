import type { AnchorData } from '../threads'
import { exactMatches, matchQuote, scoreMatch } from './match-quote'

/**
 * - attached: the quoted text is still there.
 * - edited: something close is there; the text changed since the comment.
 * - outdated: the text is gone. The thread keeps its quote and commit.
 */
export type AnchorState = 'attached' | 'edited' | 'outdated'

export type TextAnchorResult =
  | { state: 'attached' | 'edited'; start: number; end: number }
  | { state: 'outdated' }

/** Fuzzy matches above this share of errors count as gone, not edited. */
const MAX_ERROR_RATIO = 0.25
const MIN_SCORE = 0.5

/** Places a text-selection comment in the current rendered text. */
export function anchorText(text: string, anchor: AnchorData, sameBlob: boolean): TextAnchorResult {
  const quote = anchor.quoteExact
  const context = { prefix: anchor.quotePrefix, suffix: anchor.quoteSuffix, hint: anchor.textStart }

  // Same file content and the stored offsets still hold.
  if (
    sameBlob &&
    anchor.textStart !== null &&
    anchor.textEnd !== null &&
    text.slice(anchor.textStart, anchor.textEnd) === quote
  ) {
    return { state: 'attached', start: anchor.textStart, end: anchor.textEnd }
  }

  const exact = exactMatches(text, quote)
  if (exact.length === 1) return { state: 'attached', start: exact[0].start, end: exact[0].end }
  if (exact.length > 1) {
    let best = exact[0]
    let bestScore = -1
    for (const m of exact) {
      const score = scoreMatch(text, quote, m, context)
      if (score > bestScore) {
        best = m
        bestScore = score
      }
    }
    return { state: 'attached', start: best.start, end: best.end }
  }

  const fuzzy = matchQuote(text, quote, context)
  if (fuzzy && fuzzy.errors <= quote.length * MAX_ERROR_RATIO && fuzzy.score >= MIN_SCORE) {
    return { state: 'edited', start: fuzzy.start, end: fuzzy.end }
  }
  return { state: 'outdated' }
}
