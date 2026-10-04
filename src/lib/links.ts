import { dirname, findReadme, isDirectory, joinPath } from './paths'

export type ResolvedLink =
  | { kind: 'external'; href: string }
  | { kind: 'hash'; hash: string }
  /** A path inside the repo; `ref` is set when the link names another ref. */
  | { kind: 'internal'; path: string; hash: string; ref?: string }
  | { kind: 'invalid' }

export interface LinkContext {
  owner: string
  repo: string
  /** Path of the file containing the link. */
  path: string
  paths: readonly string[]
  pathSet: ReadonlySet<string>
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function splitHash(href: string) {
  const i = href.indexOf('#')
  return i === -1 ? [href, ''] : [href.slice(0, i), safeDecode(href.slice(i + 1))]
}

/** Directory links open the directory's README when it has one. */
function preferReadme(path: string, ctx: LinkContext) {
  if (ctx.pathSet.has(path)) return path
  if (isDirectory(path, ctx.paths)) return findReadme(path, ctx.pathSet) ?? path
  return path
}

/** Same-repo github.com blob/tree URLs stay in the app. */
function fromGitHubUrl(href: string, ctx: LinkContext): ResolvedLink | null {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  if (url.hostname !== 'github.com') return null
  const [owner, repo, kind, ref, ...rest] = url.pathname.split('/').filter(Boolean)
  if (
    owner?.toLowerCase() !== ctx.owner.toLowerCase() ||
    repo?.toLowerCase() !== ctx.repo.toLowerCase() ||
    (kind !== 'blob' && kind !== 'tree') ||
    !ref
  ) {
    return null
  }
  return {
    kind: 'internal',
    path: safeDecode(rest.join('/')),
    hash: safeDecode(url.hash.slice(1)),
    ref: safeDecode(ref),
  }
}

/**
 * Resolves a markdown link the way GitHub does for repo files: relative to
 * the current file, "/" from the repo root, ".." normalized. Links that
 * escape the repo root are invalid.
 */
export function resolveRepoLink(rawHref: string, ctx: LinkContext): ResolvedLink {
  const href = rawHref.trim()
  if (!href) return { kind: 'invalid' }
  if (href.startsWith('#')) return { kind: 'hash', hash: safeDecode(href.slice(1)) }
  if (SCHEME.test(href) || href.startsWith('//')) {
    return fromGitHubUrl(href, ctx) ?? { kind: 'external', href }
  }

  const [withoutHash, hash] = splitHash(href)
  const pathPart = safeDecode(withoutHash.split('?')[0])
  const resolved = pathPart.startsWith('/')
    ? joinPath('', pathPart)
    : joinPath(dirname(ctx.path), pathPart)
  if (resolved === null) return { kind: 'invalid' }
  // "?tab=x" or "#" alone: stay on this page.
  if (pathPart === '') return { kind: 'hash', hash }
  return { kind: 'internal', path: preferReadme(resolved, ctx), hash }
}

/** Resolves an image or media `src` to a repo path, or null for external URLs. */
export function resolveAssetPath(src: string, currentPath: string): string | null {
  const value = src.trim()
  if (!value || SCHEME.test(value) || value.startsWith('//') || value.startsWith('#')) return null
  const pathPart = safeDecode(value.split('#')[0].split('?')[0])
  return pathPart.startsWith('/') ? joinPath('', pathPart) : joinPath(dirname(currentPath), pathPart)
}

/** Builds the router splat for a ref + path. */
export function toSplat(ref: string, path: string) {
  return path ? `${ref}/${path}` : ref
}
