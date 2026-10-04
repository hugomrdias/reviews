import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import type { FileTreePreloadedData } from '@pierre/trees/react'
import { History } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CommitPicker } from '@/components/code/CommitPicker'
import { CompareView } from '@/components/code/CompareView'
import { SourceView } from '@/components/code/SourceView'
import { CommentsSheet, firstTab, groupThreads, type SheetTab } from '@/components/comments/CommentsSheet'
import { DraftComposer } from '@/components/comments/Composer'
import { DocumentComments } from '@/components/comments/DocumentComments'
import { ThreadCard, type ThreadLocation } from '@/components/comments/ThreadCard'
import { threadLink } from '@/components/comments/thread-link'
import { rawUrl, scrollToHash, type RepoContext } from '@/components/markdown/MarkdownView'
import { AppSidebar } from '@/components/shell/AppSidebar'
import { RepoHeader } from '@/components/shell/RepoHeader'
import {
  AppNotInstalled,
  DirectoryListing,
  FileMissing,
  RateLimited,
  RepoNotFound,
  RepoNotSelected,
  StatePage,
  UnviewableFile,
} from '@/components/states/States'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerVirtualKeyboardProvider,
} from '@/components/ui/drawer'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { useAnchoredThreads } from '@/hooks/useAnchoredThreads'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useThreadMutations } from '@/hooks/useThreadMutations'
import type { TextIndex } from '@/lib/anchoring/text-index'
import { offsetsToRange } from '@/lib/anchoring/text-index'
import { threadsForAgent } from '@/lib/agent-prompt'
import { toSplat } from '@/lib/links'
import { findReadme, isMarkdown } from '@/lib/paths'
import {
  fileCommitsQuery,
  fileQuery,
  locationQuery,
  threadCountsQuery,
  threadsQuery,
  treeQuery,
} from '@/lib/queries'
import { FULL_SHA_PATTERN } from '@/lib/refs'
import type { RepoSummary } from '@/functions/content'
import type { AnchorData, ThreadView } from '@/lib/threads'
import { recordRecent } from '@/lib/recent'
import { shortSha } from '@/lib/time'
import type { ViewerSearch } from '@/lib/viewer-search'
import type { SessionUser } from '@/server/auth/session'

const NO_THREADS: ThreadView[] = []
const NO_COUNTS: Record<string, number> = {}

type View = NonNullable<ViewerSearch['view']>

interface FileViewerProps {
  viewer: SessionUser
  owner: string
  repo: string
  splat: string
  search: ViewerSearch
  preloadedTree: FileTreePreloadedData | null
}

export function FileViewer({ viewer, owner, repo, splat, search, preloadedTree }: FileViewerProps) {
  const { data: loc } = useSuspenseQuery(locationQuery(owner, repo, splat))
  if (loc.status === 'app_not_installed') return <StatePage><AppNotInstalled owner={loc.owner} installUrl={loc.installUrl} /></StatePage>
  if (loc.status === 'repo_not_selected') return <StatePage><RepoNotSelected owner={loc.owner} settingsUrl={loc.settingsUrl} /></StatePage>
  if (loc.status === 'rate_limited') return <StatePage><RateLimited resetAt={loc.resetAt} /></StatePage>
  if (loc.status === 'not_found') return <StatePage><RepoNotFound /></StatePage>
  return (
    <RepoViewer
      viewer={viewer}
      repoSummary={loc.repo}
      refName={loc.location.ref}
      sha={loc.location.sha}
      path={loc.location.path}
      search={search}
      preloadedTree={preloadedTree}
    />
  )
}

interface RepoViewerProps {
  viewer: SessionUser
  repoSummary: RepoSummary
  refName: string
  sha: string
  path: string
  search: ViewerSearch
  preloadedTree: FileTreePreloadedData | null
}

