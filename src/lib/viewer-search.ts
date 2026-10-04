import { z } from 'zod'

/**
 * Search params of the viewer route.
 * - view: rendered markdown, raw source, or a diff against `base`.
 * - base: commit (or ref) to compare against.
 * - thread: thread to focus.
 * - from: the ref someone came from when viewing a comment's commit.
 */
export const viewerSearch = z.object({
  view: z.enum(['rendered', 'source', 'compare']).optional(),
  base: z.string().max(255).optional(),
  thread: z.string().max(64).optional(),
  from: z.string().max(255).optional(),
})

export type ViewerSearch = z.infer<typeof viewerSearch>
