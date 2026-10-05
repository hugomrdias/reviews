import { linesAt, offsetsAt, pageText, type PageText } from '@/lib/markdown/page-text'
import { isMarkdown } from '@/lib/paths'
import type { ThreadView } from '@/lib/threads'
import { anchorLines, type UnchangedLines } from './line-anchor'
import { anchorText, type AnchorState } from './text-anchor'

export interface Placement {
  state: AnchorState
  /** Source lines, 1-based and inclusive. Null when the text is gone. */
  lines: { start: number; end: number } | null
}

export interface PlaceOptions {
  /** The file's page text, for comments on the rendered page. Null for files that aren't markdown. */
  page: () => PageText | null
  /** The thread's version mapped onto this one, for line comments written on another version. */
  unchangedLines?: UnchangedLines
}

/** A file's page text, built at most once, and only when a page comment needs it. */
export function lazyPageText(path: string, source: string) {
  let page: PageText | null | undefined
  return () => (page === undefined ? (page = isMarkdown(path) ? pageText(source, path) : null) : page)
}

/**
 * Where a line comment sits in the rendered page: the text its lines render
 * to. The page text is built without a browser, so it's only used while it
 * matches the DOM's. Undefined when it doesn't, or the lines show no text.
 */
export function linesOnPage(page: PageText | null, renderedText: string, lines: { start: number; end: number }) {
  if (page?.text !== renderedText) return undefined
  return offsetsAt(page, lines.start, lines.end) ?? undefined
}

/** Where a line comment is in a version of its file: it follows its lines. */
export function placeLines(
  thread: ThreadView,
  file: { source: string; blobSha: string },
  unchangedLines?: UnchangedLines,
): Placement {
  const result = anchorLines(file.source, thread.anchor, thread.blobSha === file.blobSha, unchangedLines)
  return result.state === 'outdated'
    ? { state: 'outdated', lines: null }
    : { state: result.state, lines: { start: result.lineStart, end: result.lineEnd } }
}

/** A page comment's lines as recorded from the selection, which hold while the file is unchanged. */
export function recordedLines(thread: ThreadView, blobSha: string): Placement['lines'] {
  const { anchor } = thread
  if (thread.blobSha !== blobSha || anchor.lineStart === null) return null
  return { start: anchor.lineStart, end: anchor.lineEnd ?? anchor.lineStart }
}

/**
 * Where a thread is in a version of its file, in source lines, without a
 * browser. Line comments follow their lines; page comments are found in the
 * page text and mapped back to the lines they came from.
 */
export function placeThread(
  thread: ThreadView,
  file: { source: string; blobSha: string },
  { page, unchangedLines }: PlaceOptions,
): Placement {
  if (thread.anchor.kind === 'lines') return placeLines(thread, file, unchangedLines)

  const recorded = recordedLines(thread, file.blobSha)
  if (recorded) return { state: 'attached', lines: recorded }
  const text = page()
  if (!text) return { state: 'outdated', lines: null }
  const result = anchorText(text.text, thread.anchor, thread.blobSha === file.blobSha)
  return result.state === 'outdated'
    ? { state: 'outdated', lines: null }
    : { state: result.state, lines: linesAt(text, result.start, result.end) }
}