function RepoViewer({ viewer, repoSummary, refName, sha, path, search, preloadedTree }: RepoViewerProps) {
  const { owner, name: repo } = repoSummary
  const navigate = useNavigate()
  const location = useLocation()
  const { data: tree } = useSuspenseQuery(treeQuery(owner, repo, sha))
  const { data: entry } = useSuspenseQuery(fileQuery(owner, repo, sha, path))
  const pathSet = useMemo(() => new Set(tree.paths), [tree.paths])

  // Folders show their README under the listing.
  const docPath = entry.kind === 'directory' ? (findReadme(path, pathSet) ?? path) : path
  const { data: doc } = useQuery({ ...fileQuery(owner, repo, sha, docPath), enabled: docPath !== path })
  const file = docPath === path ? entry : doc
  const text = file?.kind === 'text' ? file : null

  const { data: threads = NO_THREADS } = useQuery({ ...threadsQuery(owner, repo, docPath), enabled: Boolean(text) })
  const { data: counts = NO_COUNTS } = useQuery(threadCountsQuery(owner, repo))
  const mutations = useThreadMutations(owner, repo, docPath, repoSummary.permissions)

  const markdown = text !== null && isMarkdown(docPath)
  // A folder's README reads one way; a file also has its source and history.
  let views: View[] = []
  if (text && entry.kind === 'directory') views = [markdown ? 'rendered' : 'source']
  else if (text) views = markdown ? ['rendered', 'source', 'compare'] : ['source', 'compare']
  const requested = search.view ?? (markdown ? 'rendered' : 'source')
  const view = views.includes(requested) ? requested : (views[0] ?? 'rendered')

  // The text index belongs to one document and view; a stale one is ignored.
  const docKey = `${sha}:${docPath}:${view}`
  const [indexed, setIndexed] = useState<{ key: string; index: TextIndex } | null>(null)
  const index = indexed?.key === docKey ? indexed.index : null
  const [activeId, setActiveId] = useState<string | null>(search.thread ?? null)
  const [draft, setDraft] = useState<AnchorData | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTab, setSheetTab] = useState<SheetTab>('open')
  const [reveal, setReveal] = useState<string | null>(search.thread ?? null)
  const showMargin = useMediaQuery('(min-width: 1200px)')

  // A different document or view drops any unsent draft.
  const [draftKey, setDraftKey] = useState(docKey)
  if (draftKey !== docKey) {
    setDraftKey(docKey)
    setDraft(null)
  }

  const anchored = useAnchoredThreads({
    owner,
    repo,
    path: docPath,
    threads,
    blobSha: text?.blobSha ?? '',
    source: text?.text ?? '',
    renderedText: view === 'rendered' ? (index?.text ?? null) : null,
  })
  const groups = groupThreads(anchored)
  // Comments on the page that still need someone: the mobile button's count.
  const onPageCount = groups.open.length + groups.addressed.length

  // Compare view: base commit, its file, and threads placed on it.
  const { data: history = [] } = useQuery({
    ...fileCommitsQuery(owner, repo, sha, docPath),
    enabled: view === 'compare' && Boolean(text),
  })
  const baseRef = search.base ?? history.find((c, i) => i > 0 && c.sha !== sha)?.sha ?? null
  const { data: baseLoc } = useQuery({
    ...locationQuery(owner, repo, baseRef ?? ''),
    enabled: view === 'compare' && baseRef !== null && !FULL_SHA_PATTERN.test(baseRef),
  })
  const baseSha =
    baseRef && FULL_SHA_PATTERN.test(baseRef) ? baseRef : baseLoc?.status === 'ok' ? baseLoc.location.sha : null
  const { data: baseFile } = useQuery({
    ...fileQuery(owner, repo, baseSha ?? '', docPath),
    enabled: view === 'compare' && baseSha !== null,
  })
  const baseText = baseFile?.kind === 'text' ? baseFile : null
  const onBase = useAnchoredThreads({
    owner,
    repo,
    path: docPath,
    threads: view === 'compare' ? threads : NO_THREADS,
    blobSha: baseText?.blobSha ?? '',
    source: baseText?.text ?? '',
    renderedText: null,
  })

  const ctx = useMemo<RepoContext>(
    () => ({ owner, repo, ref: refName, sha, path: docPath, paths: tree.paths, pathSet }),
    [owner, repo, refName, sha, docPath, tree.paths, pathSet],
  )
  const threadLocation = useMemo<ThreadLocation>(() => ({ owner, repo, ref: refName, path: docPath }), [owner, repo, refName, docPath])

  const submitDraft = useCallback(
    async (body: string) => {
      if (!draft || !text) return
      const { id } = await mutations.create.mutateAsync({ commitSha: sha, blobSha: text.blobSha, anchor: draft, body })
      setDraft(null)
      setActiveId(id)
    },
    [draft, text, mutations.create, sha],
  )

  const copyForAgent = () => {
    if (!text) return
    const prompt = threadsForAgent({
      repo: `${owner}/${repo}`,
      ref: refName,
      sha,
      path: docPath,
      source: text.text,
      blobSha: text.blobSha,
      threads: anchored,
      threadUrl: threadLink,
    })
    navigator.clipboard.writeText(prompt).then(
      () => toast.success('Copied the open comments for your agent'),
      () => toast.error('Could not copy to the clipboard'),
    )
  }

  const onIndex = useCallback((next: TextIndex) => setIndexed({ key: docKey, index: next }), [docKey])
  const onDraft = useCallback((next: AnchorData | null) => {
    setDraft(next)
    if (next) setActiveId(null)
  }, [])

  // Remember this repo and file for "pick up where you left off".
  useEffect(() => {
    if (entry.kind === 'missing' || window.location.pathname.startsWith('/dev/')) return
    recordRecent({ owner, repo, ref: refName, path })
  }, [owner, repo, refName, path, entry.kind])

  // Scroll to a heading from the URL hash once the document is indexed.
  useEffect(() => {
    if (index && location.hash) scrollToHash(location.hash)
  }, [index, location.hash])

  // Bring a thread into view: its text in the page, or its note in code.
  useEffect(() => {
    if (!reveal) return
    const target = anchored.find((a) => a.thread.id === reveal)
    if (!target) return
    if (view === 'rendered' && target.text && index) {
      offsetsToRange(index, target.text.start, target.text.end)?.startContainer.parentElement?.scrollIntoView({
        block: 'center',
        behavior: 'smooth',
      })
    } else {
      document.querySelector(`[data-thread="${reveal}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
    setActiveId(reveal)
    setReveal(null)
  }, [reveal, anchored, view, index])

  const comparePicker =
    view === 'compare' && text ? (
      <CommitPicker
        owner={owner}
        repo={repo}
        headSha={sha}
        path={docPath}
        baseSha={baseSha}
        threads={threads}
        onSelect={(base) =>
          void navigate({ from: '/$owner/$repo/$', to: '.', search: (prev) => ({ ...prev, view: 'compare' as const, base }) })
        }
      />
    ) : null

  let body: React.ReactNode
  if (entry.kind === 'missing') body = <FileMissing path={path} refName={refName} />
  else if (entry.kind === 'image') {
    body = (
      <figure className="flex flex-col items-start gap-2">
        <img src={rawUrl(ctx, path)} alt={path} className="max-h-[75dvh] max-w-full rounded-md border bg-card" />
      </figure>
    )
  } else if (entry.kind === 'binary' || entry.kind === 'too-large' || entry.kind === 'lfs') {
    body = <UnviewableFile kind={entry.kind} path={path} rawHref={rawUrl(ctx, path)} />
  } else if (view === 'compare' && text) {
    body = baseSha ? (
      <CompareView
        path={docPath}
        base={{ sha: baseSha, text: baseText?.text ?? null }}
        head={{ sha, text: text.text }}
        onHead={anchored}
        onBase={onBase}
        location={threadLocation}
        activeId={activeId}
        onActivate={setActiveId}
        viewer={viewer}
        mutations={mutations}
      />
    ) : (
      <p className="text-muted-foreground">This file has only one version, so there's nothing to compare yet.</p>
    )
  } else if (view === 'source' && text) {
    body = (
      <SourceView
        source={text.text}
        blobSha={text.blobSha}
        location={threadLocation}
        anchored={anchored}
        activeId={activeId}
        onActivate={setActiveId}
        draft={draft?.kind === 'lines' ? draft : null}
        onDraft={onDraft}
        onSubmitDraft={submitDraft}
        viewer={viewer}
        mutations={mutations}
      />
    )
  } else if (text && markdown) {
    body = (
      <DocumentComments
        source={text.text}
        ctx={ctx}
        location={threadLocation}
        index={index}
        onIndex={onIndex}
        anchored={anchored}
        activeId={activeId}
        onActivate={setActiveId}
        draft={draft?.kind === 'text' ? draft : null}
        onDraft={onDraft}
        onSubmitDraft={submitDraft}
        viewer={viewer}
        mutations={mutations}
        showMargin={showMargin}
      />
    )
  }

  const activeThread = anchored.find((a) => a.thread.id === activeId)
  const mobileDrawerOpen = view === 'rendered' && !showMargin && Boolean(draft || activeThread)

  return (
    <SidebarProvider>
      <AppSidebar
        repo={repoSummary}
        refName={refName}
        sha={sha}
        paths={tree.paths}
        truncated={tree.truncated}
        path={path}
        counts={counts}
        preloadedTree={preloadedTree}
        viewer={viewer}
      />
      <SidebarInset className="min-w-0">
        <RepoHeader
          owner={owner}
          repo={repo}
          refName={refName}
          path={path}
          views={views}
          view={view}
          openCount={groups.open.length}
          addressedCount={groups.addressed.length}
          outdatedCount={groups.outdated.length}
          onOpenComments={() => {
            setSheetTab(firstTab(groups))
            setSheetOpen(true)
          }}
          actions={comparePicker}
        />
        {search.from && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-marker/40 px-4 py-2 text-sm md:px-8">
            <History className="size-4 shrink-0" />
            <span>
              You're reading this file as it was at <span className="font-mono">{shortSha(sha)}</span>, when the comment
              was written.
            </span>
            <Link
              to="/$owner/$repo/$"
              params={{ owner, repo, _splat: toSplat(search.from, docPath) }}
              search={{ thread: search.thread }}
              className="font-medium underline underline-offset-2"
            >
              Back to {search.from}
            </Link>
          </div>
        )}
        <div className="min-w-0 px-4 pt-8 pb-24 md:px-8 lg:px-12">
          {entry.kind === 'directory' && (
            <div className="mb-10">
              <DirectoryListing owner={owner} repo={repo} refName={refName} path={path} paths={tree.paths} />
            </div>
          )}
          {body}
        </div>
      </SidebarInset>

      <CommentsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        tab={sheetTab}
        onTabChange={setSheetTab}
        groups={groups}
        location={threadLocation}
        viewer={viewer}
        mutations={mutations}
        onReveal={(id) => {
          setSheetOpen(false)
          setReveal(id)
        }}
        onCopyForAgent={copyForAgent}
      />

      <Drawer
        showSwipeHandle
        open={mobileDrawerOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDraft(null)
            setActiveId(null)
          }
        }}
      >
        {/* The provider pins the page and sets --drawer-keyboard-inset while a field has focus.
            The sheet is short, so lift it above the keyboard rather than scrolling inside it. */}
        <DrawerVirtualKeyboardProvider>
          <DrawerContent className="max-h-[calc(85dvh-var(--drawer-keyboard-inset,0px))] data-[swipe-direction=down]:bottom-(--drawer-keyboard-inset,0px)">
            <DrawerHeader className="text-left">
              <DrawerTitle>{draft ? 'New comment' : 'Comment'}</DrawerTitle>
              <DrawerDescription className="line-clamp-2 font-serif italic">
                {draft?.quoteExact ?? activeThread?.thread.anchor.quoteExact}
              </DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto px-4 pt-1 pb-6">
              {draft ? (
                <DraftComposer mutations={mutations} onCancel={() => setDraft(null)} onSubmit={submitDraft} />
              ) : activeThread ? (
                <ThreadCard inline anchored={activeThread} location={threadLocation} viewer={viewer} mutations={mutations} active />
              ) : null}
            </div>
          </DrawerContent>
        </DrawerVirtualKeyboardProvider>
      </Drawer>

      {!showMargin && view === 'rendered' && onPageCount > 0 && !mobileDrawerOpen && (
        <Button
          className="fixed right-4 bottom-4 z-30 shadow-lg"
          onClick={() => {
            setSheetTab('open')
            setSheetOpen(true)
          }}
        >
          {onPageCount === 1 ? '1 comment' : `${onPageCount} comments`}
        </Button>
      )}
    </SidebarProvider>
  )
}
