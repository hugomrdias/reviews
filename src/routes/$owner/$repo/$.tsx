import { createFileRoute, redirect } from '@tanstack/react-router'
import { FileViewer, ViewerPending } from '@/components/viewer/FileViewer'
import { preloadTree } from '@/components/tree/preload'
import { basename, findReadme } from '@/lib/paths'
import { fileQuery, locationQuery, threadCountsQuery, threadsQuery, treeQuery } from '@/lib/queries'
import { viewerSearch } from '@/lib/viewer-search'

export const Route = createFileRoute('/$owner/$repo/$')({
  validateSearch: viewerSearch,
  beforeLoad: ({ context, location }) => {
    if (!context.viewer) {
      throw redirect({ href: `/auth/login?returnTo=${encodeURIComponent(location.href)}`, reloadDocument: true })
    }
  },
  loader: async ({ context: { queryClient }, params }) => {
    const { owner, repo } = params
    const splat = params._splat ?? ''
    const loc = await queryClient.ensureQueryData(locationQuery(owner, repo, splat))
    if (loc.status !== 'ok') return { preloadedTree: null }

    const { sha, path } = loc.location
    const [tree, file] = await Promise.all([
      queryClient.ensureQueryData(treeQuery(owner, repo, sha)),
      queryClient.ensureQueryData(fileQuery(owner, repo, sha, path)),
    ])
    // Folders show their README, like GitHub.
    let docPath = path
    if (file.kind === 'directory') {
      const readme = findReadme(path, new Set(tree.paths))
      if (readme) {
        docPath = readme
        await queryClient.ensureQueryData(fileQuery(owner, repo, sha, readme))
      }
    }
    // Awaited so the server renders the same comment counts the client
    // hydrates with (a streamed prefetch could land after the HTML).
    await Promise.all([
      queryClient.ensureQueryData(threadsQuery(owner, repo, docPath)),
      queryClient.ensureQueryData(threadCountsQuery(owner, repo)),
    ])
    return { preloadedTree: preloadTree(tree.paths, path) }
  },
  head: ({ params }) => {
    const name = basename(params._splat ?? '') || params.repo
    return { meta: [{ title: `${name} in ${params.owner}/${params.repo}` }] }
  },
  pendingComponent: ViewerPending,
  component: function ViewerRoute() {
    const params = Route.useParams()
    const search = Route.useSearch()
    const { preloadedTree } = Route.useLoaderData()
    const { viewer } = Route.useRouteContext()
    return (
      <FileViewer
        viewer={viewer!}
        owner={params.owner}
        repo={params.repo}
        splat={params._splat ?? ''}
        search={search}
        preloadedTree={preloadedTree}
      />
    )
  },
})
