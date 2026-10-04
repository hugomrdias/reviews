// Fixture repo for the dev-only /dev/preview route: real-looking docs and
// threads in every anchoring state, so the viewer can be designed and
// checked without a GitHub App.
import type { ThreadView } from '@/lib/threads'
import type { SessionUser } from '@/server/auth/session'

export const OWNER = 'acme'
export const REPO = 'handbook'
export const REF = 'main'
export const SHA = '3f9c21a8d4e5b6c7d8e9f0a1b2c3d4e5f6a7b8c9'
export const OLD_SHA = '9b1e44c0aa77de1f2b3c4d5e6f708192a3b4c5d6'
export const DOC = 'docs/release-process.md'
export const BLOB = 'b'.repeat(40)
export const OLD_BLOB = 'c'.repeat(40)

export const viewer: SessionUser = {
  id: 1,
  login: 'hugomrdias',
  name: 'Hugo Dias',
  avatarUrl: 'https://avatars.githubusercontent.com/u/314190?v=4',
}

const maya = { id: 2, login: 'maya', name: 'Maya Lindqvist', avatarUrl: null }
const tom = { id: 3, login: 'tomasz', name: 'Tomasz Nowak', avatarUrl: null }

export const paths = [
  'README.md',
  'CONTRIBUTING.md',
  'docs/README.md',
  'docs/release-process.md',
  'docs/on-call.md',
  'docs/architecture/overview.md',
  'docs/architecture/storage.md',
  'docs/rfcs/0001-feature-flags.md',
  'docs/rfcs/0002-regional-deploys.md',
  'scripts/release.sh',
  'scripts/lib/semver.ts',
  'package.json',
]

export const releaseProcess = `# Release process

How code gets from \`main\` to production, who signs off, and what to do when it goes wrong.

> [!NOTE]
> This page replaces the old wiki article. If something here contradicts the wiki, this page wins.

## The release train

Deploys run nightly. The release train leaves at 9am UTC and anything merged after that waits a day. Hotfixes skip the train but need two approvals from the [on-call rotation](./on-call.md).

Each train gets a version number from the date, so the Tuesday train on 6 October is \`2026.10.06\`. Tags are created by the release script, never by hand.

### Before the train leaves

1. Merge your change to \`main\` with a green build.
2. Add a line to \`CHANGELOG.md\` under *Unreleased*.
3. If the change needs a migration, mark the pull request with the \`migration\` label so the release captain runs it first.

## Running a release

The release captain runs the script from a clean checkout:

\`\`\`bash
git switch main && git pull --ff-only
./scripts/release.sh --train "$(date -u +%Y.%m.%d)"
\`\`\`

The script builds, tags, and promotes the build to staging. After the smoke tests pass on staging, it asks for confirmation before promoting to production.

| Stage | Who | Time limit |
|---|---|---|
| Staging smoke tests | Release captain | 30 minutes |
| Production canary | Release captain | 1 hour at 5% |
| Full rollout | Automatic | 2 hours |

> [!WARNING]
> Never promote a build that skipped staging, even for a hotfix. The canary is not a substitute.

## Rolling back

If error rates rise during the canary, roll back first and investigate second. Rolling back is always safe because every release is backwards compatible with the previous schema.

See [storage](architecture/storage.md) for how schema changes are staged across two releases.
`

const quote = (text: string, q: string) => {
  const i = text.indexOf(q)
  return {
    quoteExact: q,
    quotePrefix: text.slice(Math.max(0, i - 32), i),
    quoteSuffix: text.slice(i + q.length, i + q.length + 32),
  }
}

const now = Date.now()
const hours = (n: number) => now - n * 3600_000

/**
 * Text quotes are taken from the rendered text, not the markdown source, so
 * offsets are left null and found by quote matching.
 */
