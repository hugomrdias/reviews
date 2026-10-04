import approxSearch from 'approx-string-match'

// Fuzzy quote matching, following the approach Hypothesis uses to re-anchor
// annotations: find candidate matches for the quote, then score each by how
// well the quote, its surrounding context and its position agree.

export interface QuoteMatch {
  start: number
  end: number
  /** Edit distance between the quote and the matched text. */
  errors: number
  /** 0..1, higher is better. */
  score: number
}

interface RawMatch {
  start: number
  end: number
  errors: number
}

export function exactMatches(text: string, quote: string): RawMatch[] {
  const matches: RawMatch[] = []
  if (!quote) return matches
  let at = text.indexOf(quote)
  while (at !== -1) {
    matches.push({ start: at, end: at + quote.length, errors: 0 })
    at = text.indexOf(quote, at + 1)
  }
  return matches
}

function search(text: string, quote: string, maxErrors: number): RawMatch[] {
  const exact = exactMatches(text, quote)
  return exact.length > 0 ? exact : approxSearch(text, quote, maxErrors)
}

/** 0..1 similarity of `str` to the best match for it inside `text`. */
function similarity(text: string, str: string) {
  if (str.length === 0 || text.length === 0) return 0
  const matches = search(text, str, str.length)
  if (matches.length === 0) return 0
  return 1 - Math.min(...matches.map((m) => m.errors)) / str.length
}

export interface QuoteContext {
  prefix?: string
  suffix?: string
  /** Where the quote used to start; breaks ties between equal matches. */
  hint?: number | null
}

const QUOTE_WEIGHT = 50
const PREFIX_WEIGHT = 20
const SUFFIX_WEIGHT = 20
const POSITION_WEIGHT = 2
const MAX_SCORE = QUOTE_WEIGHT + PREFIX_WEIGHT + SUFFIX_WEIGHT + POSITION_WEIGHT

export function scoreMatch(text: string, quote: string, match: RawMatch, context: QuoteContext) {
  const quoteScore = 1 - match.errors / quote.length
  const prefixScore = context.prefix
    ? similarity(text.slice(Math.max(0, match.start - context.prefix.length), match.start), context.prefix)
    : 1
  const suffixScore = context.suffix
    ? similarity(text.slice(match.end, match.end + context.suffix.length), context.suffix)
    : 1
  const positionScore =
    typeof context.hint === 'number' && text.length > 0
      ? 1 - Math.abs(match.start - context.hint) / text.length
      : 1
  return (
    (QUOTE_WEIGHT * quoteScore +
      PREFIX_WEIGHT * prefixScore +
      SUFFIX_WEIGHT * suffixScore +
      POSITION_WEIGHT * positionScore) /
    MAX_SCORE
  )
}

/** The best match for `quote` in `text`, preferring exact copies, or null when nothing is close. */
export function matchQuote(text: string, quote: string, context: QuoteContext = {}): QuoteMatch | null {
  if (!quote) return null
  const maxErrors = Math.min(256, Math.floor(quote.length / 2))
  const candidates = search(text, quote, maxErrors)
  let best: QuoteMatch | null = null
  for (const candidate of candidates) {
    const score = scoreMatch(text, quote, candidate, context)
    if (!best || score > best.score) best = { ...candidate, score }
  }
  return best
}

/** Fuzzy matches above this share of errors count as gone, not edited. */
const MAX_ERROR_RATIO = 0.25
const MIN_SCORE = 0.5

/** Whether a fuzzy match is close enough to be the quoted text, edited, rather than something else. */
export function isCloseMatch(match: QuoteMatch, quote: string) {
  return match.errors <= quote.length * MAX_ERROR_RATIO && match.score >= MIN_SCORE
}
