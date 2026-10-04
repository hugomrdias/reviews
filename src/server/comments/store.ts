import { and, asc, count, eq, inArray, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { canResolve, type AnchorData, type Author, type CommentPermissions, type ThreadView } from '@/lib/threads'
import type { Db } from '../db/client'
import { comments, threads, users, type User } from '../db/schema'

export class ForbiddenError extends Error {}
export class MissingError extends Error {}

function toAuthor(u: Pick<User, 'id' | 'login' | 'name' | 'avatarUrl'>): Author {
  return { id: u.id, login: u.login, name: u.name, avatarUrl: u.avatarUrl }
}

const resolver = alias(users, 'resolver')

/** Every thread on a file, open and resolved, with its comments. */
export async function listThreads(db: Db, repoId: number, path: string): Promise<ThreadView[]> {
  const onFile = and(eq(threads.repoId, repoId), eq(threads.path, path))
  // Both queries at once; the comments find their threads with a subquery.
  // Not db.batch: it maps joined rows by column name, and both tables have an `id`.
  const [rows, commentRows] = await Promise.all([
    db
      .select({ thread: threads, author: users, resolver })
      .from(threads)
      .innerJoin(users, eq(users.id, threads.authorId))
      .leftJoin(resolver, eq(resolver.id, threads.resolvedBy))
      .where(onFile)
      .orderBy(asc(threads.createdAt)),
    db
      .select({ comment: comments, author: users })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.authorId))
      .where(inArray(comments.threadId, db.select({ id: threads.id }).from(threads).where(onFile)))
      .orderBy(asc(comments.createdAt)),
  ])
  if (rows.length === 0) return []

  const byThread = new Map<string, ThreadView['comments']>()
  for (const { comment, author } of commentRows) {
    const list = byThread.get(comment.threadId) ?? []
    const deleted = comment.deletedAt !== null
    list.push({
      id: comment.id,
      author: toAuthor(author),
      body: deleted ? '' : comment.body,
      createdAt: comment.createdAt,
      editedAt: comment.editedAt,
      deleted,
    })
    byThread.set(comment.threadId, list)
  }

  return rows.map(({ thread: t, author, resolver: r }) => ({
    id: t.id,
    path: t.path,
    commitSha: t.commitSha,
    blobSha: t.blobSha,
    anchor: {
      kind: t.anchorKind,
      quoteExact: t.quoteExact,
      quotePrefix: t.quotePrefix,
      quoteSuffix: t.quoteSuffix,
      textStart: t.textStart,
      textEnd: t.textEnd,
      lineStart: t.lineStart,
      lineEnd: t.lineEnd,
    },
    status: t.status,
    resolvedBy: r ? toAuthor(r) : null,
    resolvedAt: t.resolvedAt,
    author: toAuthor(author),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    comments: byThread.get(t.id) ?? [],
  }))
}

/** Open thread count per path, for the file tree. */
export async function openThreadCounts(db: Db, repoId: number) {
  const rows = await db
    .select({ path: threads.path, n: count() })
    .from(threads)
    .where(and(eq(threads.repoId, repoId), eq(threads.status, 'open')))
    .groupBy(threads.path)
  return Object.fromEntries(rows.map((r) => [r.path, r.n])) as Record<string, number>
}

/** Open threads and last activity per repo, for the given repos that have any threads. */
export async function repoActivity(db: Db, repoIds: number[]) {
  if (repoIds.length === 0) return new Map<number, { open: number; lastActivity: number }>()
  // The ids go in as one JSON parameter: D1 allows only 100 bound parameters.
  const ids = sql`(select value from json_each(${JSON.stringify(repoIds)}))`
  const rows = await db
    .select({
      repoId: threads.repoId,
      open: sql<number>`sum(case when ${threads.status} = 'open' then 1 else 0 end)`,
      lastActivity: sql<number>`max(${threads.updatedAt})`,
    })
    .from(threads)
    .where(inArray(threads.repoId, ids))
    .groupBy(threads.repoId)
  return new Map(rows.map((r) => [r.repoId, { open: Number(r.open), lastActivity: Number(r.lastActivity) }]))
}

