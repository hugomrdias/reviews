import { Link } from '@tanstack/react-router'
import { MessageSquare } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { toSplat } from '@/lib/links'
import type { ViewerSearch } from '@/lib/viewer-search'
import { cn } from '@/lib/utils'

type View = NonNullable<ViewerSearch['view']>

interface RepoHeaderProps {
  owner: string
  repo: string
  refName: string
  path: string
  views: View[]
  view: View
  openCount: number
  addressedCount: number
  outdatedCount: number
  onOpenComments: () => void
  /** Extra controls for the current view, such as the commit picker. */
  actions?: ReactNode
}

const VIEW_LABEL: Record<View, string> = { rendered: 'Page', source: 'Source', compare: 'Changes' }

export function RepoHeader({
  owner,
  repo,
  refName,
  path,
  views,
  view,
  openCount,
  addressedCount,
  outdatedCount,
  onOpenComments,
  actions,
}: RepoHeaderProps) {
  const segments = path ? path.split('/') : []
  return (
    <header className="sticky top-0 z-30 flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-background/90 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="data-vertical:h-4 data-vertical:self-center" />
      <nav aria-label="File path" className="flex min-w-0 flex-1 items-center gap-1 text-sm">
        <Link
          to="/$owner/$repo/$"
          params={{ owner, repo, _splat: toSplat(refName, '') }}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          {repo}
        </Link>
        {segments.map((segment, i) => {
          const last = i === segments.length - 1
          return (
            <Fragment key={i}>
              <span className="text-muted-foreground/60" aria-hidden>
                /
              </span>
              {last ? (
                <span className="truncate font-medium" aria-current="page">
                  {segment}
                </span>
              ) : (
                <Link
                  to="/$owner/$repo/$"
                  params={{ owner, repo, _splat: toSplat(refName, segments.slice(0, i + 1).join('/')) }}
                  className="truncate text-muted-foreground hover:text-foreground"
                >
                  {segment}
                </Link>
              )}
            </Fragment>
          )
        })}
      </nav>

      <div className="flex items-center gap-2">
        {actions}
        {views.length > 1 && (
          <div role="tablist" aria-label="View" className="inline-flex rounded-md bg-muted p-0.5">
            {views.map((v) => (
              <Link
                key={v}
                role="tab"
                aria-selected={v === view}
                from="/$owner/$repo/$"
                to="."
                search={(prev: ViewerSearch) => ({ ...prev, view: v === 'rendered' ? undefined : v })}
                className={cn(
                  'rounded-[5px] px-2.5 py-1 text-sm transition-colors',
                  v === view ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {VIEW_LABEL[v]}
              </Link>
            ))}
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={onOpenComments} aria-label="All comments on this file">
          <MessageSquare />
          <span className="tabular-nums">{openCount}</span>
          {addressedCount > 0 && (
            <span className="rounded-sm bg-marker px-1 text-xs tabular-nums text-foreground">
              {addressedCount} addressed
            </span>
          )}
          {outdatedCount > 0 && (
            <span className="rounded-sm bg-marker px-1 text-xs tabular-nums text-foreground">
              {outdatedCount} outdated
            </span>
          )}
        </Button>
      </div>
    </header>
  )
}
