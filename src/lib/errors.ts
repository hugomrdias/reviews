/**
 * Errors server functions throw on purpose, for the client to act on:
 * - UNAUTHENTICATED: the session is gone, so sign in again.
 * - NO_ACCESS: the viewer can't read the repo, or it doesn't exist.
 * - NO_WRITE_ACCESS: the viewer can read the repo but not comment on it.
 */
export const ERROR_CODES = ['UNAUTHENTICATED', 'NO_ACCESS', 'NO_WRITE_ACCESS'] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

/** An error with a code. The code is also the message, which is what survives the trip to the client. */
export class CodedError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code)
  }
}

/** The code of an error a server function threw on purpose, or null for anything else. */
export function errorCode(error: unknown): ErrorCode | null {
  if (!(error instanceof Error)) return null
  return (ERROR_CODES as readonly string[]).includes(error.message) ? (error.message as ErrorCode) : null
}

/** Retry failed queries twice, unless the error is one that asking again won't change. */
export function shouldRetryQuery(failureCount: number, error: unknown) {
  return failureCount < 2 && errorCode(error) === null
}
