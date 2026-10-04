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
}

interface RepoResponse {
  id: number
  name: string
  full_name: string
  private: boolean
  default_branch: string
  owner: { login: string; id: number }
}

/**
 * Confirms the signed-in user can read the repo, using their own token.
 * Throws NotFoundError otherwise. Every server function that touches a repo,
 * including every comment read and write, goes through this.
 */
export function requireRepoAccess(session: ActiveSession, owner: string, repo: string) {
  const key = `access:${session.user.id}:${owner.toLowerCase()}/${repo.toLowerCase()}`
  return cached<RepoAccess>(key, 60, async () => {
    const data = await githubJson<RepoResponse>(
      session.accessToken,
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    )
    return {
      repoId: data.id,
      owner: data.owner.login,
      name: data.name,
      fullName: data.full_name,
      private: data.private,
      defaultBranch: data.default_branch,
      ownerId: data.owner.id,
    }
  })
}

interface Installation {
  id: number
  account: { login: string; id: number; type: 'User' | 'Organization' }
}

const installationsKey = (userId: number) => `installations:${userId}`

/** Call after the user installs or changes the app on GitHub. */
export function forgetInstallations(userId: number) {
  return invalidate(installationsKey(userId))
}

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
    }))
  })
}

export type NoAccess =
  | { kind: 'not_found' }
  | { kind: 'repo_not_selected'; owner: string; settingsUrl: string }
  | { kind: 'app_not_installed'; owner: string; installUrl: string }

/**
 * A user token only sees repos where the GitHub App is installed. When a repo
 * 404s, work out whether the app is missing, the repo isn't selected in the
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
