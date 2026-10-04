import { createServerFn } from '@tanstack/react-start'
import { loadSession, type SessionUser } from '@/server/auth/session'

/** The signed-in user, or null. Never throws for signed-out visitors. */
export const getViewer = createServerFn({ method: 'GET' }).handler(async (): Promise<SessionUser | null> => {
  const session = await loadSession()
  return session?.user ?? null
})
