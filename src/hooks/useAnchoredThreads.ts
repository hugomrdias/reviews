import { useQueries } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { anchorLines, needsOldSource } from '@/lib/anchoring/line-anchor'
import { anchorText, type AnchorState } from '@/lib/anchoring/text-anchor'
import type { FileResult } from '@/functions/content'
import { blobTextQuery, fileQuery } from '@/lib/queries'
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

/** How to fetch the version a thread was written on: by its blob, or through the commit's tree for older threads without one. */
type OldSource = { key: string; blobSha: string } | { key: string; commitSha: string }

function oldSourceOf(thread: ThreadView): OldSource {
  return thread.blobSha
    ? { key: `blob:${thread.blobSha}`, blobSha: thread.blobSha }
    : { key: `commit:${thread.commitSha}`, commitSha: thread.commitSha }
}

/**
 * Places every thread on the current version of the file: attached where
 * its text still is, edited when the text changed a little, outdated when
 * it's gone. Line comments on older versions whose lines aren't found whole
 * diff against the old source, fetched by blob SHA (immutable, so cached
 * forever).
 */
export function useAnchoredThreads({ owner, repo, path, threads, blobSha, source, renderedText }: Options) {
  const oldVersions = useMemo(() => {
    // Callers pass an empty blob SHA while the file loads: nothing to place on yet.
    if (!blobSha) return []
    const byKey = new Map<string, OldSource>()
    for (const thread of threads) {
      if (!needsOldSource(source, thread.anchor, thread.blobSha === blobSha)) continue
      const old = oldSourceOf(thread)
      byKey.set(old.key, old)
    }
    return [...byKey.values()]
  }, [threads, blobSha, source])
  const combine = useCallback(
    (results: Array<{ data?: FileResult | string | null }>) => {
      const map = new Map<string, string>()
      results.forEach(({ data }, i) => {
        if (typeof data === 'string') map.set(oldVersions[i].key, data)
        else if (data?.kind === 'text') map.set(oldVersions[i].key, data.text)
      })
      return map
    },
    [oldVersions],
  )
  const oldSources = useQueries({
    queries: oldVersions.map((old) =>
      'blobSha' in old ? blobTextQuery(owner, repo, old.blobSha) : fileQuery(owner, repo, old.commitSha, path),
    ),
    combine,
  })

  return useMemo<AnchoredThread[]>(
    () =>
      threads.map((thread) => {
        const sameBlob = thread.blobSha === blobSha
        const { anchor } = thread
        if (anchor.kind === 'lines') {
          const result = anchorLines(source, anchor, sameBlob, oldSources.get(oldSourceOf(thread).key))
          return result.state === 'outdated'
            ? { thread, state: 'outdated' }
            : { thread, state: result.state, lines: { start: result.lineStart, end: result.lineEnd } }
        }
        if (renderedText !== null) {
          const result = anchorText(renderedText, anchor, sameBlob)
          return result.state === 'outdated'
            ? { thread, state: 'outdated' }
            : { thread, state: result.state, text: { start: result.start, end: result.end } }
        }
        // Source view: place rendered-text comments at their recorded lines
        // when the file hasn't changed; otherwise list them without a spot.
        if (sameBlob && anchor.lineStart !== null) {
          return {
            thread,
            state: 'attached',
            lines: { start: anchor.lineStart, end: anchor.lineEnd ?? anchor.lineStart },
          }
        }
        return { thread, state: 'unplaced' }
      }),
    [threads, blobSha, source, renderedText, oldSources],
  )
}
