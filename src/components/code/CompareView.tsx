import type { DiffLineAnnotation } from '@pierre/diffs/react'
import { useMemo } from 'react'
import { ThreadCard, type ThreadLocation } from '@/components/comments/ThreadCard'
import { Skeleton } from '@/components/ui/skeleton'
import type { AnchoredThread } from '@/hooks/useAnchoredThreads'
import type { ThreadMutations } from '@/hooks/useThreadMutations'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { isMarkdown } from '@/lib/paths'
import type { SessionUser } from '@/server/auth/session'
import { DiffsOnly, MultiFileDiff } from './diffs'
import { useDiffsTheme } from './diffs-options'

interface CompareViewProps {
  path: string
  base: { sha: string; text: string | null }
  head: { sha: string; text: string | null }
  /** Threads placed on the head version and on the base version. */
  onHead: AnchoredThread[]
  onBase: AnchoredThread[]
  location: ThreadLocation
  activeId: string | null
  onActivate: (id: string | null) => void
  viewer: SessionUser | null
  mutations: ThreadMutations
}

/**
 * What changed in this file between two commits. A thread shows on the new
 * side where its text still exists, otherwise on the old side where it was
 * written.
 */
export function CompareView({
  path,
  base,
  head,
  onHead,
  onBase,
  location,
  activeId,
  onActivate,
  viewer,
  mutations,
}: CompareViewProps) {
  const diffsTheme = useDiffsTheme()
  const wide = useMediaQuery('(min-width: 1024px)')
  const name = path.split('/').pop() ?? 'file'

  const oldFile = useMemo(
    () => (base.text === null ? null : { name, contents: base.text, cacheKey: `${base.sha}:${path}` }),
    [name, base.text, base.sha, path],
  )
  const newFile = useMemo(
    () => (head.text === null ? null : { name, contents: head.text, cacheKey: `${head.sha}:${path}` }),
    [name, head.text, head.sha, path],
  )

  const options = useMemo(
    () => ({
      ...diffsTheme,
      diffStyle: wide ? ('split' as const) : ('unified' as const),
      lineDiffType: 'word' as const,
      overflow: isMarkdown(path) ? ('wrap' as const) : ('scroll' as const),
      hunkSeparators: 'line-info' as const,
    }),
    [diffsTheme, wide, path],
  )

  const annotations = useMemo(() => {
    const list: DiffLineAnnotation<AnchoredThread>[] = []
    const placed = new Set<string>()
    for (const a of onHead) {
      if (!a.lines || a.thread.status === 'resolved' || a.state === 'outdated' || a.state === 'unplaced') continue
      list.push({ side: 'additions', lineNumber: a.lines.end, metadata: a })
      placed.add(a.thread.id)
    }
    for (const a of onBase) {
      if (placed.has(a.thread.id) || !a.lines || a.thread.status === 'resolved') continue
      if (a.state === 'outdated' || a.state === 'unplaced') continue
      list.push({ side: 'deletions', lineNumber: a.lines.end, metadata: a })
    }
    return list
  }, [onHead, onBase])

  if (!oldFile && !newFile) {
    return <p className="text-sm text-muted-foreground">This file doesn't exist at either commit.</p>
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card" data-anchor-skip>
      <DiffsOnly fallback={<Skeleton className="h-96 w-full" />}>
        <MultiFileDiff<AnchoredThread>
          oldFile={oldFile ?? { name, contents: '' }}
          newFile={newFile ?? { name, contents: '' }}
          options={options}
          lineAnnotations={annotations}
          renderAnnotation={({ metadata }) => (
            <div className="max-w-xl px-3 py-2 font-sans">
              <ThreadCard
                inline
                anchored={metadata}
                location={location}
                viewer={viewer}
                mutations={mutations}
                active={metadata.thread.id === activeId}
                onActivate={() => onActivate(metadata.thread.id)}
                className="bg-background"
              />
            </div>
          )}
        />
      </DiffsOnly>
    </div>
  )
}
