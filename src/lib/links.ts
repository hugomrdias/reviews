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

/** A GitHub owner or repo name. Never "." or "..", so it stays one path segment. */
const NAME = /^(?!\.+$)[A-Za-z0-9_.-]{1,100}$/

export interface GitHubLocation {
  owner: string
  repo: string
  /** Set for blob and tree URLs. The repo root has none. */
  ref?: string
  /** Everything after the ref. */
  path: string
  hash: string
}

/**
 * Parses a github.com repo root, blob or tree URL. Other pages (issues, pull
 * requests) are null. `ref` is the first segment after blob/tree, so a ref
 * with slashes spills into `path`; `toSplat(ref, path)` joins them back and
 * the server splits the splat against the repo's real refs.
 */
export function parseGitHubUrl(href: string): GitHubLocation | null {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null
  const [owner, name, kind, ref, ...rest] = url.pathname.split('/').filter(Boolean)
  const repo = name?.replace(/\.git$/, '')
  if (!owner || !repo || !NAME.test(owner) || !NAME.test(repo)) return null
  const hash = safeDecode(url.hash.slice(1))
  if (kind === undefined) return { owner, repo, path: '', hash }
  if ((kind !== 'blob' && kind !== 'tree') || !ref) return null
  return { owner, repo, ref: safeDecode(ref), path: safeDecode(rest.join('/')), hash }
}

/** Same-repo github.com blob/tree URLs stay in the app. */
function fromGitHubUrl(href: string, ctx: LinkContext): ResolvedLink | null {
  const loc = parseGitHubUrl(href)
  if (
    !loc?.ref ||
    loc.owner.toLowerCase() !== ctx.owner.toLowerCase() ||
    loc.repo.toLowerCase() !== ctx.repo.toLowerCase()
  ) {
    return null
  }
  return { kind: 'internal', path: loc.path, hash: loc.hash, ref: loc.ref }
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

/** github.com links in free text, with or without the scheme. Not gist.github.com or notgithub.com. */
const GITHUB_URL = /(?<![\w.-])(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s<>"'`]+/gi

/** What the manifest's share_target sends to /share. */
export interface SharedData {
  title?: string
  text?: string
  url?: string
}

/**
 * The repo, folder or file a share into the app points at: the first usable
 * github.com link in `url`, then `text`, then `title`. Android apps often put
 * the link in `text`, between other words.
 */
export function sharedLocation(shared: SharedData): GitHubLocation | null {
  for (const value of [shared.url, shared.text, shared.title]) {
    for (const [match] of value?.matchAll(GITHUB_URL) ?? []) {
      // Punctuation that ends a sentence or closes a bracket isn't part of the link.
      const href = match.replace(/[.,;:!?)\]}]+$/, '')
      const loc = parseGitHubUrl(/^https?:/i.test(href) ? href : `https://${href}`)
      if (loc) return loc
    }
  }
  return null
}
