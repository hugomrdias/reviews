import { createIsomorphicFn } from '@tanstack/react-start'
import { preloadFileTree } from '@pierre/trees/ssr'
import { treeOptions } from './RepoTree'

/** Server-rendered tree HTML for the first paint. Client navigations keep the live tree. */
export const preloadTree = createIsomorphicFn()
  .server((paths: readonly string[], path: string) => {
    const payload = preloadFileTree(treeOptions(paths, path))
    return { id: payload.id, shadowHtml: payload.shadowHtml }
  })
  .client(() => null)
