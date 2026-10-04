import { describe, expect, it } from 'vitest'
import type { AnchoredThread } from '@/hooks/useAnchoredThreads'
import { sourceLines, threadsForAgent } from './agent-prompt'
import type { AnchorData, CommentView, ThreadView } from './threads'

const BLOB = 'b'.repeat(40)
const SHA = 'a'.repeat(40)

const source = [
  '# Releases', // 1
  '', // 2
  'The release train leaves at **9am UTC** every weekday.', // 3
  '', // 4
  '```sh', // 5
  './scripts/release.sh', // 6
  '```', // 7
].join('\n')

const maya = { id: 1, login: 'maya', name: null, avatarUrl: null }

function comment(body: string, extra: Partial<CommentView> = {}): CommentView {
  return { id: body, author: maya, body, via: null, createdAt: 0, editedAt: null, deleted: false, ...extra }
}

function anchor(extra: Partial<AnchorData>): AnchorData {
  return {
    kind: 'text',
    quoteExact: '',
    quotePrefix: '',
    quoteSuffix: '',
    textStart: null,
    textEnd: null,
    lineStart: null,
    lineEnd: null,
    ...extra,
  }
}

function thread(id: string, a: AnchorData, comments: CommentView[], extra: Partial<ThreadView> = {}): ThreadView {
  return {
    id,
    path: 'docs/releases.md',
    commitSha: SHA,
    blobSha: BLOB,
    anchor: a,
    status: 'open',
    resolvedBy: null,
    resolvedAt: null,
    author: maya,
    createdAt: 0,
    updatedAt: 0,
    comments,
    ...extra,
  }
}

const textThread = thread('t1', anchor({ quoteExact: 'leaves at 9am UTC', lineStart: 3, lineEnd: 3 }), [
  comment('Could it be **10am**?'),
])

describe('sourceLines', () => {
  it('uses the placed lines when there are any', () => {
    expect(sourceLines({ thread: textThread, state: 'attached', lines: { start: 9, end: 9 } }, source, BLOB)).toEqual({
      start: 9,
      end: 9,
    })
  })

  it('trusts recorded lines while the file is unchanged', () => {
    expect(sourceLines({ thread: textThread, state: 'attached' }, source, BLOB)).toEqual({ start: 3, end: 3 })
  })

  it('finds rendered quotes in changed markdown source', () => {
    const moved = `Intro.\n\n${source}`
    expect(sourceLines({ thread: textThread, state: 'attached' }, moved, 'c'.repeat(40))).toEqual({ start: 5, end: 5 })
  })

  it('gives up on outdated threads', () => {
    expect(sourceLines({ thread: textThread, state: 'outdated' }, source, BLOB)).toBeNull()
  })
})

describe('threadsForAgent', () => {
  const linesThread = thread(
    'l1',
    anchor({ kind: 'lines', quoteExact: './scripts/release.sh', lineStart: 6, lineEnd: 6 }),
    [comment('Check for a dirty tree.'), comment('Done.', { via: 'Claude Code' }), comment('gone', { deleted: true })],
  )
  const resolved = thread('r1', anchor({ quoteExact: 'Releases', lineStart: 1, lineEnd: 1 }), [comment('ok')], {
    status: 'resolved',
  })
  const threads: AnchoredThread[] = [
    { thread: linesThread, state: 'attached', lines: { start: 6, end: 6 } },
    { thread: resolved, state: 'attached' },
    { thread: textThread, state: 'edited' },
  ]

  const output = threadsForAgent({
    repo: 'acme/docs',
    ref: 'main',
    sha: SHA,
    path: 'docs/releases.md',
    source,
    blobSha: BLOB,
    threads,
    threadUrl: (id) => `https://reviews.test/acme/docs/main/docs/releases.md?thread=${id}`,
  })

  it('lists open threads in file order, with their comments', () => {
    expect(output.slice(0, output.indexOf('\n\n## How to handle these'))).toBe(
      [
        '# Review comments on docs/releases.md',
        `2 open threads on \`docs/releases.md\` in https://github.com/acme/docs, at \`main\` (commit ${SHA}). ` +
          "Make the changes in your local checkout of acme/docs. If your working directory isn't one, stop and say so. " +
          'Paths are relative to the repository root. Line numbers refer to that commit. ' +
          'If your checkout is at a different commit, look for the quote near that line instead.',
        'Each thread quotes the text it is about, then lists its comments, oldest first. ' +
          'Quotes in a code block are exact lines of the file. Other quotes come from the rendered page, so they leave out ' +
          'markdown syntax: a quote of `9am UTC` can be `**9am UTC**` in the file.',
        '## Open threads',
        '### 1. docs/releases.md:3',
        '> leaves at 9am UTC',
        '_The text changed after this comment. The quote is what it said then._',
        '**maya**:\n\nCould it be **10am**?',
        'Thread: https://reviews.test/acme/docs/main/docs/releases.md?thread=t1',
        '### 2. docs/releases.md:6',
        '```\n./scripts/release.sh\n```',
        '**maya**:\n\nCheck for a dirty tree.',
        '**maya** (via Claude Code):\n\nDone.',
        'Thread: https://reviews.test/acme/docs/main/docs/releases.md?thread=l1',
      ].join('\n\n'),
    )
  })

  it('lists threads whose text is gone last, numbered on', () => {
    const gone = thread('g1', anchor({ quoteExact: 'Captains rotate weekly' }), [comment('Frontend too.')])
    const out = threadsForAgent({
      repo: 'acme/docs',
      ref: 'main',
      sha: SHA,
      path: 'docs/releases.md',
      source,
      blobSha: BLOB,
      threads: [{ thread: gone, state: 'outdated' }, ...threads],
      threadUrl: (id) => id,
    })
    const sections = out.split('\n\n').filter((part) => part.startsWith('#'))
    expect(sections).toEqual([
      '# Review comments on docs/releases.md',
      '## Open threads',
      '### 1. docs/releases.md:3',
      '### 2. docs/releases.md:6',
      '## May already be addressed',
      '### 3. docs/releases.md (text removed)',
      '## How to handle these',
    ])
  })

  it('leaves out empty sections', () => {
    const out = threadsForAgent({
      repo: 'acme/docs',
      ref: 'main',
      sha: SHA,
      path: 'docs/releases.md',
      source,
      blobSha: BLOB,
      threads: [{ thread: linesThread, state: 'attached', lines: { start: 6, end: 6 } }],
      threadUrl: (id) => id,
    })
    expect(out).toContain('1 open thread on')
    expect(out).not.toContain('## May already be addressed')
  })

  it('fences code quotes longer than any backtick run inside them', () => {
    const quote = 'use ```sh fences'
    const out = threadsForAgent({
      repo: 'acme/docs',
      ref: SHA,
      sha: SHA,
      path: 'a.md',
      source: quote,
      blobSha: BLOB,
      threads: [
        {
          thread: thread('x', anchor({ kind: 'lines', quoteExact: quote, lineStart: 1, lineEnd: 1 }), []),
          state: 'attached',
          lines: { start: 1, end: 1 },
        },
      ],
      threadUrl: (id) => id,
    })
    expect(out).toContain('````\nuse ```sh fences\n````')
    expect(out).toContain(`at commit ${SHA}.`)
  })
})
