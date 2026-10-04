import { useEffect } from 'react'
import { offsetsToRange, type TextIndex } from '@/lib/anchoring/text-index'
import type { AnchoredThread } from './useAnchoredThreads'

const NAMES = ['gr-comment', 'gr-comment-edited', 'gr-comment-active', 'gr-draft'] as const

function supported() {
  return typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined'
}

/**
 * Paints comment highlights with the CSS Custom Highlight API. Nothing in
 * the DOM changes, so it can't fight React or hydration. Browsers without
 * the API still get the margin notes, just no inline marks.
 */
export function useTextHighlights(
  index: TextIndex | null,
  anchored: AnchoredThread[],
  activeId: string | null,
  draft: { start: number; end: number } | null,
) {
  useEffect(() => {
    if (!index || !supported()) return
    const groups: Record<(typeof NAMES)[number], Range[]> = {
      'gr-comment': [],
      'gr-comment-edited': [],
      'gr-comment-active': [],
      'gr-draft': [],
    }
    for (const { thread, state, text } of anchored) {
      if (!text || thread.status === 'resolved') continue
      const range = offsetsToRange(index, text.start, text.end)
      if (!range) continue
      if (thread.id === activeId) groups['gr-comment-active'].push(range)
      else groups[state === 'edited' ? 'gr-comment-edited' : 'gr-comment'].push(range)
    }
    if (draft) {
      const range = offsetsToRange(index, draft.start, draft.end)
      if (range) groups['gr-draft'].push(range)
    }
    for (const name of NAMES) CSS.highlights.set(name, new Highlight(...groups[name]))
    return () => {
      for (const name of NAMES) CSS.highlights.delete(name)
    }
  }, [index, anchored, activeId, draft])
}
