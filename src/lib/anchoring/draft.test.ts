// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { pageText } from '../markdown/page-text'
import { quoteSourceLines, selectionLines, textAnchor } from './draft'
import { buildTextIndex, offsetsToRange, rangeToOffsets } from './text-index'

function doc(html: string) {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('textAnchor', () => {
  it('reads lines from the trimmed quote, not a selection that runs into the next block', () => {
    const root = doc(
      '<p data-sline="5" data-eline="5">A full backup takes three hours.</p>\n<h2 data-sline="7" data-eline="7">Where do I report bugs?</h2>',
    )
    const index = buildTextIndex(root)

    // A triple-click on the paragraph ends at the start of the heading.
    const range = document.createRange()
    range.setStart(root.querySelector('p')!.firstChild!, 0)
    range.setEnd(root.querySelector('h2')!, 0)
    expect(selectionLines(range)).toEqual({ start: 5, end: 7 })

    const offsets = rangeToOffsets(index, range, root)!
    const anchor = textAnchor(index.text, offsets.start, offsets.end, (start, end) => {
      const quoted = offsetsToRange(index, start, end)
      return quoted && selectionLines(quoted)
    })

    expect(anchor).toMatchObject({ quoteExact: 'A full backup takes three hours.', lineStart: 5, lineEnd: 5 })
  })
})

describe('quoteSourceLines', () => {
  // A paragraph written over two source lines, rendered the way the page renders it.
  const source = 'Deploys run nightly.\nAnything merged later waits a day.'
  const html = '<p data-sline="1" data-eline="2">Deploys run nightly.\nAnything merged later waits a day.</p>'
  const quote = 'Anything merged later'

  it('gives the exact line of a quote inside a paragraph that wraps in the source', () => {
    const index = buildTextIndex(doc(html))
    const start = index.text.indexOf(quote)
    expect(quoteSourceLines(pageText(source, 'a.md'), index, start, start + quote.length)).toEqual({ start: 2, end: 2 })
  })

  it("falls back to the blocks' lines when the page text doesn't match the page", () => {
    const index = buildTextIndex(doc(html))
    const start = index.text.indexOf(quote)
    const stale = pageText('Something else entirely.', 'a.md')
    expect(quoteSourceLines(stale, index, start, start + quote.length)).toEqual({ start: 1, end: 2 })
    expect(quoteSourceLines(null, index, start, start + quote.length)).toEqual({ start: 1, end: 2 })
  })
})
