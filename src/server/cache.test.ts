import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error The test stub of cloudflare:workers, aliased in vitest.config.ts.
import { settleBackground } from 'cloudflare:workers'
import { cached } from './cache'

// Each test uses its own keys, so the module's map never leaks between tests.
let n = 0
const key = () => `test:${n++}`

describe('cached', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shares one load between concurrent misses', async () => {
    const k = key()
    const load = vi.fn(async () => 'value')
    const [a, b] = await Promise.all([cached(k, 60, load), cached(k, 60, load)])
    expect([a, b]).toEqual(['value', 'value'])
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('serves a stale value and refreshes it in the background', async () => {
    const k = key()
    let version = 1
    const load = vi.fn(async () => version)
    await cached(k, 60, load, { staleSeconds: 300 })
    version = 2
    vi.advanceTimersByTime(61_000)
    expect(await cached(k, 60, load, { staleSeconds: 300 })).toBe(1)
    await settleBackground()
    expect(await cached(k, 60, load, { staleSeconds: 300 })).toBe(2)
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('reloads in the request once the stale window is over', async () => {
    const k = key()
    let version = 1
    const load = vi.fn(async () => version)
    await cached(k, 60, load, { staleSeconds: 300 })
    version = 2
    vi.advanceTimersByTime(361_000)
    expect(await cached(k, 60, load, { staleSeconds: 300 })).toBe(2)
  })

  it('drops a stale value when its refresh fails', async () => {
    const k = key()
    await cached(k, 60, async () => 'granted', { staleSeconds: 300 })
    vi.advanceTimersByTime(61_000)
    const revoked = async () => {
      throw new Error('revoked')
    }
    expect(await cached(k, 60, revoked, { staleSeconds: 300 })).toBe('granted')
    await settleBackground()
    await expect(cached(k, 60, revoked, { staleSeconds: 300 })).rejects.toThrow('revoked')
  })

  it('does not keep values over the size limit in memory', async () => {
    const k = key()
    const big = 'x'.repeat(9 * 1024 * 1024)
    const load = vi.fn(async () => big)
    await cached(k, 60, load)
    await cached(k, 60, load)
    expect(load).toHaveBeenCalledTimes(2)
  })
})
