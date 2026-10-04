// zod/mini: search params are validated in the browser, and full Zod is
// most of a 100 KB chunk there.
import * as z from 'zod/mini'

/**
 * Search params of the viewer route.
 * - view: rendered markdown, raw source, or a diff against `base`.
 * - base: commit (or ref) to compare against.
 * - thread: thread to focus.
 * - from: the ref someone came from when viewing a comment's commit.
 */
export const viewerSearch = z.object({
  view: z.optional(z.enum(['rendered', 'source', 'compare'])),
  base: z.optional(z.string().check(z.maxLength(255))),
  thread: z.optional(z.string().check(z.maxLength(64))),
  from: z.optional(z.string().check(z.maxLength(255))),
})

export type ViewerSearch = z.infer<typeof viewerSearch>
