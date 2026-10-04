import { createFileRoute, notFound } from '@tanstack/react-router'
import { preloadTree } from '@/components/tree/preload'
import { FileViewer } from '@/components/viewer/FileViewer'
import * as f from '@/dev/fixtures'
import { toSplat } from '@/lib/links'
import {
  fileCommitsQuery,
  fileQuery,
  locationQuery,
  threadCountsQuery,
  threadsQuery,
  treeQuery,
} from '@/lib/queries'
import { viewerSearch } from '@/lib/viewer-search'

// Dev only: the viewer with fixture data in the query cache, so the UI can be
// checked without a GitHub App. 404 in production builds.
export const Route = createFileRoute('/dev/preview')({
  validateSearch: viewerSearch,
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw notFound()
  },
  loader: ({ context: { queryClient } }) => {
    const seed = <T,>(options: { queryKey: readonly unknown[] }, data: T) =>
      queryClient.setQueryData(options.queryKey as unknown[], data, { updatedAt: Date.now() + 1e9 })
    const repo = { owner: f.OWNER, name: f.REPO, fullName: `${f.OWNER}/${f.REPO}`, private: true, defaultBranch: f.REF }
    seed(locationQuery(f.OWNER, f.REPO, toSplat(f.REF, f.DOC)), {
      status: 'ok',
      repo,
      location: { ref: f.REF, sha: f.SHA, path: f.DOC },
    })
    seed(treeQuery(f.OWNER, f.REPO, f.SHA), { paths: f.paths, truncated: false })
    seed(fileQuery(f.OWNER, f.REPO, f.SHA, f.DOC), {
      kind: 'text',
      path: f.DOC,
      blobSha: f.BLOB,
      size: f.releaseProcess.length,
      text: f.releaseProcess,
    })
    seed(fileQuery(f.OWNER, f.REPO, f.OLD_SHA, f.DOC), {
      kind: 'text',
      path: f.DOC,
      blobSha: f.OLD_BLOB,
      size: f.oldReleaseProcess.length,
      text: f.oldReleaseProcess,
    })
    seed(fileCommitsQuery(f.OWNER, f.REPO, f.SHA, f.DOC), f.commits)
    seed(threadsQuery(f.OWNER, f.REPO, f.DOC), f.threads)
    seed(threadCountsQuery(f.OWNER, f.REPO), { [f.DOC]: 4, 'docs/on-call.md': 2 })
    return { preloadedTree: preloadTree(f.paths, f.DOC) }
  },
  component: function Preview() {
    const search = Route.useSearch()
    const { preloadedTree } = Route.useLoaderData()
    return (
      <FileViewer
        viewer={f.viewer}
        owner={f.OWNER}
        repo={f.REPO}
        splat={toSplat(f.REF, f.DOC)}
        search={search}
        preloadedTree={preloadedTree}
      />
    )
  },
})
