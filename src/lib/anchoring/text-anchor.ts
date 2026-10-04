import type { AnchorData } from '../threads'
import { isCloseMatch, matchQuote } from './match-quote'

/**
 * - attached: the quoted text is still there.
 * - edited: something close is there; the text changed since the comment.
 * - outdated: the text is gone. The thread keeps its quote and commit.
 */
export type AnchorState = 'attached' | 'edited' | 'outdated'

export type TextAnchorResult =
  | { state: 'attached' | 'edited'; start: number; end: number }
  | { state: 'outdated' }

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

  // An exact copy wins; among several, the one whose context and position fit best.
  const match = matchQuote(text, quote, context)
  if (match?.errors === 0) return { state: 'attached', start: match.start, end: match.end }
  if (match && isCloseMatch(match, quote)) return { state: 'edited', start: match.start, end: match.end }
  return { state: 'outdated' }
}
