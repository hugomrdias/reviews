// Two-level cache: a small in-isolate map in front of the Workers Cache API.
// The Cache API is per data center and does nothing on *.workers.dev, so the
// map still helps there.

const MAX_MEMORY_ENTRIES = 300
const memory = new Map<string, { expires: number; value: unknown }>()

function cacheRequest(key: string) {
  return new Request(`https://cache.internal/${encodeURIComponent(key)}`)
}

function edgeCache(): Cache | null {
  return typeof caches !== 'undefined' && 'default' in caches
    ? (caches as unknown as { default: Cache }).default
    : null
}

function remember(key: string, value: unknown, ttlSeconds: number) {
  if (memory.size >= MAX_MEMORY_ENTRIES) {
    const oldest = memory.keys().next().value
    if (oldest !== undefined) memory.delete(oldest)
  }
  memory.set(key, { expires: Date.now() + ttlSeconds * 1000, value })
}

export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const hit = memory.get(key)
  if (hit && hit.expires > Date.now()) return hit.value as T

  const edge = edgeCache()
  if (edge) {
    const res = await edge.match(cacheRequest(key))
    if (res) {
      const value = (await res.json()) as T
      remember(key, value, ttlSeconds)
      return value
    }
  }

  const value = await load()
  remember(key, value, ttlSeconds)
  if (edge) {
    await edge.put(
      cacheRequest(key),
      new Response(JSON.stringify(value), {
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${ttlSeconds}` },
      }),
    )
  }
  return value
}

/** Content addressed by a SHA never changes, so it can live for a long time. */
export const IMMUTABLE_TTL = 60 * 60 * 24 * 30

/** Drops a cached value, e.g. after the user changed something on GitHub. */
export async function invalidate(key: string) {
  memory.delete(key)
  await edgeCache()?.delete(cacheRequest(key))
}
