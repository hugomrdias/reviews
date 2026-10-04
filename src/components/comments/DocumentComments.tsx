import { MessageSquarePlus } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { MarkdownView, type RepoContext } from '@/components/markdown/MarkdownView'
import type { AnchoredThread } from '@/hooks/useAnchoredThreads'
import type { ThreadMutations } from '@/hooks/useThreadMutations'
import { useTextHighlights } from '@/hooks/useTextHighlights'
import { selectionLines, textAnchor } from '@/lib/anchoring/draft'
import { buildTextIndex, offsetsToRange, rangeToOffsets, type TextIndex } from '@/lib/anchoring/text-index'
import type { AnchorData } from '@/lib/threads'
import type { SessionUser } from '@/server/auth/session'
import { Composer } from './Composer'
import { ThreadCard, type ThreadLocation } from './ThreadCard'

const GAP = 12

interface MarginItem {
  id: string
  desired: number
  node: ReactNode
}

/** Stacks notes next to their text without overlapping; the active one sits exactly beside its text. */
function layoutMargin(items: MarginItem[], heights: Map<string, number>, activeId: string | null) {
  const sorted = [...items].sort((a, b) => a.desired - b.desired)
  const tops = new Map<string, number>()
  if (sorted.length === 0) return tops
  const height = (id: string) => heights.get(id) ?? 80
  const pivot = Math.max(0, sorted.findIndex((i) => i.id === activeId))
  const pos: number[] = []
  pos[pivot] = sorted[pivot].desired
  for (let i = pivot + 1; i < sorted.length; i++) {
    pos[i] = Math.max(sorted[i].desired, pos[i - 1] + height(sorted[i - 1].id) + GAP)
  }
  for (let i = pivot - 1; i >= 0; i--) {
    pos[i] = Math.min(sorted[i].desired, pos[i + 1] - height(sorted[i].id) - GAP)
  }
  const shift = pos[0] < 0 ? -pos[0] : 0
  sorted.forEach((item, i) => tops.set(item.id, pos[i] + shift))
  return tops
}

function caretOffset(index: TextIndex, x: number, y: number) {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  let node: Node | null = null
  let offset = 0
  const position = doc.caretPositionFromPoint?.(x, y)
  if (position) {
    node = position.offsetNode
    offset = position.offset
  } else {
    const range = doc.caretRangeFromPoint?.(x, y)
    if (range) {
      node = range.startContainer
      offset = range.startOffset
    }
  }
  const entry = node && index.nodes.find((n) => n.node === node)
  return entry ? entry.start + offset : null
}

interface DocumentCommentsProps {
  source: string
  ctx: RepoContext
  location: ThreadLocation
  index: TextIndex | null
  onIndex: (index: TextIndex) => void
  anchored: AnchoredThread[]
  activeId: string | null
  onActivate: (id: string | null) => void
  draft: AnchorData | null
  onDraft: (anchor: AnchorData | null) => void
  onSubmitDraft: (body: string) => Promise<unknown>
  viewer: SessionUser | null
  mutations: ThreadMutations
  /** Show notes in the margin. Off on narrow screens, where a drawer is used. */
  showMargin: boolean
}

/**
 * The rendered document with its margin. Select text to comment; comments
 * are marked in the text and sit beside it in the margin.
 */
