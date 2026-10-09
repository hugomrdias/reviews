import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { CommentPermissions } from '@/lib/threads'
import { diagnoseNoAccess, listAllRepos, requireRepoAccess, type NoAccess } from '@/server/github/access'
import { NotFoundError, RateLimitError } from '@/server/github/client'
import {
  getBlobText,
  getFileCommits,
  getFileContent,
  getPathEntry,
  getTree,
  type FileContent,
} from '@/server/github/content'
import { resolveLocation as resolve, type Location } from '@/server/github/refs'
import { repoActivity } from '@/server/comments/store'
import { getDb } from '@/server/db/client'
import { authMiddleware, repoMiddleware } from '@/server/middleware'
import { fileInput, pathSchema, repoInput, shaSchema } from './schemas'

export interface RepoSummary {
  owner: string
  name: string
  fullName: string
  private: boolean
  defaultBranch: string
  permissions: CommentPermissions
}

export type LocationResult =
  | { status: 'ok'; repo: RepoSummary; location: Location }
  | { status: 'rate_limited'; resetAt: number }
  | NoAccess

/**
 * Resolves a viewer URL. Returns a result instead of throwing so the page can
 * explain what's wrong: missing app installation, unselected repo, unknown
 * ref, or rate limiting.
 */
export const resolveLocation = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(repoInput.extend({ splat: z.string().max(2048) }))
  .handler(async ({ data, context: { session } }): Promise<LocationResult> => {
    const checked = requireRepoAccess(session, data.owner, data.repo)
    // The ref resolves alongside the access check rather than after it, which
    // saves a GitHub round trip. It uses the user's own token, so it can't
    // read anything they couldn't, and nothing from it is returned until
    // access is confirmed. Refused access is handled below, not here.
    const defaultBranch = checked.then((a) => a.defaultBranch)
    defaultBranch.catch(() => {})
    const resolving = resolve(session.accessToken, data.owner, data.repo, data.splat, defaultBranch)
    resolving.catch(() => {})
    try {
      const access = await checked.catch(async (error): Promise<NoAccess> => {
        if (!(error instanceof NotFoundError)) throw error
        return diagnoseNoAccess(session, data.owner)
      })
      if ('status' in access) return access
      const location = await resolving
      return {
        status: 'ok',
        repo: {
          owner: access.owner,
          name: access.name,
          fullName: access.fullName,
          private: access.private,
          defaultBranch: access.defaultBranch,
          permissions: access.permissions,
        },
        location,
      }
    } catch (error) {
      if (error instanceof NotFoundError) return { status: 'not_found' }
      if (error instanceof RateLimitError) return { status: 'rate_limited', resetAt: error.resetAt }
      throw error
    }
  })

export const fetchTree = createServerFn({ method: 'GET' })
  .middleware([repoMiddleware])
  .validator(repoInput.extend({ sha: shaSchema }))
  .handler(async ({ data, context: { session, access } }) => {
    const tree = await getTree(session.accessToken, access.repoId, access.owner, access.name, data.sha)
    return { paths: tree.entries.map((e) => e.path), truncated: tree.truncated }
  })

export type FileResult = FileContent | { kind: 'directory'; path: string } | { kind: 'missing'; path: string }

export const fetchFile = createServerFn({ method: 'GET' })
  .middleware([repoMiddleware])
  .validator(fileInput)
  .handler(async ({ data, context: { session, access } }): Promise<FileResult> => {
    // Not from the tree: the page loads that alongside, and this doesn't wait for it.
    const found = await getPathEntry(session.accessToken, access.repoId, access.owner, access.name, data.sha, data.path)
    if (found.kind === 'file') {
      return getFileContent(session.accessToken, access.repoId, access.owner, access.name, found.entry)
    }
    return { kind: found.kind, path: data.path }
  })

/**
 * A text blob by its SHA, or null when it isn't text or GitHub doesn't have
 * it. Cheaper than fetchFile when the blob is already known: no path lookup.
 */
export const fetchBlobText = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(repoInput.extend({ blobSha: shaSchema }))
  .handler(async ({ data, context: { session } }) => {
    const access = await requireRepoAccess(session, data.owner, data.repo)
    try {
      return await getBlobText(session.accessToken, access.repoId, access.owner, access.name, data.blobSha)
    } catch (error) {
      if (error instanceof NotFoundError) return null
      throw error
    }
  })

export const fetchFileCommits = createServerFn({ method: 'GET' })
  .middleware([repoMiddleware])
  .validator(fileInput.extend({ path: pathSchema.min(1) }))
  .handler(async ({ data, context: { session, access } }) => {
    return getFileCommits(session.accessToken, access.owner, access.name, data.sha, data.path)
  })

export interface RepoListItem {
  account: string
  owner: string
  name: string
  fullName: string
  description: string | null
  private: boolean
  pushedAt: string | null
  /** Open comment threads on this repo. */
  openThreads: number
  /** When anyone last commented, if ever. */
  lastActivity: number | null
}

/**
 * Repos the user can open (those in app installations they can see), with
 * comment activity from D1 merged in. Newest pushes first.
 */
export const fetchRepos = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { session } }): Promise<RepoListItem[]> => {
    const repos = await listAllRepos(session)
    const activity = await repoActivity(
      getDb(),
      repos.map(({ repo: r }) => r.id),
    )
    return repos
      .map(({ account, repo: r }) => ({
        account,
        owner: r.owner.login,
        name: r.name,
        fullName: r.full_name,
        description: r.description,
        private: r.private,
        pushedAt: r.pushed_at,
        openThreads: activity.get(r.id)?.open ?? 0,
        lastActivity: activity.get(r.id)?.lastActivity ?? null,
      }))
      .sort((a, b) => (b.pushedAt ?? '').localeCompare(a.pushedAt ?? ''))
  })
