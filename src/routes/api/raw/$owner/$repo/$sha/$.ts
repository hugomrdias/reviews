import { createFileRoute } from '@tanstack/react-router'
import { assetContentType, extname } from '@/lib/paths'
import { loadSession } from '@/server/auth/session'
import { requireRepoAccess } from '@/server/github/access'
import { NotFoundError } from '@/server/github/client'
import { fetchBlob, getTree } from '@/server/github/content'
import { FULL_SHA } from '@/server/github/refs'

function edgeCache(): Cache | null {
  return typeof caches !== 'undefined' && 'default' in caches
    ? (caches as unknown as { default: Cache }).default
    : null
}

/**
 * Serves repo files (images in docs, mostly) with the viewer's own GitHub
 * token, so private repos work. URLs are pinned to a commit SHA, so responses
 * never change. Never serves HTML: unknown types download instead.
 */
export const Route = createFileRoute('/api/raw/$owner/$repo/$sha/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { owner, repo, sha } = params
        const path = params._splat ?? ''
        if (!FULL_SHA.test(sha) || !path) return new Response('Bad request', { status: 400 })

        const session = await loadSession()
        if (!session) return new Response('Sign in required', { status: 401 })

        let access
        try {
          access = await requireRepoAccess(session, owner, repo)
        } catch (error) {
          if (error instanceof NotFoundError) return new Response('Not found', { status: 404 })
          throw error
        }

        const tree = await getTree(session.accessToken, access.repoId, access.owner, access.name, sha)
        const entry = tree.entries.find((e) => e.path === path)
        if (!entry) return new Response('Not found', { status: 404 })

        // The edge cache is shared, so the key is the content; access was checked above.
        const cacheKey = new Request(`https://raw-cache.internal/${access.repoId}/${entry.sha}/${extname(path)}`)
        const cache = edgeCache()
        let body: ArrayBuffer | null = null
        const hit = await cache?.match(cacheKey)
        if (hit) {
          body = await hit.arrayBuffer()
        } else {
          body = await (await fetchBlob(session.accessToken, access.owner, access.name, entry.sha)).arrayBuffer()
          await cache?.put(cacheKey, new Response(body, { headers: { 'Cache-Control': 'max-age=31536000' } }))
        }

        const type = assetContentType(path)
        const headers = new Headers({
          'Content-Type': type ?? 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'private, max-age=31536000, immutable',
        })
        if (!type) headers.set('Content-Disposition', 'attachment')
        if (type === 'image/svg+xml') {
          headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
        }
        return new Response(body, { headers })
      },
    },
  },
})
