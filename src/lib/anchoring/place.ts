import { linesAt, type PageText } from '@/lib/markdown/page-text'
import type { ThreadView } from '@/lib/threads'
import { anchorLines } from './line-anchor'
import { anchorText, type AnchorState } from './text-anchor'

export interface Placement {
  state: AnchorState
  /** Source lines, 1-based and inclusive. Null when the text is gone. */
  lines: { start: number; end: number } | null
}

export interface PlaceOptions {
  /** The file's page text, for comments on the rendered page. Null for files that aren't markdown. */
  page: PageText | null
  /** The file as the thread's commit had it, for line comments written on another version. */
  oldSource?: string
}

/**
 * Where a thread is in a version of its file, in source lines, without a
 * browser. Line comments follow their lines; page comments are found in the
 * page text and mapped back to the lines they came from.
 */
export function placeThread(
  thread: ThreadView,
  file: { source: string; blobSha: string },
  { page, oldSource }: PlaceOptions,
): Placement {
  const { anchor } = thread
  const sameBlob = thread.blobSha === file.blobSha

  if (anchor.kind === 'lines') {
    const result = anchorLines(file.source, anchor, sameBlob, oldSource)
    return result.state === 'outdated'
      ? { state: 'outdated', lines: null }
      : { state: result.state, lines: { start: result.lineStart, end: result.lineEnd } }
  }

  // Unchanged file: the lines recorded from the selection still hold.
  if (sameBlob && anchor.lineStart !== null) {
    return { state: 'attached', lines: { start: anchor.lineStart, end: anchor.lineEnd ?? anchor.lineStart } }
  }
  if (!page) return { state: 'outdated', lines: null }
  const result = anchorText(page.text, anchor, sameBlob)
  return result.state === 'outdated'
    ? { state: 'outdated', lines: null }
    : { state: result.state, lines: linesAt(page, result.start, result.end) }
}
