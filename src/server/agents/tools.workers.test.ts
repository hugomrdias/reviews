/// <reference types="@cloudflare/vitest-pool-workers/types" />
import { beforeEach, describe, expect, it } from 'vitest'
import type { AnchorData } from '@/lib/threads'
import * as store from '../comments/store'
import { getDb } from '../db/client'
import { users } from '../db/schema'
import type { RepoAccess } from '../github/access'
import { NotFoundError } from '../github/client'
import * as tools from './tools'

const OLD = 'a'.repeat(40)
const HEAD = 'b'.repeat(40)
const FIX = 'f'.repeat(40)
const PATH = 'docs/plan.md'

const maya = { id: 1, login: 'maya', name: null, avatarUrl: null }
const hugo = { id: 2, login: 'hugo', name: null, avatarUrl: null }

const oldDoc = ['# Plan', '', 'Ship on **Friday** after the review.', '', '```sh', 'make deploy', '```'].join('\n')
const headDoc = ['# Plan', '', 'Intro added later.', '', 'Ship on **Friday** after the review.', '', '```sh', 'make deploy', '```'].join(
  '\n',
)

let repo: RepoAccess
let repoId = 100

/** GitHub reads the tools made, as "file <sha> <path>" and "blob <sha>". */
let reads: string[] = []

const blobOf = (sha: string, path: string) => `blob:${sha}:${path}`

function reader(files: Record<string, Record<string, string>>, commits: string[] = []): tools.RepoReader {
  return {
    access: async (owner, name) => {
      if (`${owner}/${name}` !== repo.fullName) throw new NotFoundError('no', 404)
      return repo
    },
    resolveRef: async (_, ref) => ({ ref, sha: ref === 'main' ? HEAD : ref }),
    file: async (_, sha, path) => {
      reads.push(`file ${sha} ${path}`)
      const source = files[sha]?.[path]
      return source === undefined ? null : { source, blobSha: blobOf(sha, path) }
    },
    blob: async (_, blobSha) => {
      reads.push(`blob ${blobSha}`)
      for (const [sha, paths] of Object.entries(files)) {
        for (const [path, source] of Object.entries(paths)) if (blobOf(sha, path) === blobSha) return source
      }
      return null
    },
    commit: async (_, sha) => commits.find((c) => c.startsWith(sha)) ?? null,
  }
}

function context(github = reader({ [OLD]: { [PATH]: oldDoc }, [HEAD]: { [PATH]: headDoc } }, [FIX])): tools.ToolContext {
  return { db: getDb(), appUrl: 'http://localhost:3000', github, agent: { userId: hugo.id, clientName: 'Claude Code' } }
}

function anchor(extra: Partial<AnchorData>): AnchorData {
  return { kind: 'text', quoteExact: '', quotePrefix: '', quoteSuffix: '', textStart: null, textEnd: null, lineStart: null, lineEnd: null, ...extra }
}

async function thread(a: AnchorData, body: string, path = PATH, blobSha: string | null = blobOf(OLD, path)) {
  return store.createThread(getDb(), maya.id, {
    repoId: repo.repoId,
    repoFullName: repo.fullName,
    path,
    commitSha: OLD,
    blobSha,
    anchor: a,
    body,
    via: null,
  })
}

beforeEach(async () => {
  reads = []
  // A new repo per test keeps tests apart in the shared database.
  repoId += 1
  repo = {
    repoId,
    owner: 'acme',
    name: `docs-${repoId}`,
    fullName: `acme/docs-${repoId}`,
    private: true,
    defaultBranch: 'main',
    ownerId: 1,
    permissions: { comment: true, moderate: false },
  }
  const now = Date.now()
  await getDb().insert(users).values([maya, hugo].map((u) => ({ ...u, updatedAt: now }))).onConflictDoNothing()
})

