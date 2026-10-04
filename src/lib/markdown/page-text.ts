import type { Element, Root, RootContent } from 'hast'
import { markdownToHast } from './pipeline'
import { ALERT_LABELS, ALERT_TYPES, type AlertType } from './plugins'

// The text of a rendered markdown page, without a browser: what the page's
// text index (anchoring/text-index.ts) reads from the DOM, so offsets in one
// mean the same in the other. Each piece remembers its source line, which
// turns a quote found in the text back into lines of the file.

export interface PageText {
  text: string
  /** Text pieces in document order, where each starts in `text` and on which source line. */
  pieces: Array<{ start: number; line: number }>
}

// react-markdown drops whitespace-only text directly inside these, as React requires.
const TABLE_ELEMENTS = new Set(['table', 'tbody', 'thead', 'tfoot', 'tr'])
const WHITESPACE = /^[ \t\n\f\r]*$/

function isAlert(value: unknown): value is AlertType {
  return typeof value === 'string' && (ALERT_TYPES as readonly string[]).includes(value)
}

export function pageText(source: string, path: string): PageText {
  const tree = markdownToHast(source, path) as Root
  const page: PageText = { text: '', pieces: [] }

  const add = (value: string, line: number) => {
    page.pieces.push({ start: page.text.length, line })
    page.text += value
  }

  const walk = (node: Root | Element, line: number) => {
    const table = node.type === 'element' && TABLE_ELEMENTS.has(node.tagName)
    for (const child of node.children as RootContent[]) {
      const at = child.position?.start.line ?? line
      if (child.type === 'text' || child.type === 'raw') {
        if (table && WHITESPACE.test(child.value)) continue
        add(child.value, at)
      } else if (child.type === 'element') {
        // Code blocks and diagrams render outside the text index ([data-anchor-skip]).
        if (child.tagName === 'pre' && child.children.some((c) => c.type === 'element' && c.tagName === 'code')) continue
        // Alerts render their title above the text.
        if (child.tagName === 'blockquote' && isAlert(child.properties.dataAlert)) {
          add(ALERT_LABELS[child.properties.dataAlert], at)
        }
        walk(child, at)
      }
    }
  }

  walk(tree, 1)
  return page
}

/** The source line of an offset in the page text. */
function lineAt(page: PageText, offset: number) {
  const { pieces } = page
  if (pieces.length === 0) return 1
  // The last piece that starts at or before the offset.
  let lo = 0
  let hi = pieces.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1
    if (pieces[mid].start <= offset) lo = mid
    else hi = mid - 1
  }
  const piece = pieces[lo]
  // A soft line break stays a newline in the text, so count those within the piece.
  let line = piece.line
  for (let i = piece.start; i < offset; i++) if (page.text.charCodeAt(i) === 10) line++
  return line
}

/** Source lines covered by the page text between two offsets, 1-based and inclusive. */
export function linesAt(page: PageText, start: number, end: number) {
  return { start: lineAt(page, start), end: lineAt(page, Math.max(start, end - 1)) }
}
