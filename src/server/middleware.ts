import { createMiddleware } from '@tanstack/react-start'
import { CodedError } from '@/lib/errors'
import { repoInput } from '@/functions/schemas'
import { AuthError } from './github/client'
import { checkRepoAccess } from './github/access'
import { deleteSessionById, loadSession } from './auth/session'

/**
 * Requires a signed-in user and passes `{ session }` to the server function.
 * Routes redirect signed-out visitors in `beforeLoad`; this is the backstop
 * for sessions that die mid-visit. A GitHub 401 means the token was revoked,
 * so the session is dropped too.
 */
export const authMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const session = await loadSession()
  if (!session) throw new CodedError('UNAUTHENTICATED')
  try {
    return await next({ context: { session } })
  } catch (error) {
    if (error instanceof AuthError) {
      await deleteSessionById(session.id)
      throw new CodedError('UNAUTHENTICATED')
    }
    throw error
  }
})

/**
 * For server functions that take `{ owner, repo }`: checks the signed-in user
 * can read the repo and passes `{ access }` along, or throws NO_ACCESS. The
 * function's own validator still checks the rest of its input, so this one
 * lets other fields through.
 */
export const repoMiddleware = createMiddleware({ type: 'function' })
  .middleware([authMiddleware])
  .validator(repoInput.loose())
  .server(async ({ next, data, context: { session } }) => {
    const access = await checkRepoAccess(session, data.owner, data.repo)
    return next({ context: { access } })
  })

/** Like repoMiddleware, and the user must be able to comment on the repo too, or it throws NO_WRITE_ACCESS. */
export const commentableRepoMiddleware = createMiddleware({ type: 'function' })
  .middleware([repoMiddleware])
  .server(async ({ next, context: { access } }) => {
    if (!access.permissions.comment) throw new CodedError('NO_WRITE_ACCESS')
    return next()
  })
