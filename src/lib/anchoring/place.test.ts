import { describe, expect, it } from 'vitest'
import { pageText } from '../markdown/page-text'
import type { AnchorData, ThreadView } from '../threads'
import { unchangedLines } from './line-anchor'
import { placeThread } from './place'

const OLD = 'a'.repeat(40)
const NEW = 'b'.repeat(40)
const PATH = 'docs/releases.md'

const doc = [
  '# Releases', // 1
  '', // 2
  'Deploys run nightly. The release train leaves at **9am UTC**', // 3
  'and anything merged after that waits a day.', // 4
  '', // 5
  '- Hotfixes skip the train', // 6
  '- but need *two* approvals', // 7
  '', // 8
  '| Step | Owner |', // 9
  '|------|-------|', // 10
  '| Tag  | release script |', // 11
].join('\n')

function thread(anchor: Partial<AnchorData>, blobSha = OLD): ThreadView {
  return {
    id: 't',
    path: PATH,
    commitSha: OLD,
    blobSha,
    anchor: {
      kind: 'text',
      quoteExact: '',
      quotePrefix: '',
      quoteSuffix: '',
      textStart: null,
      textEnd: null,
      lineStart: null,
      lineEnd: null,
      ...anchor,
    },
    status: 'open',
    resolvedBy: null,
    resolvedAt: null,
    addressed: null,
    author: { id: 1, login: 'maya', name: null, avatarUrl: null },
    createdAt: 0,
    updatedAt: 0,
    comments: [],
  }
}

function place(t: ThreadView, source: string, oldSource?: string) {
  return placeThread(
    t,
    { source, blobSha: NEW },
    { page: () => pageText(source, PATH), unchangedLines: oldSource === undefined ? undefined : unchangedLines(oldSource, source) },
  )
}

describe('placeThread: page comments', () => {
  it('keeps recorded lines while the file is unchanged', () => {
    const t = thread({ quoteExact: 'anything', lineStart: 4, lineEnd: 4 }, NEW)
    expect(place(t, doc)).toEqual({ state: 'attached', lines: { start: 4, end: 4 } })
  })

  it('finds quotes across markdown syntax in a changed file', () => {
    const moved = `Intro.\n\n${doc}`
    expect(place(thread({ quoteExact: 'leaves at 9am UTC' }), moved)).toEqual({
      state: 'attached',
      lines: { start: 5, end: 5 },
    })
  })

  it('spans soft line breaks', () => {
    expect(place(thread({ quoteExact: '9am UTC\nand anything' }), doc).lines).toEqual({ start: 3, end: 4 })
  })

  it('places text in lists and tables on their own lines', () => {
    expect(place(thread({ quoteExact: 'need two approvals' }), doc).lines).toEqual({ start: 7, end: 7 })
    expect(place(thread({ quoteExact: 'release script' }), doc).lines).toEqual({ start: 11, end: 11 })
  })

  it('marks reworded text as edited', () => {
    const quote = 'The release train leaves at 9am UTC and anything merged after that waits a day.'
    const reworded = doc.replace('waits a day', 'waits until tomorrow')
    expect(place(thread({ quoteExact: quote }), reworded)).toEqual({ state: 'edited', lines: { start: 3, end: 4 } })
  })

  it('marks removed text as outdated', () => {
    expect(place(thread({ quoteExact: 'Release captains rotate weekly' }), doc)).toEqual({
      state: 'outdated',
      lines: null,
    })
  })

  it('treats page comments on files that are not markdown as outdated', () => {
    const t = thread({ quoteExact: 'anything' })
    expect(placeThread(t, { source: doc, blobSha: NEW }, { page: () => null })).toEqual({ state: 'outdated', lines: null })
  })
})

describe('placeThread: line comments', () => {
  it('follows lines that moved', () => {
    const t = thread({ kind: 'lines', quoteExact: '- Hotfixes skip the train', lineStart: 6, lineEnd: 6 })
    expect(place(t, `Intro.\n\n${doc}`, doc)).toEqual({ state: 'attached', lines: { start: 8, end: 8 } })
  })
})
