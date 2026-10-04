import { useQueries } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { unchangedLines } from '@/lib/anchoring/line-anchor'
import { placeLines, recordedLines } from '@/lib/anchoring/place'
import { anchorText, type AnchorState } from '@/lib/anchoring/text-anchor'
import type { FileResult } from '@/functions/content'
import { fileQuery } from '@/lib/queries'
import type { ThreadView } from '@/lib/threads'

export type PlacedState = AnchorState | 'unplaced'

export interface AnchoredThread {
  thread: ThreadView
  /** "unplaced": a rendered-text comment viewed somewhere it can't be placed. */
  state: PlacedState
  /** Offsets into the rendered text. */
  text?: { start: number; end: number }
  /** Source lines, 1-based inclusive. */
  lines?: { start: number; end: number }
}

interface Options {
  owner: string
  repo: string
  path: string
  threads: ThreadView[]
  /** Blob SHA of the file being viewed. */
  blobSha: string
  /** Raw source of the file being viewed. */
  source: string
  /** Rendered text of the document, when viewing rendered markdown. */
  renderedText: string | null
}

/**
 * Places every thread on the current version of the file: attached where
 * its text still is, edited when the text changed a little, outdated when
 * it's gone. Line comments on older versions diff against the old source,
 * fetched once per commit (immutable, so cached forever).
 */
export function useAnchoredThreads({ owner, repo, path, threads, blobSha, source, renderedText }: Options) {
  const oldCommits = useMemo(
    () => [
      ...new Set(
        threads.filter((t) => t.anchor.kind === 'lines' && t.blobSha !== blobSha).map((t) => t.commitSha),
      ),
    ],
    [threads, blobSha],
  )
  const combine = useCallback(
    (results: Array<{ data?: FileResult }>) => {
      const map = new Map<string, string>()
      results.forEach((result, i) => {
        if (result.data?.kind === 'text') map.set(oldCommits[i], result.data.text)
      })
      return map
    },
    [oldCommits],
  )
  const oldSources = useQueries({
    queries: oldCommits.map((sha) => fileQuery(owner, repo, sha, path)),
    combine,
  })

  return useMemo<AnchoredThread[]>(() => {
    const file = { source, blobSha }
    // One diff per old commit, shared by its threads, and only if one needs it.
    const unchanged = new Map([...oldSources].map(([sha, old]) => [sha, unchangedLines(old, source)]))
    return threads.map((thread) => {
      if (thread.anchor.kind === 'lines') {
        const { state, lines } = placeLines(thread, file, unchanged.get(thread.commitSha))
        return lines ? { thread, state, lines } : { thread, state }
      }
      if (renderedText !== null) {
        const result = anchorText(renderedText, thread.anchor, thread.blobSha === blobSha)
        return result.state === 'outdated'
          ? { thread, state: 'outdated' }
          : { thread, state: result.state, text: { start: result.start, end: result.end } }
      }
      // Source view: place rendered-text comments at their recorded lines
      // when the file hasn't changed; otherwise list them without a spot.
      const lines = recordedLines(thread, blobSha)
      return lines ? { thread, state: 'attached', lines } : { thread, state: 'unplaced' }
    })
  }, [threads, blobSha, source, renderedText, oldSources])
}
