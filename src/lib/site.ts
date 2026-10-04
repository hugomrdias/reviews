import { createIsomorphicFn } from '@tanstack/react-start'

/** The app's public origin. Link previews need absolute URLs, and crawlers only read the server's HTML. */
export const appUrl = createIsomorphicFn()
  .server(() => process.env.APP_URL)
  .client(() => window.location.origin)
