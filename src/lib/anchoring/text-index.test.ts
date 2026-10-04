// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { buildTextIndex, offsetsToRange, rangeToOffsets } from './text-index'

function doc(html: string) {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

describe('text index', () => {
  const root = doc('<p>Hello <em>brave</em> world</p><pre data-anchor-skip>skip</pre><p>again</p>')
  const index = buildTextIndex(root)

  it('indexes text in document order, skipping code blocks', () => {
    expect(index.text).toBe('Hello brave worldagain')
    expect(index.nodes.map((n) => n.start)).toEqual([0, 6, 11, 17])
  })

  it('maps offsets to ranges and back', () => {
    for (const [start, end] of [
      [0, 5],
      [6, 11],
      [3, 15],
      [17, 22],
      [0, 22],
    ]) {
      const range = offsetsToRange(index, start, end)!
      expect(range.toString().replace('skip', '')).toBe(index.text.slice(start, end))
      expect(rangeToOffsets(index, range, root)).toEqual({ start, end })
    }
  })

  it('starts a range at a node boundary in the next node and ends it in the previous one', () => {
    const range = offsetsToRange(index, 6, 11)!
    expect(range.startContainer.textContent).toBe('brave')
    expect(range.endContainer.textContent).toBe('brave')
  })

  it('maps an element boundary to the next indexed text', () => {
    const range = document.createRange()
    const em = root.querySelector('em')!
    range.setStart(em.parentNode!, 1)
    range.setEnd(root, root.childNodes.length)
    expect(rangeToOffsets(index, range, root)).toEqual({ start: 6, end: 22 })
  })
})
