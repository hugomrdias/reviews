// Maps between DOM ranges and character offsets in a container's text.
// Code blocks are skipped ([data-anchor-skip]): they render inside Shadow
// DOM and only after hydration, so their text can't be part of offsets.

export interface TextIndex {
  text: string
  nodes: Array<{ node: Text; start: number }>
}

export const SKIP_SELECTOR = '[data-anchor-skip]'

export function buildTextIndex(root: Element): TextIndex {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest(SKIP_SELECTOR) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  })
  const nodes: TextIndex['nodes'] = []
  let text = ''
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push({ node: node as Text, start: text.length })
    text += (node as Text).data
  }
  return { text, nodes }
}

/** Offset of a DOM boundary point, or null when it's outside indexed text. */
function pointToOffset(index: TextIndex, container: Node, offset: number, root: Element): number | null {
  if (container.nodeType === Node.TEXT_NODE) {
    const entry = index.nodes.find((n) => n.node === container)
    return entry ? entry.start + Math.min(offset, (container as Text).data.length) : null
  }
  // Element boundary: the point sits before child `offset`. Use the first
  // indexed text node at or after it.
  const range = document.createRange()
  range.setStart(container, offset)
  range.collapse(true)
  for (const entry of index.nodes) {
    const position = range.comparePoint(entry.node, 0)
    if (position >= 0) return entry.start
  }
  return root.contains(container) ? index.text.length : null
}

export function rangeToOffsets(index: TextIndex, range: Range, root: Element) {
  const start = pointToOffset(index, range.startContainer, range.startOffset, root)
  const end = pointToOffset(index, range.endContainer, range.endOffset, root)
  if (start === null || end === null || end <= start) return null
  return { start, end }
}

function locate(index: TextIndex, offset: number, preferNext: boolean) {
  for (let i = 0; i < index.nodes.length; i++) {
    const { node, start } = index.nodes[i]
    const end = start + node.data.length
    if (offset < end || (offset === end && !preferNext) || i === index.nodes.length - 1) {
      return { node, offset: Math.max(0, Math.min(offset - start, node.data.length)) }
    }
  }
  return null
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
