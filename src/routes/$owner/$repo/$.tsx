import { createFileRoute, redirect } from '@tanstack/react-router'
import { FileViewer } from '@/components/viewer/FileViewer'
import { ViewerPending } from '@/components/viewer/ViewerPending'
import { preloadTree } from '@/components/tree/preload'
import { basename, findReadme } from '@/lib/paths'
import { fileQuery, locationQuery, threadCountsQuery, threadsQuery, treeQuery } from '@/lib/queries'
import { viewerSearch } from '@/lib/viewer-search'

export const Route = createFileRoute('/$owner/$repo/$')({
  validateSearch: viewerSearch,
  beforeLoad: ({ context, location }) => {
    // The welcome page, not straight to GitHub: link previews fetch signed out,
    // and should show the app's card, not GitHub's sign-in page.
    if (!context.viewer) throw redirect({ to: '/', search: { returnTo: location.href } })
  },
  loader: async ({ context: { queryClient }, params }) => {
    const splat = params._splat ?? ''
    const loc = await queryClient.ensureQueryData(locationQuery(params.owner, params.repo, splat))
    if (loc.status !== 'ok') return { preloadedTree: null }

    // GitHub's names, not the URL's: the viewer reads its queries by them, and
    // the URL can use another case or a renamed repo's old name.
    const { owner, name: repo } = loc.repo
    const { sha, path } = loc.location
    // Counts only need the repo, so they load alongside the file. Comment
    // prefetches never throw: a failed one still shows the file.
    const counts = queryClient.prefetchQuery(threadCountsQuery(owner, repo))
    const [tree, file] = await Promise.all([
      queryClient.ensureQueryData(treeQuery(owner, repo, sha)),
      queryClient.ensureQueryData(fileQuery(owner, repo, sha, path)),
    ])
    // Folders show their README, like GitHub.
    let docPath = path
    let doc = file
    if (file.kind === 'directory') {
      const readme = findReadme(path, new Set(tree.paths))
      if (readme) {
        docPath = readme
        doc = await queryClient.ensureQueryData(fileQuery(owner, repo, sha, readme))
      }
    }
    // The viewer only shows threads on text.
    const threads = doc.kind === 'text' ? queryClient.prefetchQuery(threadsQuery(owner, repo, docPath)) : null
    // The server waits so its HTML has the comment counts the client hydrates
    // with (a streamed prefetch could land after the HTML). The browser
    // doesn't need to.
    if (import.meta.env.SSR) await Promise.all([counts, threads])
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
