import { CONTEXT_LENGTH, MAX_QUOTE_LENGTH, type AnchorData } from '../threads'
import { quoteLines } from './line-anchor'

/** Builds the anchor for a selection in the rendered text. */
export function textAnchor(
  text: string,
  rawStart: number,
  rawEnd: number,
  lines: { start: number; end: number } | null,
): AnchorData | null {
  let start = rawStart
  let end = Math.min(rawEnd, rawStart + MAX_QUOTE_LENGTH)
  // Trim surrounding whitespace so the quote starts and ends on words.
  while (start < end && /\s/.test(text[start])) start++
  while (end > start && /\s/.test(text[end - 1])) end--
  if (end <= start) return null
  return {
    kind: 'text',
    quoteExact: text.slice(start, end),
    quotePrefix: text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    quoteSuffix: text.slice(end, end + CONTEXT_LENGTH),
    textStart: start,
    textEnd: end,
    lineStart: lines?.start ?? null,
    lineEnd: lines?.end ?? null,
  }
}

/** Builds the anchor for a range of source lines. */
export function linesAnchor(source: string, start: number, end: number): AnchorData | null {
  const [from, to] = start <= end ? [start, end] : [end, start]
  const quote = quoteLines(source, from, to).slice(0, MAX_QUOTE_LENGTH)
  if (!quote.trim()) return null
  return {
    kind: 'lines',
    quoteExact: quote,
    quotePrefix: '',
    quoteSuffix: '',
    textStart: null,
    textEnd: null,
    lineStart: from,
    lineEnd: to,
  }
}

/** Source lines a DOM selection came from, read from data-sline/data-eline. */
export function selectionLines(range: Range): { start: number; end: number } | null {
  const element = (node: Node) => (node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement)
  const startEl = element(range.startContainer)?.closest('[data-sline]')
  const endEl = element(range.endContainer)?.closest('[data-eline]')
  const start = Number(startEl?.getAttribute('data-sline'))
  const end = Number(endEl?.getAttribute('data-eline'))
  if (!start || !end) return null
  return { start: Math.min(start, end), end: Math.max(start, end) }
}
