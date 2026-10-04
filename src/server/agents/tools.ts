import { z } from 'zod'
import { comment, quoteBlock, threadLocation } from '@/lib/agent-prompt'
import { unchangedLines, type UnchangedLines } from '@/lib/anchoring/line-anchor'
import { lazyPageText, placeThread, type Placement } from '@/lib/anchoring/place'
import { toSplat } from '@/lib/links'
import { encodePath } from '@/lib/paths'
import { THREAD_STATUSES, type ThreadStatus, type ThreadView } from '@/lib/threads'
import { shortSha } from '@/lib/time'
import * as store from '../comments/store'
import type { Db } from '../db/client'
import type { RepoAccess } from '../github/access'

// What the MCP tools do, apart from MCP itself: read threads placed on a
// version of their file, reply, and mark addressed. GitHub comes in through
// `RepoReader` so tests can run this against a real D1 without the network.

/** A message the agent should see as the tool's error. */
export class ToolError extends Error {}

export interface RepoReader {
  /** The person's access to the repo. Throws NotFoundError when they can't read it. */
  access(owner: string, name: string): Promise<RepoAccess>
  /** A branch, tag or SHA, resolved to a commit. */
  resolveRef(repo: RepoAccess, ref: string): Promise<{ ref: string; sha: string }>
  /** A text file at a commit, or null when it isn't there or isn't text. */
  file(repo: RepoAccess, sha: string, path: string): Promise<{ source: string; blobSha: string } | null>
  /** The full SHA of a commit GitHub knows, or null. */
  commit(repo: RepoAccess, sha: string): Promise<string | null>
}

export interface ToolContext {
  db: Db
  appUrl: string
  github: RepoReader
  /** Who the agent acts for, and its name for comments.via. */
  agent: { userId: number; clientName: string }
}

/** A thread as the tools return it, and the tools' output schema. */
export const agentThreadSchema = z.object({
  id: z.string(),
  path: z.string(),
  status: z.enum(THREAD_STATUSES),
  /** Where it is at the listed commit. */
  state: z.enum(['attached', 'edited', 'outdated']),
  lines: z.object({ start: z.number(), end: z.number() }).nullable(),
  quote: z.string(),
  /** "source": exact lines of the file. "page": rendered text, without markdown syntax. */
  quoteKind: z.enum(['source', 'page']),
  /** The version the comment was written on. */
  commitSha: z.string(),
  url: z.string(),
  addressed: z.object({ by: z.string(), sha: z.string().nullable(), at: z.number() }).nullable(),
  comments: z.array(
    z.object({ id: z.string(), author: z.string(), via: z.string().nullable(), body: z.string(), createdAt: z.number() }),
  ),
})

export type AgentThread = z.infer<typeof agentThreadSchema>

export const threadListSchema = z.object({
  repo: z.string(),
  ref: z.string(),
  sha: z.string(),
  threads: z.array(agentThreadSchema),
  /** More threads or files matched than one call returns. */
  truncated: z.boolean(),
})

export type ThreadList = z.infer<typeof threadListSchema>

export const MAX_THREADS = 100
export const MAX_FILES = 25

function parseRepo(repo: string) {
  const match = /^([A-Za-z0-9_.-]{1,100})\/([A-Za-z0-9_.-]{1,100})$/.exec(repo.trim())
  if (!match) throw new ToolError(`"${repo}" isn't a repository. Use owner/name, as in the git remote.`)
  return { owner: match[1], name: match[2] }
}

function threadUrl(appUrl: string, repo: RepoAccess, ref: string, thread: ThreadView) {
  const splat = encodePath(toSplat(ref, thread.path))
  return `${new URL(appUrl).origin}/${repo.owner}/${repo.name}/${splat}?thread=${thread.id}`
}

