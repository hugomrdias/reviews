import { describe, expect, it } from 'vitest'
import { linesOnPage } from '../anchoring/place'
import { linesAt, offsetsAt, pageText } from './page-text'

const doc = [
  '# FAQ', // 1
  '', // 2
  'Deploys run nightly. The release train leaves at **9am UTC**', // 3
  'and anything merged after that waits a day.', // 4
  '', // 5
  '```sh', // 6
  'make release', // 7
  '```', // 8
  '', // 9
  '- Hotfixes skip the train', // 10
].join('\n')

describe('offsetsAt', () => {
  const page = pageText(doc, 'docs/faq.md')
  const quote = (lines: [number, number]) => {
    const at = offsetsAt(page, ...lines)
    return at && page.text.slice(at.start, at.end)
  }

  it('finds the text of a heading', () => {
    expect(quote([1, 1])).toBe('FAQ')
  })

  it('finds one line of a paragraph that wraps in the source', () => {
    expect(quote([4, 4])).toBe('and anything merged after that waits a day.')
  })

  it('spans blocks for a range of lines', () => {
    expect(quote([3, 10])).toMatch(/^Deploys run nightly\..*Hotfixes skip the train$/s)
  })

  it('is null for lines without page text', () => {
    expect(offsetsAt(page, 2, 2)).toBeNull()
    expect(offsetsAt(page, 6, 8)).toBeNull()
  })

  it('maps back to the same lines', () => {
    for (const [start, end] of [[1, 1], [3, 3], [4, 4], [3, 4], [10, 10]]) {
      const at = offsetsAt(page, start, end)!
      expect(linesAt(page, at.start, at.end)).toEqual({ start, end })
    }
  })
})

describe('linesOnPage', () => {
  const page = pageText(doc, 'docs/faq.md')

  it('marks the text a line comment points at', () => {
    const at = linesOnPage(page, page.text, { start: 1, end: 1 })!
    expect(page.text.slice(at.start, at.end)).toBe('FAQ')
  })

  it("leaves line comments unmarked when the page text doesn't match the page", () => {
    expect(linesOnPage(page, `${page.text} (changed)`, { start: 1, end: 1 })).toBeUndefined()
    expect(linesOnPage(null, page.text, { start: 1, end: 1 })).toBeUndefined()
  })

  it('leaves line comments on a code block unmarked', () => {
    expect(linesOnPage(page, page.text, { start: 7, end: 7 })).toBeUndefined()
  })
})
