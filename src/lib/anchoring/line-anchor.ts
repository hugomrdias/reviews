import { diffLines } from 'diff'
import type { AnchorData } from '../threads'
import { exactMatches, matchQuote } from './match-quote'
import type { AnchorState } from './text-anchor'

export type LineAnchorResult =
  | { state: Exclude<AnchorState, 'outdated'>; lineStart: number; lineEnd: number }
  | { state: 'outdated' }

const MAX_ERROR_RATIO = 0.25
const MIN_SCORE = 0.5

/** The lines a line comment covers, joined: what gets stored as its quote. */
export function quoteLines(source: string, start: number, end: number) {
  return source.split('\n').slice(start - 1, end).join('\n')
}

/** 1-based line number of a character offset. */
export function lineAt(text: string, offset: number) {
  let line = 1
  for (let i = 0; i < offset && i < text.length; i++) if (text.charCodeAt(i) === 10) line++
  return line
}

function lineOffset(text: string, line: number) {
  let offset = 0
  for (let l = 1; l < line; l++) {
    const next = text.indexOf('\n', offset)
    if (next === -1) return text.length
    offset = next + 1
  }
  return offset
}

function isLineStart(text: string, offset: number) {
  return offset === 0 || text[offset - 1] === '\n'
}

function isLineEnd(text: string, offset: number) {
  return offset === text.length || text[offset] === '\n' || text[offset] === '\r'
}

/**
 * Maps each unchanged line in `oldText` to its line number in `newText`.
 * Lines that were edited or removed are missing from the map.
 */
export function mapUnchangedLines(oldText: string, newText: string) {
  const map = new Map<number, number>()
  let oldLine = 1
  let newLine = 1
  for (const change of diffLines(oldText, newText)) {
    const count = change.count ?? change.value.split('\n').length - 1
    if (change.added) {
      newLine += count
    } else if (change.removed) {
      oldLine += count
    } else {
      for (let i = 0; i < count; i++) map.set(oldLine + i, newLine + i)
      oldLine += count
      newLine += count
    }
  }
  return map
}

/** The quoted lines found whole in the source, nearest the old position; null when they aren't. */
function exactLines(source: string, anchor: AnchorData) {
  const start = anchor.lineStart ?? 1
  const span = (anchor.lineEnd ?? start) - start
  const exact = exactMatches(source, anchor.quoteExact).filter(
    (m) => isLineStart(source, m.start) && isLineEnd(source, m.end),
  )
  if (exact.length === 0) return null
  // Several identical blocks: take the one nearest the old position.
  const lines = exact.map((m) => lineAt(source, m.start))
  const nearest = lines.reduce((a, b) => (Math.abs(b - start) < Math.abs(a - start) ? b : a))
  return { lineStart: nearest, lineEnd: nearest + span }
}

/**
 * Whether placing a line comment would use the source it was written on:
 * only when its blob changed and its quote isn't found whole. Lets callers
 * skip fetching old versions they don't need.
 */
export function needsOldSource(source: string, anchor: AnchorData, sameBlob: boolean) {
  return anchor.kind === 'lines' && !sameBlob && exactLines(source, anchor) === null
}

/** Places a line comment in the current source. */
export function anchorLines(
  source: string,
  anchor: AnchorData,
  sameBlob: boolean,
  oldSource?: string,
): LineAnchorResult {
  const start = anchor.lineStart ?? 1
  const end = anchor.lineEnd ?? start
  if (sameBlob) return { state: 'attached', lineStart: start, lineEnd: end }

  const exact = exactLines(source, anchor)
  if (exact) return { state: 'attached', ...exact }

  const quote = anchor.quoteExact
  const span = end - start
  if (oldSource !== undefined) {
    const map = mapUnchangedLines(oldSource, source)
    const mapped = Array.from({ length: span + 1 }, (_, i) => map.get(start + i))
    if (mapped.every((l) => l !== undefined)) {
      return { state: 'attached', lineStart: mapped[0]!, lineEnd: mapped[span]! }
    }
  }

  const fuzzy = matchQuote(source, quote, { hint: lineOffset(source, start) })
  if (fuzzy && fuzzy.errors <= quote.length * MAX_ERROR_RATIO && fuzzy.score >= MIN_SCORE) {
    return { state: 'edited', lineStart: lineAt(source, fuzzy.start), lineEnd: lineAt(source, Math.max(fuzzy.start, fuzzy.end - 1)) }
  }
  return { state: 'outdated' }
}