function toAgentThread(thread: ThreadView, placement: Placement, url: string): AgentThread {
  return {
    id: thread.id,
    path: thread.path,
    status: thread.status,
    state: placement.state,
    lines: placement.lines,
    quote: thread.anchor.quoteExact,
    quoteKind: thread.anchor.kind === 'lines' ? 'source' : 'page',
    commitSha: thread.commitSha,
    url,
    addressed: thread.addressed && {
      by: thread.addressed.by.login,
      sha: thread.addressed.sha,
      at: thread.addressed.at,
    },
    comments: thread.comments
      .filter((c) => !c.deleted)
      .map((c) => ({ id: c.id, author: c.author.login, via: c.via, body: c.body, createdAt: c.createdAt })),
  }
}

/** Places a file's threads on the file at `sha`. */
async function placeOnFile(ctx: ToolContext, repo: RepoAccess, sha: string, path: string, threads: ThreadView[]) {
  const file = await ctx.github.file(repo, sha, path)
  if (!file) return threads.map((t) => [t, { state: 'outdated', lines: null }] as const)
  const page = lazyPageText(path, file.source)
  // Line comments on another version follow their lines through a diff, fetched and run once per commit.
  const diffs = new Map<string, Promise<UnchangedLines | undefined>>()
  const diffFrom = (commitSha: string) => {
    let found = diffs.get(commitSha)
    if (!found) {
      found = ctx.github.file(repo, commitSha, path).then((old) => (old ? unchangedLines(old.source, file.source) : undefined))
      diffs.set(commitSha, found)
    }
    return found
  }
  return Promise.all(
    threads.map(async (thread) => {
      const lineThreadOnOtherVersion = thread.anchor.kind === 'lines' && thread.blobSha !== file.blobSha
      const placement = placeThread(thread, file, {
        page,
        unchangedLines: lineThreadOnOtherVersion ? await diffFrom(thread.commitSha) : undefined,
      })
      return [thread, placement] as const
    }),
  )
}

export async function listThreads(
  ctx: ToolContext,
  input: { repo: string; path?: string; ref?: string; status?: ThreadStatus | 'all' },
): Promise<ThreadList> {
  const { owner, name } = parseRepo(input.repo)
  const repo = await ctx.github.access(owner, name)
  const status = input.status ?? 'open'
  const [{ ref, sha }, all] = await Promise.all([
    ctx.github.resolveRef(repo, input.ref ?? repo.defaultBranch),
    store.listRepoThreads(ctx.db, repo.repoId, status === 'all' ? [...THREAD_STATUSES] : [status], input.path),
  ])

  const kept = all.slice(0, MAX_THREADS)
  const byPath = new Map<string, ThreadView[]>()
  for (const thread of kept) byPath.set(thread.path, [...(byPath.get(thread.path) ?? []), thread])
  const paths = [...byPath.keys()].slice(0, MAX_FILES)

  const placed = await Promise.all(paths.map((path) => placeOnFile(ctx, repo, sha, path, byPath.get(path)!)))
  const threads = placed.flat().map(([thread, placement]) => toAgentThread(thread, placement, threadUrl(ctx.appUrl, repo, ref, thread)))
  return {
    repo: repo.fullName,
    ref,
    sha,
    threads,
    truncated: all.length > kept.length || byPath.size > paths.length,
  }
}

export async function getThread(ctx: ToolContext, input: { repo: string; threadId: string; ref?: string }) {
  const { owner, name } = parseRepo(input.repo)
  const repo = await ctx.github.access(owner, name)
  const [thread, { ref, sha }] = await Promise.all([
    store.getThread(ctx.db, repo.repoId, input.threadId),
    ctx.github.resolveRef(repo, input.ref ?? repo.defaultBranch),
  ])
  if (!thread) throw new ToolError(`No thread ${input.threadId} in ${repo.fullName}.`)
  const [[, placement]] = await placeOnFile(ctx, repo, sha, thread.path, [thread])
  return { repo: repo.fullName, ref, sha, thread: toAgentThread(thread, placement, threadUrl(ctx.appUrl, repo, ref, thread)) }
}

