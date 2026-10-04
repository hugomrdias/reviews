// Two-level cache: a small in-isolate map in front of the Workers Cache API.
// The Cache API is per data center and does nothing on *.workers.dev, so the
// map still helps there.

import { waitUntil } from 'cloudflare:workers'

// Isolates get 128 MB. Values are counted by their JSON size, which is close
// enough to what they hold in memory.
const MAX_MEMORY_BYTES = 32 * 1024 * 1024
// Bigger values (a huge repo's tree) only go to the edge cache.
const MAX_ENTRY_BYTES = 8 * 1024 * 1024

interface Entry {
  value: unknown
  bytes: number
  /** Until then the value is served as is. */
  freshUntil: number
  /** Until then it can still be served while it refreshes in the background. */
  expires: number
}

// Map order is insertion order; hits move an entry to the end, so the first
// one is the least recently used.
const memory = new Map<string, Entry>()
let memoryBytes = 0

// Loads in flight in this isolate, so concurrent misses share one fetch.
const inflight = new Map<string, Promise<unknown>>()

const FRESH_UNTIL = 'x-fresh-until'

function cacheRequest(key: string) {
  return new Request(`https://cache.internal/${encodeURIComponent(key)}`)
}

function edgeCache(): Cache | null {
  return typeof caches !== 'undefined' && 'default' in caches
    ? (caches as unknown as { default: Cache }).default
    : null
}

function forget(key: string) {
  const entry = memory.get(key)
  if (!entry) return
  memory.delete(key)
  memoryBytes -= entry.bytes
}

function remember(key: string, entry: Entry) {
  forget(key)
  if (entry.bytes > MAX_ENTRY_BYTES) return
  while (memoryBytes + entry.bytes > MAX_MEMORY_BYTES && memory.size > 0) {
    forget(memory.keys().next().value!)
  }
  memory.set(key, entry)
  memoryBytes += entry.bytes
}

export interface CacheOptions {
  /**
   * Seconds an expired value may still be served while a fresh one loads in
   * the background. If that load fails, the value is dropped.
   */
  staleSeconds?: number
}

async function load<T>(key: string, ttlSeconds: number, staleSeconds: number, fetchValue: () => Promise<T>) {
  const value = await fetchValue()
  const json = JSON.stringify(value)
  const now = Date.now()
  const freshUntil = now + ttlSeconds * 1000
  remember(key, { value, bytes: json.length, freshUntil, expires: freshUntil + staleSeconds * 1000 })
  const edge = edgeCache()
  if (edge) {
    const response = new Response(json, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${ttlSeconds + staleSeconds}`,
        [FRESH_UNTIL]: String(freshUntil),
      },
    })
    // Off the response path: nothing waits on the write.
    waitUntil(edge.put(cacheRequest(key), response).catch(() => {}))
  }
  return value
}

/** Loads once per isolate at a time, however many requests ask. */
function loadShared<T>(key: string, ttlSeconds: number, staleSeconds: number, fetchValue: () => Promise<T>) {
  let pending = inflight.get(key) as Promise<T> | undefined
  if (!pending) {
    pending = load(key, ttlSeconds, staleSeconds, fetchValue).finally(() => inflight.delete(key))
    inflight.set(key, pending)
  }
  return pending
}

function refreshInBackground<T>(key: string, ttlSeconds: number, staleSeconds: number, fetchValue: () => Promise<T>) {
  if (inflight.has(key)) return
  // A failed refresh, such as access that was revoked, must not leave the
  // stale value in place.
  waitUntil(loadShared(key, ttlSeconds, staleSeconds, fetchValue).catch(() => invalidate(key)))
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetchValue: () => Promise<T>,
  { staleSeconds = 0 }: CacheOptions = {},
): Promise<T> {
  const now = Date.now()
  const hit = memory.get(key)
  if (hit && hit.expires > now) {
    memory.delete(key)
    memory.set(key, hit)
    if (hit.freshUntil <= now) refreshInBackground(key, ttlSeconds, staleSeconds, fetchValue)
    return hit.value as T
  }

  const shared = inflight.get(key) as Promise<T> | undefined
  if (shared) return shared

  const edge = edgeCache()
  const res = edge ? await edge.match(cacheRequest(key)) : undefined
  if (res) {
    const json = await res.text()
    const value = JSON.parse(json) as T
    // Entries written before stale serving existed have no header; the edge
    // already expires them on time.
    const freshUntil = Number(res.headers.get(FRESH_UNTIL) ?? now + ttlSeconds * 1000)
    remember(key, { value, bytes: json.length, freshUntil, expires: freshUntil + staleSeconds * 1000 })
    if (freshUntil <= now) refreshInBackground(key, ttlSeconds, staleSeconds, fetchValue)
    return value
  }

  return loadShared(key, ttlSeconds, staleSeconds, fetchValue)
}

/** Content addressed by a SHA never changes, so it can live for a long time. */
export const IMMUTABLE_TTL = 60 * 60 * 24 * 30

/** Drops a cached value, e.g. after the user changed something on GitHub. */
export async function invalidate(key: string) {
  forget(key)
  await edgeCache()?.delete(cacheRequest(key))
}
