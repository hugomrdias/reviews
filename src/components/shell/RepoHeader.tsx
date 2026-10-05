import { Link } from '@tanstack/react-router'
import { CheckCheck, MessageSquare, Unlink } from 'lucide-react'
import { Fragment } from 'react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
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
}: RepoHeaderProps) {
  const segments = path ? path.split('/') : []
  const commentSummary = [
    `${openCount} open`,
    addressedCount > 0 && `${addressedCount} addressed`,
    outdatedCount > 0 && `${outdatedCount} outdated`,
  ]
    .filter(Boolean)
    .join(', ')
  return (
    <header className="sticky top-0 z-30 flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 border-b bg-background/90 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="data-vertical:h-4 data-vertical:self-center" />
      <nav aria-label="File path" className="flex min-w-0 flex-1 basis-56 items-center gap-1 text-sm">
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
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="gap-2"
                onClick={onOpenComments}
                aria-label={`Comments: ${commentSummary}`}
              />
            }
          >
            <span className="inline-flex items-center gap-1 tabular-nums">
              <MessageSquare />
              {openCount}
            </span>
            {addressedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-muted-foreground tabular-nums">
                <CheckCheck />
                {addressedCount}
              </span>
            )}
            {outdatedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-muted-foreground tabular-nums">
                <Unlink />
                {outdatedCount}
              </span>
            )}
          </TooltipTrigger>
          <TooltipContent>{commentSummary}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
