import { useNavigate } from '@tanstack/react-router'
import { Command } from 'cmdk'
import { ArrowRight, Lock, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Kbd } from '@/components/ui/kbd'
import type { RepoListItem } from '@/functions/content'
import { toSplat } from '@/lib/links'
import { readRecent, type RecentRepo } from '@/lib/recent'
import { relativeTime } from '@/lib/time'
import { cn } from '@/lib/utils'

const COLLAPSED_COUNT = 25

/** Accepts "owner/repo", "owner/repo/path", or any github.com link into a repo. */
export function parseRepoInput(value: string) {
  const trimmed = value.trim().replace(/\.git$/, '')
  const fromUrl = trimmed.match(/github\.com\/([^/\s]+)\/([^/\s#?]+)(?:\/(?:blob|tree)\/([^\s#?]+))?/)
  if (fromUrl) return { owner: fromUrl[1], repo: fromUrl[2], splat: fromUrl[3] ?? '' }
  const plain = trimmed.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/)
  return plain ? { owner: plain[1], repo: plain[2], splat: '' } : null
}

/**
 * Plain, predictable ranking instead of cmdk's fuzzy match, which pulls in
 * anything whose description happens to contain the letters in order.
 * Name matches first, then owner, then words in the description.
 */
function rankRepo(value: string, search: string, keywords: string[] = []) {
  if (value.startsWith('open-link ')) return 1
  const q = search.trim().toLowerCase()
  if (!q) return 1
  const [name = '', owner = '', description = ''] = keywords.map((k) => k.toLowerCase())
  if (name === q) return 1
  if (name.startsWith(q)) return 0.9
  if (name.includes(q)) return 0.8
  if (value.toLowerCase().includes(q) || owner.includes(q)) return 0.6
  const words = q.split(/\s+/)
  if (words.every((w) => description.includes(w))) return 0.3
  return 0
}

function Row({
  title,
  detail,
  meta,
  value,
  keywords,
  onSelect,
}: {
  title: ReactNode
  detail?: ReactNode
  meta?: ReactNode
  value: string
  keywords?: string[]
  onSelect: () => void
}) {
  return (
    <Command.Item
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      className="group flex cursor-pointer items-center gap-4 rounded-md px-3 py-2.5 outline-none data-[selected=true]:bg-accent"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[0.9375rem]">{title}</div>
        {detail && <div className="truncate text-sm text-muted-foreground">{detail}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">{meta}</div>
    </Command.Item>
  )
}

function RepoTitle({ repo, showOwner }: { repo: Pick<RepoListItem, 'owner' | 'name' | 'private'>; showOwner: boolean }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <span className="truncate">
        {showOwner && <span className="text-muted-foreground">{repo.owner}/</span>}
        <span className="font-semibold">{repo.name}</span>
      </span>
      {repo.private && <Lock className="size-3 shrink-0 text-muted-foreground" aria-label="Private" />}
    </span>
  )
}

function OpenCount({ n }: { n: number }) {
  return (
    <span className="rounded-sm bg-marker px-1.5 py-0.5 font-medium text-foreground tabular-nums">
      {n === 1 ? '1 open comment' : `${n} open comments`}
    </span>
  )
}

function Heading({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-3 pt-4 pb-1.5">
      <span className="text-sm font-semibold text-foreground">{children}</span>
      {action}
    </div>
  )
}

interface RepoLauncherProps {
  repos: RepoListItem[]
  viewerLogin: string
}

/**
 * The signed-in home page: one search box over every repository, with what
 * you were reading and where people are commenting above the full list.
 */
export function RepoLauncher({ repos, viewerLogin }: RepoLauncherProps) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [account, setAccount] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [recent, setRecent] = useState<RecentRepo[]>([])

  useEffect(() => setRecent(readRecent()), [])

  // ⌘K / Ctrl+K or "/" jumps to the search box.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')
      if (((e.metaKey || e.ctrlKey) && e.key === 'k') || (e.key === '/' && !typing)) {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const accounts = useMemo(() => [...new Set(repos.map((r) => r.account))], [repos])
  const multipleOwners = accounts.length > 1 || repos.some((r) => r.owner !== viewerLogin)
  const byName = useMemo(() => new Map(repos.map((r) => [r.fullName.toLowerCase(), r])), [repos])

  const searching = search.trim().length > 0
  const link = parseRepoInput(search)
  const linkKnown = link && byName.has(`${link.owner}/${link.repo}`.toLowerCase())

  const active = useMemo(
    () =>
      repos
        .filter((r) => r.openThreads > 0)
        .sort((a, b) => (b.lastActivity ?? 0) - (a.lastActivity ?? 0))
        .slice(0, 5),
    [repos],
  )
  const filtered = account ? repos.filter((r) => r.account === account) : repos
  const visible = searching || expanded ? filtered : filtered.slice(0, COLLAPSED_COUNT)

  const open = (owner: string, repo: string, splat = '') =>
    void navigate({ to: '/$owner/$repo/$', params: { owner, repo, _splat: splat } })

  return (
    <Command
      label="Find a repository"
      loop
      filter={rankRepo}
      className="overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgb(27_34_48/0.04),0_12px_32px_-16px_rgb(27_34_48/0.18)]"
    >
      <div className="flex items-center gap-3 border-b px-4">
        <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        <Command.Input
          ref={inputRef}
          value={search}
          onValueChange={setSearch}
          autoFocus
          placeholder={repos.length > 0 ? `Search ${repos.length} repositories, or paste a GitHub link` : 'Paste a GitHub link to open a repository'}
          className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </div>

      <Command.List className="max-h-none p-1.5 pb-2">
        <Command.Empty className={cn('px-3 py-10 text-center text-sm text-muted-foreground', (!searching || link) && 'hidden')}>
          No repository matches “{search.trim()}”. Paste a GitHub link to open any repository your account can read.
        </Command.Empty>

        {link && !linkKnown && (
          <Command.Group forceMount>
            <Row
              value={`open-link ${search}`}
              keywords={[search]}
              onSelect={() => open(link.owner, link.repo, link.splat)}
              title={
                <span className="inline-flex items-center gap-2">
                  <ArrowRight className="size-4" />
                  Open <span className="font-semibold">{link.owner}/{link.repo}</span>
                </span>
              }
              detail={link.splat ? link.splat : 'Any repository your GitHub account can read'}
            />
          </Command.Group>
        )}

        {!searching && recent.length > 0 && (
          <Command.Group heading={<Heading>Pick up where you left off</Heading>}>
            {recent.map((r) => (
              <Row
                key={`recent-${r.owner}/${r.repo}`}
                value={`recent ${r.owner}/${r.repo}`}
                onSelect={() => open(r.owner, r.repo, toSplat(r.ref, r.path))}
                title={
                  <RepoTitle
                    repo={{
                      owner: r.owner,
                      name: r.repo,
                      private: byName.get(`${r.owner}/${r.repo}`.toLowerCase())?.private ?? false,
                    }}
                    showOwner={multipleOwners || r.owner.toLowerCase() !== viewerLogin.toLowerCase()}
                  />
                }
                detail={r.path || 'Repository home'}
                meta={relativeTime(r.at)}
              />
            ))}
          </Command.Group>
        )}

        {!searching && active.length > 0 && (
          <Command.Group heading={<Heading>Open comments</Heading>}>
            {active.map((r) => (
              <Row
                key={`active-${r.fullName}`}
                value={`active ${r.fullName}`}
                onSelect={() => open(r.owner, r.name)}
                title={<RepoTitle repo={r} showOwner={multipleOwners} />}
                detail={r.lastActivity ? `Last comment ${relativeTime(r.lastActivity)}` : undefined}
                meta={<OpenCount n={r.openThreads} />}
              />
            ))}
          </Command.Group>
        )}

        {repos.length > 0 && (
          <Command.Group
            heading={
              <Heading
                action={
                  accounts.length > 1 && (
                    <div className="flex gap-1" role="group" aria-label="Filter by account">
                      {[null, ...accounts].map((a) => (
                        <button
                          key={a ?? 'all'}
                          type="button"
                          aria-pressed={account === a}
                          onClick={() => setAccount(a)}
                          className={cn(
                            'rounded-md px-2 py-0.5 text-xs',
                            account === a
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent',
                          )}
                        >
                          {a ?? 'All'}
                        </button>
                      ))}
                    </div>
                  )
                }
              >
                {searching ? 'Repositories' : `All repositories (${filtered.length})`}
              </Heading>
            }
          >
            {visible.map((r) => (
              <Row
                key={r.fullName}
                value={r.fullName}
                keywords={[r.name, r.owner, r.description ?? '']}
                onSelect={() => open(r.owner, r.name)}
                title={<RepoTitle repo={r} showOwner={multipleOwners} />}
                detail={r.description ?? undefined}
                meta={
                  <>
                    {r.openThreads > 0 && <OpenCount n={r.openThreads} />}
                    {r.pushedAt && <span className="hidden sm:inline">Updated {relativeTime(r.pushedAt)}</span>}
                  </>
                }
              />
            ))}
            {!searching && !expanded && filtered.length > COLLAPSED_COUNT && (
              <Command.Item
                value="show-all-repositories"
                onSelect={() => setExpanded(true)}
                className="mt-1 cursor-pointer rounded-md px-3 py-2.5 text-sm text-link outline-none data-[selected=true]:bg-accent"
              >
                Show all {filtered.length} repositories
              </Command.Item>
            )}
          </Command.Group>
        )}
      </Command.List>
    </Command>
  )
}
