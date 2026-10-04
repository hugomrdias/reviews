import { FULL_SHA_PATTERN } from '@/lib/refs'
import { cached } from '../cache'
import { GitHubError, githubFetch, githubJson, NotFoundError } from './client'

export const FULL_SHA = FULL_SHA_PATTERN

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

async function commitShaFor(token: string, base: string, ref: string) {
  const res = await githubFetch(token, `${base}/commits/${encodeURIComponent(ref)}`, {
    accept: 'application/vnd.github.sha',
  })
  return (await res.text()).trim()
}

async function matchRefs(token: string, base: string, kind: 'heads' | 'tags', prefix: string) {
  const refs = await githubJson<MatchingRef[]>(
    token,
    `${base}/git/matching-refs/${kind}/${encodeURIComponent(prefix)}`,
  )
  return refs.map((r) => ({ ...r, name: r.ref.slice(`refs/${kind}/`.length) }))
}

/**
 * Resolves "<ref>/<path>" from the URL to a commit SHA and a path.
 * Order: full SHA, branch, tag, then anything else the commits API accepts
 * (such as a short SHA).
 */
export async function resolveLocation(
  token: string,
  owner: string,
  repo: string,
  splat: string,
  defaultBranch: string,
): Promise<Location> {
  const clean = splat.replace(/^\/+|\/+$/g, '')
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
  const key = `loc:${owner}/${repo}:${clean || defaultBranch}`

  return cached(key, 60, async () => {
    if (!clean) {
      return { ref: defaultBranch, sha: await commitShaFor(token, base, defaultBranch), path: '' }
    }
    const first = clean.split('/')[0]
    if (FULL_SHA.test(first)) return { ref: first, sha: first, path: splitRefPath(clean, first) }

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

    try {
      return { ref: first, sha: await commitShaFor(token, base, first), path: splitRefPath(clean, first) }
    } catch (error) {
      // The commits API answers 422 when the ref doesn't resolve to a commit.
      if (error instanceof NotFoundError || (error instanceof GitHubError && error.status === 422)) {
        throw new NotFoundError(`Unknown ref: ${first}`, 404)
      }
      throw error
    }
  })
}