export interface NewThread {
  repoId: number
  repoFullName: string
  path: string
  commitSha: string
  blobSha: string | null
  anchor: AnchorData
  body: string
}

export async function createThread(db: Db, authorId: number, input: NewThread) {
  const now = Date.now()
  const id = crypto.randomUUID()
  const { anchor } = input
  await db.batch([
    db.insert(threads).values({
      id,
      repoId: input.repoId,
      repoFullName: input.repoFullName,
      path: input.path,
      commitSha: input.commitSha,
      blobSha: input.blobSha,
      anchorKind: anchor.kind,
      quoteExact: anchor.quoteExact,
      quotePrefix: anchor.quotePrefix,
      quoteSuffix: anchor.quoteSuffix,
      textStart: anchor.textStart,
      textEnd: anchor.textEnd,
      lineStart: anchor.lineStart,
      lineEnd: anchor.lineEnd,
      authorId,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(comments).values({ id: crypto.randomUUID(), threadId: id, authorId, body: input.body, createdAt: now }),
  ])
  return id
}

/** Loads a thread and checks it belongs to the repo the caller has access to. */
async function threadInRepo(db: Db, threadId: string, repoId: number) {
  const [row] = await db.select().from(threads).where(eq(threads.id, threadId)).limit(1)
  if (!row || row.repoId !== repoId) throw new MissingError('Thread not found')
  return row
}

export async function addComment(db: Db, authorId: number, repoId: number, threadId: string, body: string) {
  await threadInRepo(db, threadId, repoId)
  const now = Date.now()
  const id = crypto.randomUUID()
  await db.batch([
    db.insert(comments).values({ id, threadId, authorId, body, createdAt: now }),
    db.update(threads).set({ updatedAt: now }).where(eq(threads.id, threadId)),
  ])
  return id
}

async function ownComment(db: Db, userId: number, repoId: number, commentId: string) {
  const [row] = await db
    .select({ comment: comments, repoId: threads.repoId })
    .from(comments)
    .innerJoin(threads, eq(threads.id, comments.threadId))
    .where(eq(comments.id, commentId))
    .limit(1)
  if (!row || row.repoId !== repoId || row.comment.deletedAt) throw new MissingError('Comment not found')
  if (row.comment.authorId !== userId) throw new ForbiddenError('Only the author can change this comment')
  return row.comment
}

export async function editComment(db: Db, userId: number, repoId: number, commentId: string, body: string) {
  const comment = await ownComment(db, userId, repoId, commentId)
  const now = Date.now()
  await db.batch([
    db.update(comments).set({ body, editedAt: now }).where(eq(comments.id, commentId)),
    db.update(threads).set({ updatedAt: now }).where(eq(threads.id, comment.threadId)),
  ])
}

export async function deleteComment(db: Db, userId: number, repoId: number, commentId: string) {
  const comment = await ownComment(db, userId, repoId, commentId)
  const now = Date.now()
  await db.batch([
    db.update(comments).set({ deletedAt: now }).where(eq(comments.id, commentId)),
    db.update(threads).set({ updatedAt: now }).where(eq(threads.id, comment.threadId)),
  ])
}

export async function setThreadStatus(
  db: Db,
  userId: number,
  repoId: number,
  threadId: string,
  status: 'open' | 'resolved',
  permissions: CommentPermissions,
) {
  const thread = await threadInRepo(db, threadId, repoId)
  if (!canResolve(permissions, thread.authorId, userId)) {
    throw new ForbiddenError('Only the thread author or a maintainer can change this thread')
  }
  const now = Date.now()
  await db
    .update(threads)
    .set({
      status,
      resolvedBy: status === 'resolved' ? userId : null,
      resolvedAt: status === 'resolved' ? now : null,
      updatedAt: now,
    })
    .where(eq(threads.id, threadId))
}
