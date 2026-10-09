import { waitUntil } from 'cloudflare:workers'
import { createFileRoute } from '@tanstack/react-router'
import { repoInput } from '@/functions/schemas'
import { errorCode } from '@/lib/errors'
import { assetContentType, extname } from '@/lib/paths'
import { FULL_SHA_PATTERN } from '@/lib/refs'
import { loadSession } from '@/server/auth/session'
import { edgeCache } from '@/server/cache'
import { checkRepoAccess } from '@/server/github/access'
import { fetchBlob, getPathEntry } from '@/server/github/content'

/**
 * Serves repo files (images in docs, mostly) with the viewer's own GitHub
 * token, so private repos work. URLs are pinned to a commit SHA, so responses
 * never change. Never serves HTML: unknown types download instead.
 */
export const Route = createFileRoute('/api/raw/$owner/$repo/$sha/$')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { sha } = params
        const path = params._splat ?? ''
        const repoParams = repoInput.safeParse(params)
        if (!repoParams.success || !FULL_SHA_PATTERN.test(sha) || !path) return new Response('Bad request', { status: 400 })

        const session = await loadSession()
        if (!session) return new Response('Sign in required', { status: 401 })

        let access
        try {
          access = await checkRepoAccess(session, repoParams.data.owner, repoParams.data.repo)
        } catch (error) {
          if (errorCode(error) === 'NO_ACCESS') return new Response('Not found', { status: 404 })
          throw error
        }

        // Files up to 1 MB come with the lookup, when it isn't cached yet.
        let downloaded: Uint8Array<ArrayBuffer> | undefined
        const found = await getPathEntry(
          session.accessToken,
          access.repoId,
          access.owner,
          access.name,
          sha,
          path,
          (bytes) => (downloaded = bytes),
        )
        if (found.kind !== 'file') return new Response('Not found', { status: 404 })
        const { entry } = found

        // The edge cache is shared, so the key is the content; access was checked above.
        const cacheKey = new Request(`https://raw-cache.internal/${access.repoId}/${entry.sha}/${extname(path)}`)
        const cache = edgeCache()
        let body: BodyInit | null = downloaded ?? (await cache?.match(cacheKey))?.body ?? null
        if (downloaded && cache) {
          const stored = new Response(downloaded, { headers: { 'Cache-Control': 'max-age=31536000' } })
          waitUntil(cache.put(cacheKey, stored).catch(() => {}))
        }
        if (!body) {
          // Streamed, not buffered: one copy goes to the viewer, the other to the cache.
          const blob = (await fetchBlob(session.accessToken, access.owner, access.name, entry.sha)).body
          if (blob && cache) {
            const [forViewer, forCache] = blob.tee()
            body = forViewer
            const stored = new Response(forCache, { headers: { 'Cache-Control': 'max-age=31536000' } })
            waitUntil(cache.put(cacheKey, stored).catch(() => {}))
          } else {
            body = blob
          }
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
