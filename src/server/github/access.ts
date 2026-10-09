import { CodedError } from '@/lib/errors'
import type { CommentPermissions } from '@/lib/threads'
import { cached, invalidate } from '../cache'
import type { ActiveSession } from '../auth/session'
import { githubJson, NotFoundError, repoBase } from './client'

export interface RepoAccess {
  repoId: number
  owner: string
  name: string
  fullName: string
  private: boolean
  defaultBranch: string
  ownerId: number
  permissions: CommentPermissions
}

interface RepoResponse {
  id: number
  name: string
  full_name: string
  private: boolean
  default_branch: string
  owner: { login: string; id: number }
  /** The signed-in user's role on the repo. */
  permissions?: { admin: boolean; maintain?: boolean; push: boolean; triage?: boolean; pull: boolean }
}

/**
 * Access checks are fresh for a minute, then served for up to five more while
 * they refresh in the background, so an expired check doesn't put GitHub's
 * latency in front of the page. Revoked access can last that long; a refresh
 * that fails drops the entry.
 */
const ACCESS_CACHE = { staleSeconds: 5 * 60 }

/**
 * Confirms the signed-in user can read the repo, using their own token.
 * Throws NotFoundError otherwise. Every server function that touches a repo,
 * including every comment read and write, goes through this.
 *
 * A user token can read any public repo, installed or not, so public repos
 * also have to be in one of the user's installations. Private repos already
 * 404 when the app isn't installed on them.
 */
export function requireRepoAccess(session: ActiveSession, owner: string, repo: string) {
  const key = `repo-access:${session.user.id}:${owner.toLowerCase()}/${repo.toLowerCase()}`
  return cached<RepoAccess>(key, 60, async () => {
    // Fetched alongside the repo rather than after it, which saves a GitHub
    // round trip for public repos. Private repos don't need it, and it's
    // cached per user, so the extra call is cheap.
    const installations = listInstallations(session)
    installations.catch(() => {})
    const data = await githubJson<RepoResponse>(session.accessToken, repoBase(owner, repo))
    if (!data.private && !(await isInstalled(session, await installations, data.owner.id, data.id))) {
      throw new NotFoundError(`Not installed: ${data.full_name}`, 404)
    }
    const role = data.permissions
    const maintainer = Boolean(role?.admin || role?.maintain)
    return {
      repoId: data.id,
      owner: data.owner.login,
      name: data.name,
      fullName: data.full_name,
      private: data.private,
      defaultBranch: data.default_branch,
      ownerId: data.owner.id,
      permissions: { comment: maintainer || Boolean(role?.push), moderate: maintainer },
    }
  }, ACCESS_CACHE)
}

/**
 * requireRepoAccess for server functions and routes: a repo the user can't
 * read throws NO_ACCESS instead of GitHub's 404, so callers needn't tell
 * "can't see the repo" apart from any other 404 themselves.
 */
export async function checkRepoAccess(session: ActiveSession, owner: string, repo: string) {
  try {
    return await requireRepoAccess(session, owner, repo)
  } catch (error) {
    if (error instanceof NotFoundError) throw new CodedError('NO_ACCESS')
    throw error
  }
}

interface Installation {
  id: number
  account: { login: string; id: number; type: 'User' | 'Organization' }
  repository_selection: 'all' | 'selected'
}

const installationsKey = (userId: number) => `installations:${userId}`
const installationReposKey = (userId: number, installationId: number) =>
  `installation-repo-list:${userId}:${installationId}`
const reposListKey = (userId: number) => `repos-list:${userId}`

/** Call after the user installs or changes the app on GitHub. */
export async function forgetInstallations(session: ActiveSession) {
  // Only the cached list knows which repo lists to drop; if GitHub is
  // unreachable, those still expire within a minute.
  const installations = await listInstallations(session).catch(() => [])
  await Promise.all([
    invalidate(installationsKey(session.user.id)),
    invalidate(reposListKey(session.user.id)),
    ...installations.map((i) => invalidate(installationReposKey(session.user.id, i.id))),
  ])
}

/** Installations of the app on accounts where the user can read at least one repo. */
export function listInstallations(session: ActiveSession) {
  return cached(installationsKey(session.user.id), 60, async () => {
    const data = await githubJson<{ installations: Installation[] }>(
      session.accessToken,
      '/user/installations?per_page=100',
    )
    return data.installations.map((i) => ({
      id: i.id,
      login: i.account.login,
      accountId: i.account.id,
      type: i.account.type,
      selection: i.repository_selection,
    }))
  }, ACCESS_CACHE)
}

export interface InstallationRepo {
  id: number
  full_name: string
  name: string
  description: string | null
  owner: { login: string }
  private: boolean
  default_branch: string
  pushed_at: string | null
}

