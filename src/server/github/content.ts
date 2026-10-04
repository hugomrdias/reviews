import { isImage } from '@/lib/paths'
import { cached, IMMUTABLE_TTL } from '../cache'
import { githubFetch, githubJson } from './client'

const MAX_TEXT_BYTES = 2 * 1024 * 1024

export interface TreeEntry {
  path: string
  /** Blob SHA. */
  sha: string
  size: number
}

export interface RepoTree {
  entries: TreeEntry[]
  /** GitHub stops at 100k entries / 7 MB. */
  truncated: boolean
}

interface TreeResponse {
  truncated: boolean
  tree: Array<{ path: string; type: 'blob' | 'tree' | 'commit'; sha: string; size?: number }>
}

function repoBase(owner: string, repo: string) {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
}

/** Files only. Directories are implied by paths; submodules are skipped. */
export function getTree(token: string, repoId: number, owner: string, repo: string, sha: string) {
  return cached<RepoTree>(`tree:${repoId}:${sha}`, IMMUTABLE_TTL, async () => {
    const data = await githubJson<TreeResponse>(
      token,
      `${repoBase(owner, repo)}/git/trees/${sha}?recursive=1`,
    )
    return {
      truncated: data.truncated,
      entries: data.tree
        .filter((e) => e.type === 'blob')
        .map((e) => ({ path: e.path, sha: e.sha, size: e.size ?? 0 })),
    }
  })
}

export type FileContent =
  | { kind: 'text'; path: string; blobSha: string; size: number; text: string }
  | { kind: 'image'; path: string; blobSha: string; size: number }
  | { kind: 'binary' | 'too-large' | 'lfs'; path: string; blobSha: string; size: number }

function looksBinary(bytes: Uint8Array) {
  const end = Math.min(bytes.length, 8000)
  for (let i = 0; i < end; i++) if (bytes[i] === 0) return true
  return false
}

/**
 * Reads a file through its blob SHA, so identical content is cached once no
 * matter how many commits share it.
 */
export function getFileContent(
  token: string,
  repoId: number,
  owner: string,
  repo: string,
  entry: TreeEntry,
) {
  const meta = { path: entry.path, blobSha: entry.sha, size: entry.size }
  if (isImage(entry.path)) return Promise.resolve<FileContent>({ kind: 'image', ...meta })
  if (entry.size > MAX_TEXT_BYTES) return Promise.resolve<FileContent>({ kind: 'too-large', ...meta })

  // Keyed by blob alone; the path is added back, since the same blob can sit at many paths.
  type BlobContent = { kind: 'binary' | 'lfs' } | { kind: 'text'; text: string }
  return cached<BlobContent>(`blob-content:${repoId}:${entry.sha}`, IMMUTABLE_TTL, async () => {
    const bytes = new Uint8Array(await (await fetchBlob(token, owner, repo, entry.sha)).arrayBuffer())
    if (looksBinary(bytes)) return { kind: 'binary' }
    const text = new TextDecoder().decode(bytes)
    if (text.startsWith('version https://git-lfs.github.com/spec/v1')) return { kind: 'lfs' }
    return { kind: 'text', text }
  }).then((content): FileContent => ({ ...content, ...meta }))
}

export function fetchBlob(token: string, owner: string, repo: string, blobSha: string) {
  return githubFetch(token, `${repoBase(owner, repo)}/git/blobs/${blobSha}`, {
    accept: 'application/vnd.github.raw',
  })
}

export interface FileCommit {
  sha: string
  message: string
  authorName: string
  authorLogin: string | null
  avatarUrl: string | null
  date: string
}

interface CommitResponse {
  sha: string
  commit: { message: string; author: { name: string; date: string } | null }
  author: { login: string; avatar_url: string } | null
}

/** Commits that touched `path`, newest first. */
export function getFileCommits(token: string, owner: string, repo: string, sha: string, path: string) {
  return cached<FileCommit[]>(`commits:${owner}/${repo}:${sha}:${path}`, IMMUTABLE_TTL, async () => {
    const params = new URLSearchParams({ sha, path, per_page: '50' })
    const data = await githubJson<CommitResponse[]>(token, `${repoBase(owner, repo)}/commits?${params}`)
    return data.map((c) => ({
      sha: c.sha,
      message: c.commit.message.split('\n')[0],
      authorName: c.commit.author?.name ?? 'Unknown',
      authorLogin: c.author?.login ?? null,
      avatarUrl: c.author?.avatar_url ?? null,
      date: c.commit.author?.date ?? '',
    }))
  })
}
