// Maps between DOM ranges and character offsets in a container's text.
// Code blocks are skipped ([data-anchor-skip]): they render inside Shadow
// DOM and only after hydration, so their text can't be part of offsets.

export interface TextIndex {
  text: string
  /** In document order, so `start` only grows. */
  nodes: Array<{ node: Text; start: number }>
  /** Where each node starts, for direct lookups. */
  starts: Map<Text, number>
}

export const SKIP_SELECTOR = '[data-anchor-skip]'

export function buildTextIndex(root: Element): TextIndex {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest(SKIP_SELECTOR) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  })
  const nodes: TextIndex['nodes'] = []
  const starts = new Map<Text, number>()
  let text = ''
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push({ node: node as Text, start: text.length })
    starts.set(node as Text, text.length)
    text += (node as Text).data
  }
  return { text, nodes, starts }
}

/** The first index in [0, length) where `test` holds, or `length`. `test` must go false → true once. */
function firstWhere(length: number, test: (i: number) => boolean) {
  let lo = 0
  let hi = length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (test(mid)) hi = mid
    else lo = mid + 1
  }
  return lo
}

/** Where a text node starts in the index, or null when it isn't indexed. */
export function nodeStart(index: TextIndex, node: Node) {
  return index.starts.get(node as Text) ?? null
}

/** Offset of a DOM boundary point, or null when it's outside indexed text. */
function pointToOffset(index: TextIndex, container: Node, offset: number, root: Element): number | null {
  if (container.nodeType === Node.TEXT_NODE) {
    const start = nodeStart(index, container)
    return start === null ? null : start + Math.min(offset, (container as Text).data.length)
  }
  // Element boundary: the point sits before child `offset`. Use the first
  // indexed text node at or after it.
  const range = document.createRange()
  range.setStart(container, offset)
  range.collapse(true)
  const i = firstWhere(index.nodes.length, (j) => range.comparePoint(index.nodes[j].node, 0) >= 0)
  if (i < index.nodes.length) return index.nodes[i].start
  return root.contains(container) ? index.text.length : null
}

export function rangeToOffsets(index: TextIndex, range: Range, root: Element) {
  const start = pointToOffset(index, range.startContainer, range.startOffset, root)
  const end = pointToOffset(index, range.endContainer, range.endOffset, root)
  if (start === null || end === null || end <= start) return null
  return { start, end }
}

function locate(index: TextIndex, offset: number, preferNext: boolean) {
  const { nodes } = index
  if (nodes.length === 0) return null
  // The first node that ends after the offset (or at it, unless the next
  // node is preferred), falling back to the last node.
  const end = (i: number) => nodes[i].start + nodes[i].node.data.length
  const i = Math.min(
    firstWhere(nodes.length, (j) => (preferNext ? end(j) > offset : end(j) >= offset)),
    nodes.length - 1,
  )
  const { node, start } = nodes[i]
  return { node, offset: Math.max(0, Math.min(offset - start, node.data.length)) }
}

export function offsetsToRange(index: TextIndex, start: number, end: number): Range | null {
  const from = locate(index, start, true)
  const to = locate(index, end, false)
  if (!from || !to) return null
  const range = document.createRange()
  range.setStart(from.node, from.offset)
  range.setEnd(to.node, to.offset)
  return range
}
