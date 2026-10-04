import { Link } from '@tanstack/react-router'
import { GitBranch, Lock } from 'lucide-react'
import type { FileTreePreloadedData } from '@pierre/trees/react'
import { RepoTree } from '@/components/tree/RepoTree'
import { Badge } from '@/components/ui/badge'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from '@/components/ui/sidebar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { RepoSummary } from '@/functions/content'
import { FULL_SHA_PATTERN } from '@/lib/refs'
import { shortSha } from '@/lib/time'
import type { SessionUser } from '@/server/auth/session'
import { UserMenu } from './UserMenu'

interface AppSidebarProps {
  repo: RepoSummary
  refName: string
  sha: string
  paths: readonly string[]
  truncated: boolean
  path: string
  counts: Record<string, number>
  preloadedTree?: FileTreePreloadedData | null
  viewer: SessionUser
}

export function AppSidebar({
  repo,
  refName,
  sha,
  paths,
  truncated,
  path,
  counts,
  preloadedTree,
  viewer,
}: AppSidebarProps) {
  const isSha = FULL_SHA_PATTERN.test(refName)
  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="gap-2 px-3 pt-3 pb-2">
        <Link to="/" className="text-xs text-muted-foreground hover:text-foreground">
          Repositories
        </Link>
        <Link
          to="/$owner/$repo/$"
          params={{ owner: repo.owner, repo: repo.name, _splat: '' }}
          className="flex min-w-0 items-center gap-1.5 text-[0.9375rem] leading-tight font-semibold"
        >
          <span className="truncate">
            <span className="font-normal text-muted-foreground">{repo.owner}/</span>
            {repo.name}
          </span>
          {repo.private && <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Private" />}
        </Link>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="w-fit max-w-full gap-1 font-mono text-[11px] font-normal">
              <GitBranch className="size-3" />
              <span className="truncate">{isSha ? shortSha(refName) : refName}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Showing commit {shortSha(sha)}</TooltipContent>
        </Tooltip>
      </SidebarHeader>
      <SidebarContent className="min-h-0 gap-0 overflow-hidden">
        {truncated && (
          <p className="mx-3 mb-2 rounded-md bg-sidebar-accent px-2 py-1.5 text-xs text-muted-foreground">
            This repository is too large to list every file.
          </p>
        )}
        <div className="min-h-0 flex-1">
          <RepoTree
            owner={repo.owner}
            repo={repo.name}
            ref={refName}
            sha={sha}
            paths={paths}
            path={path}
            counts={counts}
            preloaded={preloadedTree}
          />
        </div>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <UserMenu viewer={viewer} align="start" />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
