import { isImage } from '@/lib/paths'
import { cached, IMMUTABLE_TTL } from '../cache'
import { githubFetch, githubJson, NotFoundError, repoBase } from './client'

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

  // The path is added back, since the same blob can sit at many paths.
  return blobContent(token, repoId, owner, repo, entry.sha).then((content): FileContent => ({ ...content, ...meta }))
}

type BlobContent = { kind: 'binary' | 'lfs' | 'too-large' } | { kind: 'text'; text: string }

/**
 * A blob's content, keyed by blob alone. `bytes` are the blob when the caller
 * already has them, so they're cached without asking GitHub again.
 */
function blobContent(
  token: string,
  repoId: number,
  owner: string,
  repo: string,
  blobSha: string,
  bytes?: Uint8Array,
) {
  return cached<BlobContent>(`blob-content:${repoId}:${blobSha}`, IMMUTABLE_TTL, async () => {
    bytes ??= new Uint8Array(await (await fetchBlob(token, owner, repo, blobSha)).arrayBuffer())
    // Only reached without a tree entry to check the size first.
    if (bytes.length > MAX_TEXT_BYTES) return { kind: 'too-large' }
    if (looksBinary(bytes)) return { kind: 'binary' }
    const text = new TextDecoder().decode(bytes)
    if (text.startsWith('version https://git-lfs.github.com/spec/v1')) return { kind: 'lfs' }
    return { kind: 'text', text }
  })
}

export type PathEntry = { kind: 'file'; entry: TreeEntry } | { kind: 'directory' } | { kind: 'missing' }

interface ContentsFile {
  type: 'file' | 'symlink' | 'submodule'
  path: string
  sha: string
  size: number
  /** Base64, for files up to 1 MB. */
  content?: string
  encoding?: string
}

/**
 * What's at `path` in a commit, without waiting for the tree. One call
 * answers file, directory or missing, and carries the content of files up to
 * 1 MB, which goes into the blob cache. A file the cache hasn't seen then
 * loads alongside the tree instead of after it.
 *
 * `onContent` gets the file's bytes when this call downloaded them, so a
 * caller that serves the file needn't download it again.
 */
export function getPathEntry(
  token: string,
  repoId: number,
  owner: string,
  repo: string,
  sha: string,
  path: string,
  onContent?: (bytes: Uint8Array<ArrayBuffer>) => void,
) {
  return cached<PathEntry>(`path-entry:${repoId}:${sha}:${path}`, IMMUTABLE_TTL, async () => {
    const encoded = path.split('/').map(encodeURIComponent).join('/')
    let data: ContentsFile | unknown[]
    try {
      data = await githubJson(token, `${repoBase(owner, repo)}/contents/${encoded}?ref=${sha}`)
    } catch (error) {
      if (error instanceof NotFoundError) return { kind: 'missing' }
      throw error
    }
    if (Array.isArray(data)) return { kind: 'directory' }
    // The tree skips submodules too.
    if (data.type === 'submodule') return { kind: 'missing' }
    const entry = { path, sha: data.sha, size: data.size }
    // Symlinks and files over 1 MB come without content; theirs loads by blob.
    if (data.type === 'file' && data.encoding === 'base64' && data.content) {
      const bytes = Uint8Array.from(atob(data.content), (c) => c.charCodeAt(0))
      onContent?.(bytes)
      // Images are never read as text.
      if (!isImage(path)) await blobContent(token, repoId, owner, repo, data.sha, bytes)
    }
    return { kind: 'file', entry }
  })
}

/**
 * A text blob by its SHA, or null when it isn't text. No tree lookup, for
 * callers that already know the blob, such as a comment on an older version.
 */
export async function getBlobText(token: string, repoId: number, owner: string, repo: string, blobSha: string) {
  const content = await blobContent(token, repoId, owner, repo, blobSha)
  return content.kind === 'text' ? content.text : null
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