interface InstallationReposPage {
  total_count: number
  repositories: InstallationRepo[]
}

// How many pages each installation's repo list had when this isolate last
// listed it, so the next listing asks for them all at once.
const knownPages = new Map<string, number>()
const MAX_REPO_PAGES = 10

/** Repos in an installation that the user can read. */
export function listInstallationRepos(session: ActiveSession, installationId: number) {
  const key = installationReposKey(session.user.id, installationId)
  return cached(key, 60, async () => {
    const page = (n: number) =>
      githubJson<InstallationReposPage>(
        session.accessToken,
        `/user/installations/${installationId}/repositories?per_page=100&page=${n}`,
      )
    const pages = (from: number, to: number) =>
      Promise.all(Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => page(from + i)))
    // 100 per page. The first page gives the total, so without a known count
    // the rest wait for it. Stop at 1,000 so a huge org can't stall the page.
    const guess = knownPages.get(key) ?? 1
    const head = await pages(1, guess)
    const total = Math.min(MAX_REPO_PAGES, Math.ceil(head[0].total_count / 100))
    const tail = await pages(guess + 1, total)
    if (knownPages.size > 10_000) knownPages.clear()
    knownPages.set(key, Math.max(1, total))
    // Pages past the total, from a count that went down, are empty anyway.
    return [...head, ...tail]
      .slice(0, total)
      .flatMap((p) => p.repositories)
      .map(
        (r): InstallationRepo => ({
          id: r.id,
          full_name: r.full_name,
          name: r.name,
          description: r.description,
          owner: { login: r.owner.login },
          private: r.private,
          default_branch: r.default_branch,
          pushed_at: r.pushed_at,
        }),
      )
  }, ACCESS_CACHE)
}

export interface ListedRepo {
  /** The installation's account. */
  account: string
  repo: InstallationRepo
}

/**
 * Every repo in the user's installations, for the home page's list. Only
 * listed there, never used to grant access, so it's served stale for a day
 * while it refreshes in the background. Listing a big installation takes
 * GitHub seconds, and the home page would otherwise wait for it on the first
 * visit after a few quiet minutes. A repo that was removed shows until that
 * refresh lands, and opening it still checks access.
 */
export function listAllRepos(session: ActiveSession) {
  return cached(
    reposListKey(session.user.id),
    60,
    async (): Promise<ListedRepo[]> => {
      const installations = await listInstallations(session)
      const lists = await Promise.all(
        installations.map(async (installation) => {
          const repositories = await listInstallationRepos(session, installation.id)
          return repositories.map((repo) => ({ account: installation.login, repo }))
        }),
      )
      return lists.flat()
    },
    { staleSeconds: 24 * 60 * 60 },
  )
}

/** Whether the app is installed on the repo, in an installation the user can see. */
async function isInstalled(
  session: ActiveSession,
  installations: Awaited<ReturnType<typeof listInstallations>>,
  ownerId: number,
  repoId: number,
) {
  const installation = installations.find((i) => i.accountId === ownerId)
  if (!installation) return false
  // Deliberate: anyone who can see an all-repos installation can open every
  // public repo of that owner, which saves listing a large org's repos.
  if (installation.selection === 'all') return true
  const repos = await listInstallationRepos(session, installation.id)
  return repos.some((r) => r.id === repoId)
}

export type NoAccess =
  | { status: 'not_found' }
  | { status: 'repo_not_selected'; owner: string; settingsUrl: string }
  | { status: 'app_not_installed'; owner: string; installUrl: string }

/**
 * A user token only sees private repos where the GitHub App is installed, and
 * public repos only count when they are installed too. When a repo is refused,
 * work out whether the app is missing, the repo isn't selected in the
 * installation, or the repo really doesn't exist for this user.
 */
export async function diagnoseNoAccess(session: ActiveSession, owner: string): Promise<NoAccess> {
  const installations = await listInstallations(session)
  const match = installations.find((i) => i.login.toLowerCase() === owner.toLowerCase())
  if (match) {
    const settingsUrl =
      match.type === 'Organization'
        ? `https://github.com/organizations/${match.login}/settings/installations/${match.id}`
        : `https://github.com/settings/installations/${match.id}`
    return { status: 'repo_not_selected', owner: match.login, settingsUrl }
  }
  try {
    const account = await githubJson<{ id: number; login: string }>(
      session.accessToken,
      `/users/${encodeURIComponent(owner)}`,
    )
    // Goes through /github/install, which remembers where to come back to.
    const installUrl = `/github/install?target_id=${account.id}`
    return { status: 'app_not_installed', owner: account.login, installUrl }
  } catch (error) {
    if (error instanceof NotFoundError) return { status: 'not_found' }
    throw error
  }
}