export const threads: ThreadView[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    path: DOC,
    commitSha: SHA,
    blobSha: BLOB,
    anchor: {
      kind: 'text',
      ...quote(releaseProcess, 'The release train leaves at 9am UTC'),
      textStart: null,
      textEnd: null,
      lineStart: 10,
      lineEnd: 10,
    },
    status: 'open',
    resolvedBy: null,
    resolvedAt: null,
    author: maya,
    createdAt: hours(3),
    updatedAt: hours(2),
    comments: [
      {
        id: 'c1',
        author: maya,
        body: 'Most of the team is in Lisbon now. Could the train leave at **10am** instead?',
        createdAt: hours(3),
        editedAt: null,
        deleted: false,
      },
      {
        id: 'c2',
        author: tom,
        body: 'Fine by me, but the APAC folks lose an hour. Worth asking in #releases first.',
        createdAt: hours(2),
        editedAt: null,
        deleted: false,
      },
    ],
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    path: DOC,
    commitSha: OLD_SHA,
    blobSha: OLD_BLOB,
    anchor: {
      kind: 'text',
      quoteExact: 'Rolling back is always safe because every release is compatible with the previous schema',
      quotePrefix: 'roll back first and investigate second. ',
      quoteSuffix: '.\n\nSee storage for how',
      textStart: null,
      textEnd: null,
      lineStart: 44,
      lineEnd: 44,
    },
    status: 'open',
    resolvedBy: null,
    resolvedAt: null,
    author: tom,
    createdAt: hours(30),
    updatedAt: hours(30),
    comments: [
      {
        id: 'c3',
        author: tom,
        body: '"Always" is doing a lot of work here. What about data written by the new release?',
        createdAt: hours(30),
        editedAt: null,
        deleted: false,
      },
    ],
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    path: DOC,
    commitSha: OLD_SHA,
    blobSha: OLD_BLOB,
    anchor: {
      kind: 'text',
      quoteExact: 'Release captains rotate weekly and are picked from the backend team',
      quotePrefix: '',
      quoteSuffix: '',
      textStart: null,
      textEnd: null,
      lineStart: 14,
      lineEnd: 14,
    },
    status: 'open',
    resolvedBy: null,
    resolvedAt: null,
    author: maya,
    createdAt: hours(72),
    updatedAt: hours(72),
    comments: [
      {
        id: 'c4',
        author: maya,
        body: 'Frontend folks want in on this too.',
        createdAt: hours(72),
        editedAt: null,
        deleted: false,
      },
    ],
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    path: DOC,
    commitSha: SHA,
    blobSha: BLOB,
    anchor: {
      kind: 'text',
      ...quote(releaseProcess, 'Tags are created by the release script, never by hand'),
      textStart: null,
      textEnd: null,
      lineStart: 12,
      lineEnd: 12,
    },
    status: 'resolved',
    resolvedBy: viewer,
    resolvedAt: hours(1),
    author: viewer,
    createdAt: hours(20),
    updatedAt: hours(1),
    comments: [
      {
        id: 'c5',
        author: viewer,
        body: 'Should we link to the script?',
        createdAt: hours(20),
        editedAt: null,
        deleted: false,
      },
    ],
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    path: DOC,
    commitSha: SHA,
    blobSha: BLOB,
    anchor: {
      kind: 'lines',
      quoteExact: 'git switch main && git pull --ff-only\n./scripts/release.sh --train "$(date -u +%Y.%m.%d)"',
      quotePrefix: '',
      quoteSuffix: '',
      textStart: null,
      textEnd: null,
      lineStart: 25,
      lineEnd: 26,
    },
    status: 'open',
    resolvedBy: null,
    resolvedAt: null,
    author: tom,
    createdAt: hours(5),
    updatedAt: hours(5),
    comments: [
      {
        id: 'c6',
        author: tom,
        body: 'The script should refuse to run on a dirty tree instead of relying on people to check.',
        createdAt: hours(5),
        editedAt: null,
        deleted: false,
      },
    ],
  },
]

export const oldReleaseProcess = releaseProcess
  .replace('every release is backwards compatible', 'every release is compatible')
  .replace(
    '### Before the train leaves',
    'Release captains rotate weekly and are picked from the backend team.\n\n### Before the train leaves',
  )

export const commits = [
  { sha: SHA, message: 'Move release docs out of the wiki', authorName: 'Maya Lindqvist', authorLogin: 'maya', avatarUrl: null, date: new Date(hours(4)).toISOString() },
  { sha: OLD_SHA, message: 'Draft release process', authorName: 'Tomasz Nowak', authorLogin: 'tomasz', avatarUrl: null, date: new Date(hours(80)).toISOString() },
]
