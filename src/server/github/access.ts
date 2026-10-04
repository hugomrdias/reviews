import type { CommentPermissions } from '@/lib/threads'
import { cached, invalidate } from '../cache'
import type { ActiveSession } from '../auth/session'
import { githubJson, NotFoundError } from './client'

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
    const data = await githubJson<RepoResponse>(
      session.accessToken,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    )
    if (!data.private && !(await isInstalled(session, data.owner.id, data.id))) {
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
  })
}

interface Installation {
  id: number
  account: { login: string; id: number; type: 'User' | 'Organization' }
  repository_selection: 'all' | 'selected'
}

const installationsKey = (userId: number) => `installations:${userId}`
const installationReposKey = (userId: number, installationId: number) =>
  `installation-repos:${userId}:${installationId}`

/** Call after the user installs or changes the app on GitHub. */
export async function forgetInstallations(session: ActiveSession) {
  // Only the cached list knows which repo lists to drop; if GitHub is
  // unreachable, those still expire within a minute.
  const installations = await listInstallations(session).catch(() => [])
  await Promise.all([
    invalidate(installationsKey(session.user.id)),
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
  })
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

/** Repos in an installation that the user can read. */
export async function listInstallationRepos(session: ActiveSession, installationId: number) {
  // 100 per page; stop at 1,000 so a huge org can't stall the page.
  const repositories: InstallationRepo[] = []
  for (let page = 1; page <= 10; page++) {
    const data = await githubJson<{ total_count: number; repositories: InstallationRepo[] }>(
      session.accessToken,
      `/user/installations/${installationId}/repositories?per_page=100&page=${page}`,
    )
    repositories.push(...data.repositories)
    if (data.repositories.length < 100 || repositories.length >= data.total_count) break
  }
  return repositories
}

/** Whether the app is installed on the repo, in an installation the user can see. */
async function isInstalled(session: ActiveSession, ownerId: number, repoId: number) {
  const installation = (await listInstallations(session)).find((i) => i.accountId === ownerId)
  if (!installation) return false
  // Deliberate: anyone who can see an all-repos installation can open every
  // public repo of that owner, which saves listing a large org's repos.
  if (installation.selection === 'all') return true
  const ids = await cached(installationReposKey(session.user.id, installation.id), 60, async () =>
    (await listInstallationRepos(session, installation.id)).map((r) => r.id),
  )
  return ids.includes(repoId)
}

export type NoAccess =
  | { kind: 'not_found' }
  | { kind: 'repo_not_selected'; owner: string; settingsUrl: string }
  | { kind: 'app_not_installed'; owner: string; installUrl: string }

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
    return { kind: 'repo_not_selected', owner: match.login, settingsUrl }
  }
  try {
    const account = await githubJson<{ id: number; login: string }>(
      session.accessToken,
      `/users/${encodeURIComponent(owner)}`,
    )
    // Goes through /github/install, which remembers where to come back to.
    const installUrl = `/github/install?target_id=${account.id}`
    return { kind: 'app_not_installed', owner: account.login, installUrl }
  } catch (error) {
    if (error instanceof NotFoundError) return { kind: 'not_found' }
    throw error
  }
}
