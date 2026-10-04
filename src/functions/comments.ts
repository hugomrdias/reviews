import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as store from '@/server/comments/store'
import { getDb } from '@/server/db/client'
import { requireRepoAccess } from '@/server/github/access'
import { NotFoundError } from '@/server/github/client'
import { authMiddleware } from '@/server/middleware'
import type { ActiveSession } from '@/server/auth/session'
import { anchorSchema, bodySchema, pathSchema, repoInput, shaSchema } from './schemas'

/** Comment access follows repo access: no read access, no comments. */
async function repoFor(session: ActiveSession, owner: string, repo: string) {
  try {
    return await requireRepoAccess(session, owner, repo)
  } catch (error) {
    if (error instanceof NotFoundError) throw new Error('NO_ACCESS')
    throw error
  }
}

/** Writing a comment needs write access to the repo, not just read. */
async function commentableRepo(session: ActiveSession, owner: string, repo: string) {
  const access = await repoFor(session, owner, repo)
  if (!access.permissions.comment) throw new Error('NO_WRITE_ACCESS')
  return access
}

export const listThreads = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(repoInput.extend({ path: pathSchema }))
  .handler(async ({ data, context: { session } }) => {
    const access = await repoFor(session, data.owner, data.repo)
    return store.listThreads(getDb(), access.repoId, data.path)
  })

export const getThreadCounts = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(repoInput)
  .handler(async ({ data, context: { session } }) => {
    const access = await repoFor(session, data.owner, data.repo)
    return store.openThreadCounts(getDb(), access.repoId)
  })

export const createThread = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    repoInput.extend({
      path: pathSchema.min(1),
      commitSha: shaSchema,
      blobSha: shaSchema.nullable(),
      anchor: anchorSchema,
      body: bodySchema,
    }),
  )
  .handler(async ({ data, context: { session } }) => {
    const access = await commentableRepo(session, data.owner, data.repo)
    const id = await store.createThread(getDb(), session.user.id, {
      repoId: access.repoId,
      repoFullName: access.fullName,
      path: data.path,
      commitSha: data.commitSha,
      blobSha: data.blobSha,
      anchor: data.anchor,
      body: data.body,
    })
    return { id }
  })

export const addComment = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(repoInput.extend({ threadId: z.uuid(), body: bodySchema }))
  .handler(async ({ data, context: { session } }) => {
    const access = await commentableRepo(session, data.owner, data.repo)
    const id = await store.addComment(getDb(), session.user.id, access.repoId, data.threadId, data.body)
    return { id }
  })

export const editComment = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(repoInput.extend({ commentId: z.uuid(), body: bodySchema }))
  .handler(async ({ data, context: { session } }) => {
    const access = await commentableRepo(session, data.owner, data.repo)
    await store.editComment(getDb(), session.user.id, access.repoId, data.commentId, data.body)
  })

export const deleteComment = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(repoInput.extend({ commentId: z.uuid() }))
  .handler(async ({ data, context: { session } }) => {
    const access = await commentableRepo(session, data.owner, data.repo)
    await store.deleteComment(getDb(), session.user.id, access.repoId, data.commentId)
  })

export const setThreadStatus = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(repoInput.extend({ threadId: z.uuid(), status: z.enum(['open', 'resolved']) }))
  .handler(async ({ data, context: { session } }) => {
    const access = await commentableRepo(session, data.owner, data.repo)
    await store.setThreadStatus(getDb(), session.user.id, access.repoId, data.threadId, data.status, access.permissions)
  })