describe('list_threads', () => {
  it('places page and line comments on the current commit', async () => {
    const text = await thread(anchor({ quoteExact: 'Ship on Friday', lineStart: 3, lineEnd: 3 }), 'Monday instead?')
    const lines = await thread(anchor({ kind: 'lines', quoteExact: 'make deploy', lineStart: 6, lineEnd: 6 }), 'Use the script.')

    const list = await tools.listThreads(context(), { repo: repo.fullName })
    expect(list).toMatchObject({ repo: repo.fullName, ref: 'main', sha: HEAD, truncated: false })
    const byId = Object.fromEntries(list.threads.map((t) => [t.id, t]))
    expect(byId[text]).toMatchObject({ state: 'attached', lines: { start: 5, end: 5 }, quoteKind: 'page' })
    expect(byId[lines]).toMatchObject({ state: 'attached', lines: { start: 8, end: 8 }, quoteKind: 'source' })
    expect(byId[text].comments).toEqual([expect.objectContaining({ author: 'maya', body: 'Monday instead?', via: null })])
    expect(byId[text].url).toBe(`http://localhost:3000/acme/${repo.name}/main/docs/plan.md?thread=${text}`)
  })

  it('skips the old version when the quoted lines are found whole', async () => {
    await thread(anchor({ kind: 'lines', quoteExact: 'make deploy', lineStart: 6, lineEnd: 6 }), 'Use the script.')
    const [only] = (await tools.listThreads(context(), { repo: repo.fullName })).threads
    expect(only).toMatchObject({ state: 'attached', lines: { start: 8, end: 8 } })
    expect(reads).toEqual([`file ${HEAD} ${PATH}`])
  })

  it('reads the old version by blob when the quoted lines aren’t found whole', async () => {
    // A quote cut short, as long ones are, doesn't end at a line end: the
    // lines are followed through a diff against the old version instead.
    const a = anchor({ kind: 'lines', quoteExact: 'make dep', lineStart: 6, lineEnd: 6 })
    await thread(a, 'One', PATH)
    await thread(a, 'Two', PATH)
    const list = await tools.listThreads(context(), { repo: repo.fullName })
    expect(list.threads.map((t) => [t.state, t.lines])).toEqual([
      ['attached', { start: 8, end: 8 }],
      ['attached', { start: 8, end: 8 }],
    ])
    // Once for both threads, and no tree lookup at the old commit.
    expect(reads).toEqual([`file ${HEAD} ${PATH}`, `blob ${blobOf(OLD, PATH)}`])
  })

  it('reads the old version through its commit for threads without a blob', async () => {
    await thread(anchor({ kind: 'lines', quoteExact: 'make dep', lineStart: 6, lineEnd: 6 }), 'Use the script.', PATH, null)
    const [only] = (await tools.listThreads(context(), { repo: repo.fullName })).threads
    expect(only).toMatchObject({ state: 'attached', lines: { start: 8, end: 8 } })
    expect(reads).toEqual([`file ${HEAD} ${PATH}`, `file ${OLD} ${PATH}`])
  })

  it('reports text that is gone as outdated', async () => {
    await thread(anchor({ quoteExact: 'Release captains rotate weekly' }), 'Who?')
    const [only] = (await tools.listThreads(context(), { repo: repo.fullName })).threads
    expect(only).toMatchObject({ state: 'outdated', lines: null })
  })

  it('lists open threads unless asked for others', async () => {
    const open = await thread(anchor({ quoteExact: 'Ship on Friday' }), 'a')
    const done = await thread(anchor({ quoteExact: 'after the review' }), 'b')
    await store.setThreadStatus(getDb(), maya.id, repo.repoId, done, 'resolved', { comment: true, moderate: false })

    expect((await tools.listThreads(context(), { repo: repo.fullName })).threads.map((t) => t.id)).toEqual([open])
    expect((await tools.listThreads(context(), { repo: repo.fullName, status: 'resolved' })).threads.map((t) => t.id)).toEqual([done])
    expect((await tools.listThreads(context(), { repo: repo.fullName, status: 'all' })).threads).toHaveLength(2)
  })

  it('filters by file', async () => {
    await thread(anchor({ quoteExact: 'Ship on Friday' }), 'a')
    await thread(anchor({ quoteExact: 'x' }), 'b', 'other.md')
    const list = await tools.listThreads(context(), { repo: repo.fullName, path: 'other.md' })
    expect(list.threads.map((t) => t.path)).toEqual(['other.md'])
  })

  it('refuses repos the person can’t read', async () => {
    await expect(tools.listThreads(context(), { repo: 'acme/secret' })).rejects.toBeInstanceOf(NotFoundError)
    await expect(tools.listThreads(context(), { repo: 'not a repo' })).rejects.toBeInstanceOf(tools.ToolError)
  })
})

