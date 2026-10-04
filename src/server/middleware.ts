import { createMiddleware } from '@tanstack/react-start'
import { UNAUTHENTICATED } from '@/lib/auth'
import { AuthError } from './github/client'
import { deleteSessionById, loadSession } from './auth/session'

/**
 * Requires a signed-in user and passes `{ session }` to the server function.
 * Routes redirect signed-out visitors in `beforeLoad`; this is the backstop
 * for sessions that die mid-visit. A GitHub 401 means the token was revoked,
 * so the session is dropped too.
 */
export const authMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const session = await loadSession()
  if (!session) throw new Error(UNAUTHENTICATED)
  try {
    return await next({ context: { session } })
  } catch (error) {
    if (error instanceof AuthError) {
      await deleteSessionById(session.id)
      throw new Error(UNAUTHENTICATED)
    }
    throw error
  }
})