export function DocumentComments({
  source,
  ctx,
  location,
  index,
  onIndex,
  anchored,
  activeId,
  onActivate,
  draft,
  onDraft,
  onSubmitDraft,
  viewer,
  mutations,
  showMargin,
}: DocumentCommentsProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<HTMLDivElement>(null)
  const [selection, setSelection] = useState<{ top: number; left: number; anchor: AnchorData } | null>(null)
  const [desired, setDesired] = useState(new Map<string, number>())
  const [heights, setHeights] = useState(new Map<string, number>())

  // Index the rendered text once React has committed the markdown.
  useLayoutEffect(() => {
    if (docRef.current) onIndex(buildTextIndex(docRef.current))
  }, [source, ctx, onIndex])

  const draftOffsets =
    draft?.kind === 'text' && draft.textStart !== null && draft.textEnd !== null
      ? { start: draft.textStart, end: draft.textEnd }
      : null
  useTextHighlights(index, anchored, activeId, draftOffsets)

  const onPage = anchored.filter(
    (a) => a.thread.status === 'open' && (a.state === 'attached' || a.state === 'edited') && (a.text || a.lines),
  )

  // Where each note wants to sit: level with the top of its text.
  const measure = useCallback(() => {
    const root = rootRef.current
    const doc = docRef.current
    if (!root || !doc || !index) return
    const rootTop = root.getBoundingClientRect().top
    const next = new Map<string, number>()
    for (const { thread, text, lines } of onPage) {
      let top: number | null = null
      if (text) {
        const range = offsetsToRange(index, text.start, text.end)
        const rect = range?.getClientRects()[0]
        if (rect) top = rect.top - rootTop
      } else if (lines) {
        const blocks = [...doc.querySelectorAll<HTMLElement>('[data-sline]')]
        const block = blocks.find(
          (el) => Number(el.dataset.sline) <= lines.start && Number(el.dataset.eline) >= lines.start,
        )
        if (block) top = block.getBoundingClientRect().top - rootTop
      }
      if (top !== null) next.set(thread.id, top)
    }
    if (draftOffsets) {
      const rect = offsetsToRange(index, draftOffsets.start, draftOffsets.end)?.getClientRects()[0]
      if (rect) next.set('draft', rect.top - rootTop)
    }
    setDesired(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, onPage.map((a) => `${a.thread.id}:${a.text?.start}:${a.lines?.start}`).join(), draftOffsets?.start])

  useLayoutEffect(() => {
    measure()
    const doc = docRef.current
    if (!doc) return
    // Images loading and window resizes move the text; follow it.
    const observer = new ResizeObserver(() => measure())
    observer.observe(doc)
    return () => observer.disconnect()
  }, [measure])

  // Note heights, for stacking.
  const noteObserver = useRef<ResizeObserver | null>(null)
  useEffect(() => {
    noteObserver.current = new ResizeObserver((entries) => {
      setHeights((prev) => {
        const next = new Map(prev)
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.marginId
          if (id) next.set(id, entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height)
        }
        return next
      })
    })
    return () => noteObserver.current?.disconnect()
  }, [])
  const observeNote = useCallback((el: HTMLElement | null) => {
    if (el) noteObserver.current?.observe(el)
  }, [])

  // Offer "Comment" for selections inside the document.
  const canComment = Boolean(viewer) && mutations.permissions.comment
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const update = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const root = rootRef.current
        const doc = docRef.current
        const sel = window.getSelection()
        if (!root || !doc || !index || !canComment || !sel || sel.isCollapsed || sel.rangeCount === 0) {
          setSelection(null)
          return
        }
        const range = sel.getRangeAt(0)
        if (!doc.contains(range.commonAncestorContainer)) {
          setSelection(null)
          return
        }
        const offsets = rangeToOffsets(index, range, doc)
        const anchor = offsets && textAnchor(index.text, offsets.start, offsets.end, selectionLines(range))
        if (!anchor) {
          setSelection(null)
          return
        }
        const rect = range.getBoundingClientRect()
        const rootRect = root.getBoundingClientRect()
        setSelection({
          anchor,
          top: rect.top - rootRect.top,
          left: Math.min(Math.max(rect.left + rect.width / 2 - rootRect.left, 48), doc.clientWidth - 48),
        })
      }, 120)
    }
    document.addEventListener('selectionchange', update)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('selectionchange', update)
    }
  }, [index, canComment])

  const startDraft = () => {
    if (!selection) return
    onDraft(selection.anchor)
    onActivate(null)
    window.getSelection()?.removeAllRanges()
    setSelection(null)
  }

  // Clicking marked text opens its thread.
  const onDocClick = (event: React.MouseEvent) => {
    if (!index || (window.getSelection()?.isCollapsed === false)) return
    if ((event.target as HTMLElement).closest('a,button,input,summary')) return
    const offset = caretOffset(index, event.clientX, event.clientY)
    if (offset === null) return
    const hits = onPage
      .filter((a) => a.text && a.text.start <= offset && offset <= a.text.end)
      .sort((a, b) => a.text!.end - a.text!.start - (b.text!.end - b.text!.start))
    if (hits.length > 0) onActivate(hits[0].thread.id)
    else if (activeId) onActivate(null)
  }

  const items: MarginItem[] = []
  if (showMargin && index) {
    for (const a of onPage) {
      const top = desired.get(a.thread.id)
      if (top === undefined) continue
      items.push({
        id: a.thread.id,
        desired: top,
        node: (
          <ThreadCard
            inline
            anchored={a}
            location={location}
            viewer={viewer}
            mutations={mutations}
            active={a.thread.id === activeId}
            onActivate={() => onActivate(a.thread.id)}
          />
        ),
      })
    }
    const draftTop = desired.get('draft')
    if (draft?.kind === 'text' && draftTop !== undefined) {
      items.push({
        id: 'draft',
        desired: draftTop,
        node: (
          <div className="rounded-r-md border-l-[3px] border-l-marker-strong bg-card py-2.5 pr-3 pl-3.5 shadow-[0_1px_3px_rgb(27_34_48/0.08),0_8px_24px_-12px_rgb(27_34_48/0.18)]">
            <Composer
              placeholder="Add a comment"
              submitLabel="Comment"
              autoFocus
              pending={mutations.create.isPending}
              onCancel={() => onDraft(null)}
              onSubmit={onSubmitDraft}
            />
          </div>
        ),
      })
    }
  }
  const tops = layoutMargin(items, heights, draft ? 'draft' : activeId)
  const marginHeight = Math.max(0, ...items.map((i) => (tops.get(i.id) ?? 0) + (heights.get(i.id) ?? 80)))

  return (
    <div ref={rootRef} className="relative flex gap-10 xl:gap-14">
      <div ref={docRef} className="doc min-w-0 flex-1" onClick={onDocClick}>
        <MarkdownView source={source} ctx={ctx} />
      </div>

      {showMargin && (
        <aside aria-label="Comments" className="relative w-72 shrink-0 xl:w-80" style={{ minHeight: marginHeight }}>
          {items.map((item) => (
            <div
              key={item.id}
              ref={observeNote}
              data-margin-id={item.id}
              className="absolute inset-x-0 transition-[top] duration-200 ease-out motion-reduce:transition-none"
              style={{ top: tops.get(item.id) ?? item.desired }}
            >
              {item.node}
            </div>
          ))}
        </aside>
      )}

      {selection && (
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-full pb-2"
          style={{ top: selection.top, left: selection.left }}
        >
          <Button
            size="sm"
            className="shadow-lg"
            onMouseDown={(e) => e.preventDefault()}
            onClick={startDraft}
          >
            <MessageSquarePlus />
            Comment
          </Button>
        </div>
      )}
    </div>
  )
}
