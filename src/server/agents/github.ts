import type { ActiveSession } from '../auth/session'
import { requireRepoAccess } from '../github/access'
import { NotFoundError } from '../github/client'
import { getBlobText, getFileContent, getTreeEntry } from '../github/content'
import { findCommitSha, resolveLocation } from '../github/refs'
import type { RepoReader } from './tools'
import type { AgentProps } from './grant'

/**
 * GitHub as the agent's person sees it, through the agent's own token and
 * the same access checks and caches as the app.
 */
export function repoReader(props: AgentProps): RepoReader {
  const session: ActiveSession = {
    id: `agent:${props.userId}`,
    user: { id: props.userId, login: props.login, name: null, avatarUrl: null },
    accessToken: props.github.accessToken,
  }
  const token = session.accessToken
  return {
    access: (owner, name) => requireRepoAccess(session, owner, name),
    async resolveRef(repo, ref) {
      const location = await resolveLocation(token, repo.owner, repo.name, ref, repo.defaultBranch)
      return { ref: location.ref, sha: location.sha }
    },
    async file(repo, sha, path) {
      const entry = await getTreeEntry(token, repo.repoId, repo.owner, repo.name, sha, path)
      if (!entry) return null
      const content = await getFileContent(token, repo.repoId, repo.owner, repo.name, entry)
      return content.kind === 'text' ? { source: content.text, blobSha: content.blobSha } : null
    },
    async blob(repo, blobSha) {
      try {
        return await getBlobText(token, repo.repoId, repo.owner, repo.name, blobSha)
      } catch (error) {
        if (error instanceof NotFoundError) return null
        throw error
      }
    },
    commit: (repo, sha) => findCommitSha(token, repo.owner, repo.name, sha),
  }
}
