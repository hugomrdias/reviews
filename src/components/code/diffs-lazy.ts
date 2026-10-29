import { getHighlighterOptions, preloadHighlighter } from '@pierre/diffs'
import { DIFFS_THEMES, preferredHighlighter } from './diffs-options'

export { File, MultiFileDiff } from '@pierre/diffs/react'

/**
 * Diffs paints nothing until the highlighter and themes have loaded, so they
 * load with this chunk. If it fails, Diffs loads them again on render and
 * reports the error there.
 */
export const highlighterReady = preloadHighlighter(
  getHighlighterOptions(undefined, { theme: DIFFS_THEMES, preferredHighlighter: preferredHighlighter() }),
).catch(() => {})
