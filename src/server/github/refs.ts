import { FULL_SHA_PATTERN } from '@/lib/refs'
import { cached } from '../cache'
import { GitHubError, githubFetch, githubJson, NotFoundError, repoBase } from './client'

export interface Location {
  /** The ref as written in the URL: branch, tag or SHA. */
  ref: string
  /** The commit the ref points at. Everything downstream is keyed by this. */
  sha: string
  /** File or directory path inside the repo, '' for the root. */
  path: string
}

/**
 * Branch names can contain slashes, so "feature/x/docs/a.md" is ambiguous.
 * Given the refs that start with the first segment, pick the longest one
 * that matches whole segments of the splat.
 */
export function pickLongestRef(splat: string, refNames: string[]): string | null {
  let best: string | null = null
  for (const name of refNames) {
    if (splat === name || splat.startsWith(`${name}/`)) {
      if (!best || name.length > best.length) best = name
    }
  }
  return best
}

export function splitRefPath(splat: string, ref: string) {
  return splat === ref ? '' : splat.slice(ref.length + 1)
}

interface MatchingRef {
  ref: string
  object: { sha: string; type: 'commit' | 'tag' }
}

// Branches and tags move, so lookups are fresh for a minute, then served for
// up to five more while they refresh: right after a push, a branch can show
// its previous commit for one more request. They're cached by ref, not by
// file, so opening another file on the same branch doesn't ask GitHub again.
const REF_TTL = 60
const REF_CACHE = { staleSeconds: 5 * 60 }

function commitShaFor(token: string, base: string, ref: string) {
  return cached(
    `commit-sha:${base}:${ref}`,
    REF_TTL,
    async () => {
      const res = await githubFetch(token, `${base}/commits/${encodeURIComponent(ref)}`, {
        accept: 'application/vnd.github.sha',
      })
      return (await res.text()).trim()
    },
    REF_CACHE,
  )
}

/**
 * The commit a branch, tag or SHA resolves to, or null when GitHub doesn't
 * know it. The commits API answers 422 when the ref doesn't resolve to a commit.
 */
export async function findCommitSha(token: string, owner: string, repo: string, ref: string) {
  try {
    return await commitShaFor(token, repoBase(owner, repo), ref)
  } catch (error) {
    if (error instanceof NotFoundError || (error instanceof GitHubError && error.status === 422)) return null
    throw error
  }
}

function matchRefs(token: string, base: string, kind: 'heads' | 'tags', prefix: string) {
  return cached(
    `matching-refs:${base}:${kind}:${prefix}`,
    REF_TTL,
    async () => {
      const refs = await githubJson<MatchingRef[]>(
        token,
        `${base}/git/matching-refs/${kind}/${encodeURIComponent(prefix)}`,
      )
      return refs.map((r) => ({ name: r.ref.slice(`refs/${kind}/`.length), object: r.object }))
    },
    REF_CACHE,
  )
}

/**
 * Resolves "<ref>/<path>" from the URL to a commit SHA and a path.
 * Order: full SHA, branch, tag, then anything else the commits API accepts
 * (such as a short SHA).
 *
 * The default branch is only needed for the repo's root, and can still be
 * loading: the root's commit comes from HEAD, so it doesn't wait for it.
 */
export async function resolveLocation(
  token: string,
  owner: string,
  repo: string,
  splat: string,
  defaultBranch: string | Promise<string>,
): Promise<Location> {
  const clean = splat.replace(/^\/+|\/+$/g, '')
  const base = repoBase(owner, repo)

  if (!clean) {
    const [ref, sha] = await Promise.all([defaultBranch, commitShaFor(token, base, 'HEAD')])
    return { ref, sha, path: '' }
  }
  const first = clean.split('/')[0]
  if (FULL_SHA_PATTERN.test(first)) return { ref: first, sha: first, path: splitRefPath(clean, first) }

  for (const kind of ['heads', 'tags'] as const) {
    const refs = await matchRefs(token, base, kind, first)
    const name = pickLongestRef(
      clean,
      refs.map((r) => r.name),
    )
    if (!name) continue
    const match = refs.find((r) => r.name === name)!
    // Annotated tags point at a tag object, not a commit.
    const sha =
      match.object.type === 'commit' ? match.object.sha : await commitShaFor(token, base, name)
    return { ref: name, sha, path: splitRefPath(clean, name) }
  }

  const sha = await findCommitSha(token, owner, repo, first)
  if (!sha) throw new NotFoundError(`Unknown ref: ${first}`, 404)
  return { ref: first, sha, path: splitRefPath(clean, first) }
}
