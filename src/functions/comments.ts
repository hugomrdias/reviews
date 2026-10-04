import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import * as store from '@/server/comments/store'
import { getDb } from '@/server/db/client'
import { commentableRepoMiddleware, repoMiddleware } from '@/server/middleware'
import { anchorSchema, bodySchema, pathSchema, repoInput, shaSchema } from './schemas'

export const listThreads = createServerFn({ method: 'GET' })
  .middleware([repoMiddleware])
  .validator(repoInput.extend({ path: pathSchema }))
  .handler(async ({ data, context: { access } }) => {
    return store.listThreads(getDb(), access.repoId, data.path)
  })

export const getThreadCounts = createServerFn({ method: 'GET' })
  .middleware([repoMiddleware])
  .validator(repoInput)
  .handler(async ({ context: { access } }) => {
    return store.openThreadCounts(getDb(), access.repoId)
  })

export const createThread = createServerFn({ method: 'POST' })
  .middleware([commentableRepoMiddleware])
  .validator(
    repoInput.extend({
      path: pathSchema.min(1),
      commitSha: shaSchema,
      blobSha: shaSchema.nullable(),
      anchor: anchorSchema,
      body: bodySchema,
    }),
  )
  .handler(async ({ data, context: { session, access } }) => {
    const id = await store.createThread(getDb(), session.user.id, {
      repoId: access.repoId,
      repoFullName: access.fullName,
      path: data.path,
      commitSha: data.commitSha,
      blobSha: data.blobSha,
      anchor: data.anchor,
      body: data.body,
      via: null,
    })
    return { id }
  })

export const addComment = createServerFn({ method: 'POST' })
  .middleware([commentableRepoMiddleware])
  .validator(repoInput.extend({ threadId: z.uuid(), body: bodySchema }))
  .handler(async ({ data, context: { session, access } }) => {
    const id = await store.addComment(getDb(), session.user.id, access.repoId, data.threadId, data.body, null)
    return { id }
  })

export const editComment = createServerFn({ method: 'POST' })
  .middleware([commentableRepoMiddleware])
  .validator(repoInput.extend({ commentId: z.uuid(), body: bodySchema }))
  .handler(async ({ data, context: { session, access } }) => {
    await store.editComment(getDb(), session.user.id, access.repoId, data.commentId, data.body)
  })

export const deleteComment = createServerFn({ method: 'POST' })
  .middleware([commentableRepoMiddleware])
  .validator(repoInput.extend({ commentId: z.uuid() }))
  .handler(async ({ data, context: { session, access } }) => {
    await store.deleteComment(getDb(), session.user.id, access.repoId, data.commentId)
  })

export const setThreadStatus = createServerFn({ method: 'POST' })
  .middleware([commentableRepoMiddleware])
  .validator(repoInput.extend({ threadId: z.uuid(), status: z.enum(['open', 'resolved']) }))
  .handler(async ({ data, context: { session, access } }) => {
    await store.setThreadStatus(getDb(), session.user.id, access.repoId, data.threadId, data.status, access.permissions)
  })
