import type { LineAnnotation } from '@pierre/diffs/react'
import { useMemo, useRef } from 'react'
import { DraftComposer } from '@/components/comments/Composer'
import { ThreadCard, type ThreadLocation } from '@/components/comments/ThreadCard'
import type { AnchoredThread } from '@/hooks/useAnchoredThreads'
import type { ThreadMutations } from '@/hooks/useThreadMutations'
import { linesAnchor } from '@/lib/anchoring/draft'
import { basename, isMarkdown } from '@/lib/paths'
import type { AnchorData } from '@/lib/threads'
import type { SessionUser } from '@/server/auth/session'
import { PlainCode } from './CodeBlock'
import { DiffsOnly, File } from './diffs'
import { useDiffsTheme } from './diffs-options'

type Note = { kind: 'thread'; anchored: AnchoredThread } | { kind: 'draft' }

interface SourceViewProps {
  source: string
  blobSha: string
  location: ThreadLocation
  anchored: AnchoredThread[]
  activeId: string | null
  onActivate: (id: string | null) => void
  draft: AnchorData | null
  onDraft: (anchor: AnchorData | null) => void
  onSubmitDraft: (body: string) => Promise<unknown>
  viewer: SessionUser | null
  mutations: ThreadMutations
}

/**
 * Raw file with line comments. Hover a line number and press "+" (or drag
 * across numbers) to comment on lines; threads open inline under them.
 */
export function SourceView({
  source,
  blobSha,
  location,
  anchored,
  activeId,
  onActivate,
  draft,
  onDraft,
  onSubmitDraft,
  viewer,
  mutations,
}: SourceViewProps) {
  const diffsTheme = useDiffsTheme()
  const sourceRef = useRef(source)
  sourceRef.current = source
  const onDraftRef = useRef(onDraft)
  onDraftRef.current = onDraft
  const onActivateRef = useRef(onActivate)
  onActivateRef.current = onActivate

  const file = useMemo(
    () => ({ name: basename(location.path), contents: source, cacheKey: `${blobSha}` }),
    [location.path, source, blobSha],
  )

  const options = useMemo(
    () => ({
      ...diffsTheme,
      disableFileHeader: true,
      overflow: isMarkdown(location.path) ? ('wrap' as const) : ('scroll' as const),
      lineHoverHighlight: 'both' as const,
      enableGutterUtility: Boolean(viewer) && mutations.permissions.comment,
      onGutterUtilityClick: (range: { start: number; end: number }) => {
        onDraftRef.current(linesAnchor(sourceRef.current, range.start, range.end))
      },
      // An open thread selects its lines, and a selection pins the "+" to it.
      // Clicking any line lets go of the thread, as clicking away does on the page.
      onLineClick: () => onActivateRef.current(null),
      // onLineClick makes Diffs give every line a pointer cursor; it's still text to read and select.
      unsafeCSS: '[data-interactive-lines] [data-line] { cursor: auto; }',
    }),
    [diffsTheme, location.path, viewer, mutations.permissions.comment],
  )

  const annotations = useMemo(() => {
    const list: LineAnnotation<Note>[] = []
    for (const a of anchored) {
      if (!a.lines || a.thread.status === 'resolved') continue
      list.push({ lineNumber: a.lines.end, metadata: { kind: 'thread', anchored: a } })
    }
    if (draft?.kind === 'lines' && draft.lineEnd) {
      list.push({ lineNumber: draft.lineEnd, metadata: { kind: 'draft' } })
    }
    return list
  }, [anchored, draft])

  const active = anchored.find((a) => a.thread.id === activeId)?.lines
  const selectedLines = useMemo(() => {
    if (draft?.kind === 'lines' && draft.lineStart && draft.lineEnd) {
      return { start: draft.lineStart, end: draft.lineEnd }
    }
    return active ? { start: active.start, end: active.end } : null
  }, [draft, active?.start, active?.end])

  return (
    <div className="overflow-hidden rounded-lg border bg-card" data-anchor-skip>
      <DiffsOnly fallback={<PlainCode code={source} />}>
        <File<Note>
          file={file}
          options={options}
          lineAnnotations={annotations}
          selectedLines={selectedLines}
          renderAnnotation={({ metadata }) => (
            <div className="max-w-2xl px-3 py-2 font-sans">
              {metadata.kind === 'draft' ? (
                <div className="rounded-r-md border-l-[3px] border-l-marker-strong bg-background py-2.5 pr-3 pl-3.5">
                  <DraftComposer
                    mutations={mutations}
                    placeholder={`Comment on ${draft?.lineStart === draft?.lineEnd ? `line ${draft?.lineStart}` : `lines ${draft?.lineStart}–${draft?.lineEnd}`}`}
                    onCancel={() => onDraft(null)}
                    onSubmit={onSubmitDraft}
                  />
                </div>
              ) : (
                <ThreadCard
                  inline
                  anchored={metadata.anchored}
                  location={location}
                  viewer={viewer}
                  mutations={mutations}
                  active={metadata.anchored.thread.id === activeId}
                  onActivate={() => onActivate(metadata.anchored.thread.id)}
                  className="bg-background"
                />
              )}
            </div>
          )}
        />
      </DiffsOnly>
    </div>
  )
}