describe('reply', () => {
  it('adds a comment labeled with the agent', async () => {
    const id = await thread(anchor({ quoteExact: 'Ship on Friday' }), 'Monday?')
    await tools.reply(context(), { repo: repo.fullName, threadId: id, body: 'Which Monday?' })
    const saved = await store.getThread(getDb(), repo.repoId, id)
    expect(saved?.comments.at(-1)).toMatchObject({ author: { login: 'hugo' }, body: 'Which Monday?', via: 'Claude Code' })
  })

  it('needs write access', async () => {
    const id = await thread(anchor({ quoteExact: 'Ship on Friday' }), 'Monday?')
    repo = { ...repo, permissions: { comment: false, moderate: false } }
    await expect(tools.reply(context(), { repo: repo.fullName, threadId: id, body: 'hi' })).rejects.toThrow(/write access/)
  })

  it('won’t reply on resolved threads', async () => {
    const id = await thread(anchor({ quoteExact: 'Ship on Friday' }), 'Monday?')
    await store.setThreadStatus(getDb(), maya.id, repo.repoId, id, 'resolved', { comment: true, moderate: false })
    await expect(tools.reply(context(), { repo: repo.fullName, threadId: id, body: 'hi' })).rejects.toThrow(/resolved/)
  })

  it('only finds threads in the named repo', async () => {
    const id = await thread(anchor({ quoteExact: 'Ship on Friday' }), 'Monday?')
    repo = { ...repo, repoId: repo.repoId + 1000 }
    await expect(tools.reply(context(), { repo: repo.fullName, threadId: id, body: 'hi' })).rejects.toThrow(/No thread/)
  })
})

describe('mark_addressed', () => {
  it('replies and marks the thread addressed, with the full SHA', async () => {
    const id = await thread(anchor({ quoteExact: 'Ship on Friday' }), 'Monday?')
    const result = await tools.markAddressed(context(), { repo: repo.fullName, threadId: id, body: 'Moved it.', commitSha: 'fffffff' })
    expect(result).toMatchObject({ sha: FIX })
    expect(result).not.toHaveProperty('note')

    const saved = await store.getThread(getDb(), repo.repoId, id)
    expect(saved).toMatchObject({ status: 'addressed', addressed: { by: { login: 'hugo' }, sha: FIX } })
    expect(saved?.comments.at(-1)).toMatchObject({ body: 'Moved it.', via: 'Claude Code' })
  })

  it('accepts an unpushed commit by its full SHA, and says so', async () => {
    const id = await thread(anchor({ quoteExact: 'Ship on Friday' }), 'Monday?')
    const unpushed = 'c'.repeat(40)
    const result = await tools.markAddressed(context(), { repo: repo.fullName, threadId: id, body: 'Done.', commitSha: unpushed })
    expect(result).toMatchObject({ sha: unpushed, note: expect.stringMatching(/once it's pushed/) })
  })

  it('refuses a short SHA GitHub doesn’t know', async () => {
    const id = await thread(anchor({ quoteExact: 'Ship on Friday' }), 'Monday?')
    await expect(
      tools.markAddressed(context(), { repo: repo.fullName, threadId: id, body: 'Done.', commitSha: 'ccccccc' }),
    ).rejects.toThrow(/full 40-character SHA/)
    expect((await store.getThread(getDb(), repo.repoId, id))?.status).toBe('open')
  })

  it('only marks open threads', async () => {
    const id = await thread(anchor({ quoteExact: 'Ship on Friday' }), 'Monday?')
    await tools.markAddressed(context(), { repo: repo.fullName, threadId: id, body: 'Done.' })
    await expect(tools.markAddressed(context(), { repo: repo.fullName, threadId: id, body: 'Again.' })).rejects.toThrow(
      /already addressed/,
    )
  })
})

describe('the addressed status in the store', () => {
  it('counts addressed threads as needing a person', async () => {
    const id = await thread(anchor({ quoteExact: 'Ship on Friday' }), 'Monday?')
    await thread(anchor({ quoteExact: 'after the review' }), 'b')
    await tools.markAddressed(context(), { repo: repo.fullName, threadId: id, body: 'Done.' })
    expect(await store.openThreadCounts(getDb(), repo.repoId)).toEqual({ [PATH]: 2 })
    expect((await store.repoActivity(getDb(), [repo.repoId])).get(repo.repoId)?.open).toBe(2)
  })

  it('keeps who addressed it when a person confirms or reopens it', async () => {
    const id = await thread(anchor({ quoteExact: 'Ship on Friday' }), 'Monday?')
    await tools.markAddressed(context(), { repo: repo.fullName, threadId: id, body: 'Done.', commitSha: FIX })
    const author = { comment: true, moderate: false }

    await store.setThreadStatus(getDb(), maya.id, repo.repoId, id, 'resolved', author)
    expect(await store.getThread(getDb(), repo.repoId, id)).toMatchObject({
      status: 'resolved',
      resolvedBy: { login: 'maya' },
      addressed: { by: { login: 'hugo' }, sha: FIX },
    })

    await store.setThreadStatus(getDb(), maya.id, repo.repoId, id, 'open', author)
    expect(await store.getThread(getDb(), repo.repoId, id)).toMatchObject({ status: 'open', addressed: { sha: FIX } })
  })
})