/** The repo, if the person may write comments on it, and the thread, if it can take a reply. */
async function writableThread(ctx: ToolContext, repoName: string, threadId: string) {
  const { owner, name } = parseRepo(repoName)
  const repo = await ctx.github.access(owner, name)
  if (!repo.permissions.comment) {
    throw new ToolError(`You can read comments on ${repo.fullName} but not write them: that needs write access on GitHub.`)
  }
  const thread = await store.getThread(ctx.db, repo.repoId, threadId)
  if (!thread) throw new ToolError(`No thread ${threadId} in ${repo.fullName}.`)
  if (thread.status === 'resolved') throw new ToolError('The thread is resolved. A person has to reopen it in Reviews first.')
  return { repo, thread }
}

export async function reply(ctx: ToolContext, input: { repo: string; threadId: string; body: string }) {
  const { repo, thread } = await writableThread(ctx, input.repo, input.threadId)
  const commentId = await store.addComment(ctx.db, ctx.agent.userId, repo.repoId, thread.id, input.body, ctx.agent.clientName)
  return { commentId, url: threadUrl(ctx.appUrl, repo, repo.defaultBranch, thread) }
}

const SHA = /^[0-9a-f]{7,40}$/i

export async function markAddressed(
  ctx: ToolContext,
  input: { repo: string; threadId: string; body: string; commitSha?: string },
) {
  const { repo, thread } = await writableThread(ctx, input.repo, input.threadId)
  if (thread.status !== 'open') throw new ToolError(`The thread is already ${thread.status}.`)

  let sha: string | null = null
  let note: string | undefined
  if (input.commitSha) {
    if (!SHA.test(input.commitSha)) throw new ToolError(`"${input.commitSha}" isn't a commit SHA.`)
    sha = await ctx.github.commit(repo, input.commitSha)
    if (!sha) {
      // Not pushed yet. A full SHA still makes a link that works once it is.
      if (input.commitSha.length !== 40) {
        throw new ToolError(`GitHub doesn't know commit ${input.commitSha} yet. Push it, or give the full 40-character SHA.`)
      }
      sha = input.commitSha.toLowerCase()
      note = `GitHub doesn't know commit ${shortSha(sha)} yet. The link in Reviews works once it's pushed.`
    }
  }

  try {
    const commentId = await store.markAddressed(ctx.db, ctx.agent.userId, repo.repoId, thread.id, {
      body: input.body,
      via: ctx.agent.clientName,
      sha,
    })
    return { commentId, sha, url: threadUrl(ctx.appUrl, repo, repo.defaultBranch, thread), ...(note ? { note } : {}) }
  } catch (error) {
    if (error instanceof store.ConflictError) throw new ToolError(error.message)
    throw error
  }
}

/** The list as text, in the Copy for agent format, for clients that only show text. */
export function threadListText(list: ThreadList) {
  if (list.threads.length === 0) return `No matching threads in ${list.repo} at ${list.ref} (${list.sha}).`
  const head = `${list.threads.length} threads in ${list.repo} at \`${list.ref}\` (commit ${list.sha}). Line numbers refer to that commit.`
  const sections = list.threads.map((t, i) => {
    const status =
      t.status === 'open'
        ? []
        : [`_${t.status === 'addressed' ? 'Addressed' : 'Resolved'}${t.addressed ? ` by ${t.addressed.by}` : ''}._`]
    return [
      `## ${i + 1}. ${threadLocation(t.path, t.lines, t.state)}`,
      `Thread ID: ${t.id}`,
      quoteBlock(t.quote, t.quoteKind === 'source'),
      ...status,
      ...t.comments.map((c) => comment({ author: { login: c.author }, via: c.via, body: c.body })),
      `Thread: ${t.url}`,
    ].join('\n\n')
  })
  return [head, ...sections, ...(list.truncated ? ['More threads matched. Narrow the list with `path`.'] : [])].join('\n\n')
}
