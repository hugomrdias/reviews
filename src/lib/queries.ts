import { queryOptions } from '@tanstack/react-query'
import { listConnectedAgents } from '@/functions/agents'
import { getThreadCounts, listThreads } from '@/functions/comments'
import { fetchBlobText, fetchFile, fetchFileCommits, fetchRepos, fetchTree, resolveLocation } from '@/functions/content'
import { getViewer } from '@/functions/viewer'

// Anything keyed by a commit or blob SHA never changes, so it never goes stale.

/**
 * Signing in and out are full page loads, so the viewer can't change during
 * a visit. The server render fetches it and the browser reuses that, instead
 * of asking again on every navigation and preload.
 */
export const viewerQuery = () =>
  queryOptions({
    queryKey: ['viewer'],
    queryFn: () => getViewer(),
    staleTime: Infinity,
    gcTime: Infinity,
  })

export const locationQuery = (owner: string, repo: string, splat: string) =>
  queryOptions({
    queryKey: ['location', owner, repo, splat],
    queryFn: () => resolveLocation({ data: { owner, repo, splat } }),
    staleTime: 60_000,
  })

export const treeQuery = (owner: string, repo: string, sha: string) =>
  queryOptions({
    queryKey: ['tree', owner, repo, sha],
    queryFn: () => fetchTree({ data: { owner, repo, sha } }),
    staleTime: Infinity,
  })

export const fileQuery = (owner: string, repo: string, sha: string, path: string) =>
  queryOptions({
    queryKey: ['file', owner, repo, sha, path],
    queryFn: () => fetchFile({ data: { owner, repo, sha, path } }),
    staleTime: Infinity,
  })

export const blobTextQuery = (owner: string, repo: string, blobSha: string) =>
  queryOptions({
    queryKey: ['blob', owner, repo, blobSha],
    queryFn: () => fetchBlobText({ data: { owner, repo, blobSha } }),
    staleTime: Infinity,
  })

export const fileCommitsQuery = (owner: string, repo: string, sha: string, path: string) =>
  queryOptions({
    queryKey: ['commits', owner, repo, sha, path],
    queryFn: () => fetchFileCommits({ data: { owner, repo, sha, path } }),
    staleTime: Infinity,
  })

export const threadsQuery = (owner: string, repo: string, path: string) =>
  queryOptions({
    queryKey: ['threads', owner, repo, path],
    queryFn: () => listThreads({ data: { owner, repo, path } }),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })

export const threadCountsQuery = (owner: string, repo: string) =>
  queryOptions({
    queryKey: ['threadCounts', owner, repo],
    queryFn: () => getThreadCounts({ data: { owner, repo } }),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  })

export const reposQuery = () =>
  queryOptions({
    queryKey: ['repos'],
    queryFn: () => fetchRepos(),
    staleTime: 30_000,
    // People install the app in another tab, then come back.
    refetchOnWindowFocus: true,
  })

export const connectedAgentsQuery = () =>
  queryOptions({
    queryKey: ['connected-agents'],
    queryFn: () => listConnectedAgents(),
  })
