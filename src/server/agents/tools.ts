import { blockquote, comment, fenced } from '@/lib/agent-prompt'
import { needsOldSource } from '@/lib/anchoring/line-anchor'
import { placeThread, type Placement } from '@/lib/anchoring/place'
import { toSplat } from '@/lib/links'
import { pageText, type PageText } from '@/lib/markdown/page-text'
import { isMarkdown } from '@/lib/paths'
import type { ThreadStatus, ThreadView } from '@/lib/threads'
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
  /** A text blob by its SHA, or null when it isn't there or isn't text. */
  blob(repo: RepoAccess, blobSha: string): Promise<string | null>
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

export interface AgentThread {
  id: string
  path: string
  status: ThreadStatus
  /** Where it is at the listed commit. */
  state: Placement['state']
  lines: { start: number; end: number } | null
  quote: string
  /** "source": exact lines of the file. "page": rendered text, without markdown syntax. */
  quoteKind: 'source' | 'page'
  /** The version the comment was written on. */
  commitSha: string
  url: string
  addressed: { by: string; sha: string | null; at: number } | null
  comments: Array<{ id: string; author: string; via: string | null; body: string; createdAt: number }>
}

export interface ThreadList {
  repo: string
  ref: string
  sha: string
  threads: AgentThread[]
  /** More threads or files matched than one call returns. */
  truncated: boolean
}

export const MAX_THREADS = 100
export const MAX_FILES = 25

function parseRepo(repo: string) {
  const match = /^([A-Za-z0-9_.-]{1,100})\/([A-Za-z0-9_.-]{1,100})$/.exec(repo.trim())
  if (!match) throw new ToolError(`"${repo}" isn't a repository. Use owner/name, as in the git remote.`)
  return { owner: match[1], name: match[2] }
}

function threadUrl(appUrl: string, repo: RepoAccess, ref: string, thread: ThreadView) {
  const splat = toSplat(ref, thread.path).split('/').map(encodeURIComponent).join('/')
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
  let page: PageText | null | undefined
  // The version a line comment was written on, fetched only when its lines
  // aren't found whole: by blob, or through the commit's tree for older
  // threads without one.
  const oldSources = new Map<string, Promise<string | undefined>>()
  const oldSource = (thread: ThreadView) => {
    const key = thread.blobSha ? `blob:${thread.blobSha}` : `commit:${thread.commitSha}`
    let found = oldSources.get(key)
    if (!found) {
      found = thread.blobSha
        ? ctx.github.blob(repo, thread.blobSha).then((text) => text ?? undefined)
        : ctx.github.file(repo, thread.commitSha, path).then((f) => f?.source)
      oldSources.set(key, found)
    }
    return found
  }
  return Promise.all(
    threads.map(async (thread) => {
      if (thread.anchor.kind === 'text' && page === undefined) page = isMarkdown(path) ? pageText(file.source, path) : null
      const needsOld = needsOldSource(file.source, thread.anchor, thread.blobSha === file.blobSha)
      const placement = placeThread(thread, file, {
        page: page ?? null,
        oldSource: needsOld ? await oldSource(thread) : undefined,
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
  const { ref, sha } = await ctx.github.resolveRef(repo, input.ref ?? repo.defaultBranch)
  const status = input.status ?? 'open'
  const statuses: ThreadStatus[] = status === 'all' ? ['open', 'addressed', 'resolved'] : [status]
  const all = await store.listRepoThreads(ctx.db, repo.repoId, statuses, input.path)

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
  const thread = await store.getThread(ctx.db, repo.repoId, input.threadId)
  if (!thread) throw new ToolError(`No thread ${input.threadId} in ${repo.fullName}.`)
  const { ref, sha } = await ctx.github.resolveRef(repo, input.ref ?? repo.defaultBranch)
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
      note = `GitHub doesn't know commit ${sha.slice(0, 7)} yet. The link in Reviews works once it's pushed.`
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
    const where = t.lines
      ? `${t.path}:${t.lines.start === t.lines.end ? t.lines.start : `${t.lines.start}-${t.lines.end}`}`
      : `${t.path} (${t.state === 'outdated' ? 'text removed' : 'line unknown'})`
    // An open thread that was addressed before was reopened by a person, so its
    // latest reply can still be the earlier "fixed".
    const status =
      t.status === 'open'
        ? t.addressed
          ? [`_Reopened after ${t.addressed.by} marked it addressed._`]
          : []
        : [`_${t.status === 'addressed' ? 'Addressed' : 'Resolved'}${t.addressed ? ` by ${t.addressed.by}` : ''}._`]
    const comments = t.comments.map((c) =>
      comment({ id: c.id, author: { id: 0, login: c.author, name: null, avatarUrl: null }, body: c.body, via: c.via, createdAt: c.createdAt, editedAt: null, deleted: false }),
    )
    return [
      `## ${i + 1}. ${where}`,
      `Thread ID: ${t.id}`,
      t.quoteKind === 'source' ? fenced(t.quote) : blockquote(t.quote),
      ...status,
      ...comments,
    ].join('\n\n')
  })
  return [head, ...sections, ...(list.truncated ? ['More threads matched. Narrow the list with `path`.'] : [])].join('\n\n')
}
