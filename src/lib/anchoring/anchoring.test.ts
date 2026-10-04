import { describe, expect, it } from 'vitest'
import type { AnchorData } from '../threads'
import { anchorLines, mapUnchangedLines, quoteLines, unchangedLines } from './line-anchor'
import { anchorText } from './text-anchor'

const original =
  'Deploys run nightly. The release train leaves at 9am UTC and anything merged after that waits a day. ' +
  'Hotfixes skip the train but need two approvals.'

function textAnchor(text: string, quote: string): AnchorData {
  const start = text.indexOf(quote)
  return {
    kind: 'text',
    quoteExact: quote,
    quotePrefix: text.slice(Math.max(0, start - 32), start),
    quoteSuffix: text.slice(start + quote.length, start + quote.length + 32),
    textStart: start,
    textEnd: start + quote.length,
    lineStart: null,
    lineEnd: null,
  }
}

describe('anchorText', () => {
  const quote = 'The release train leaves at 9am UTC'
  const anchor = textAnchor(original, quote)

  it('keeps comments on unchanged text', () => {
    expect(anchorText(original, anchor, true)).toEqual({
      state: 'attached',
      start: anchor.textStart,
      end: anchor.textEnd,
    })
  })

  it('follows text that moved', () => {
    const moved = 'New intro paragraph that pushes everything down. ' + original
    const result = anchorText(moved, anchor, false)
    expect(result.state).toBe('attached')
    if (result.state !== 'outdated') expect(moved.slice(result.start, result.end)).toBe(quote)
  })

  it('marks lightly reworded text as edited', () => {
    const edited = original.replace('9am UTC', '10am UTC')
    const result = anchorText(edited, anchor, false)
    expect(result.state).toBe('edited')
    if (result.state !== 'outdated') expect(edited.slice(result.start, result.end)).toContain('release train')
  })

  it('marks removed text as outdated', () => {
    const removed = 'Deploys run continuously now. Every merge ships within the hour.'
    expect(anchorText(removed, anchor, false)).toEqual({ state: 'outdated' })
  })

  it('picks the duplicate whose context matches', () => {
    const text = 'Step one: run the tests. Then deploy. Step two: run the tests. Then celebrate.'
    const second = text.lastIndexOf('run the tests')
    const dup: AnchorData = {
      ...textAnchor(text, 'run the tests'),
      quotePrefix: 'Step two: ',
      quoteSuffix: '. Then celebrate.',
      textStart: second,
      textEnd: second + 'run the tests'.length,
    }
    const shifted = 'Intro. ' + text
    const result = anchorText(shifted, dup, false)
    expect(result.state).toBe('attached')
    if (result.state !== 'outdated') expect(result.start).toBe(second + 'Intro. '.length)
  })
})

describe('anchorLines', () => {
  const oldSource = ['# Title', '', 'alpha', 'beta', 'gamma', '', 'end'].join('\n')
  const anchor: AnchorData = {
    kind: 'lines',
    quoteExact: quoteLines(oldSource, 3, 4),
    quotePrefix: '',
    quoteSuffix: '',
    textStart: null,
    textEnd: null,
    lineStart: 3,
    lineEnd: 4,
  }

  it('keeps lines when the blob is unchanged', () => {
    expect(anchorLines(oldSource, anchor, true)).toEqual({ state: 'attached', lineStart: 3, lineEnd: 4 })
  })

  it('follows lines pushed down by an insertion', () => {
    const inserted = ['# Title', '', 'new line', 'another', 'alpha', 'beta', 'gamma', '', 'end'].join('\n')
    expect(anchorLines(inserted, anchor, false, unchangedLines(oldSource, inserted))).toEqual({
      state: 'attached',
      lineStart: 5,
      lineEnd: 6,
    })
  })

  it('marks an edited range as edited', () => {
    const edited = ['# Title', '', 'alpha', 'betas', 'gamma', '', 'end'].join('\n')
    const result = anchorLines(edited, anchor, false, unchangedLines(oldSource, edited))
    expect(result.state).toBe('edited')
  })

  it('marks deleted lines as outdated', () => {
    const deleted = ['# Title', '', 'gamma', '', 'end'].join('\n')
    expect(anchorLines(deleted, anchor, false, unchangedLines(oldSource, deleted))).toEqual({ state: 'outdated' })
  })
})

describe('mapUnchangedLines', () => {
  it('maps unchanged lines across an edit', () => {
    const map = mapUnchangedLines('a\nb\nc\n', 'a\nx\nb\nc\n')
    expect(map.get(1)).toBe(1)
    expect(map.get(2)).toBe(3)
    expect(map.get(3)).toBe(4)
  })
})
