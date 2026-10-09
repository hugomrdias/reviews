/// <reference types="@cloudflare/vitest-plugin/types" />
import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDb } from '../db/client'
import { sessions, users } from '../db/schema'
import { deriveKey, encrypt, sha256Hex } from './crypto'
import { loadSession, renewAccessToken } from './session'

// Stands in for TanStack Start's request context: one request, carrying the session cookie.
const start = vi.hoisted(() => ({ request: new Request('http://localhost:3000/'), cookie: 'cookie-token' }))
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => start.request,
  getCookie: () => start.cookie,
  setCookie: () => {},
  deleteCookie: () => {},
}))

const oauth = vi.hoisted(() => ({ refreshTokens: vi.fn() }))
vi.mock('./oauth', async (original) => ({ ...(await original<object>()), refreshTokens: oauth.refreshTokens }))

const HOUR = 60 * 60 * 1000

/** Writes the session row as a refresh would, with `accessToken` valid for `expiresIn`. */
async function storeTokens(id: string, accessToken: string, expiresIn = HOUR) {
  const key = await deriveKey(env.SESSION_SECRET, 'session-tokens')
  const now = Date.now()
  const tokens = {
    accessTokenEnc: await encrypt(key, accessToken),
    accessExpiresAt: now + expiresIn,
    refreshTokenEnc: await encrypt(key, `refresh-for-${accessToken}`),
    refreshExpiresAt: now + 30 * 24 * HOUR,
  }
  await getDb()
    .insert(sessions)
    .values({ id, userId: 1, ...tokens, createdAt: now, lastSeenAt: now })
    .onConflictDoUpdate({ target: sessions.id, set: tokens })
}

async function sessionRow(id: string) {
  const rows = await getDb().select().from(sessions).where(eq(sessions.id, id))
  return rows[0]
}

let id: string

beforeEach(async () => {
  // A new request each test, so the per-request session cache starts empty.
  start.request = new Request('http://localhost:3000/')
  id = await sha256Hex(start.cookie)
  const db = getDb()
  await db.delete(sessions)
  await db.insert(users).values({ id: 1, login: 'octo', name: null, avatarUrl: null, updatedAt: 0 }).onConflictDoNothing()
  await storeTokens(id, 'old')
  oauth.refreshTokens.mockReset()
})

describe('renewAccessToken', () => {
  it('switches to the token another request refreshed, and keeps the session', async () => {
    const session = (await loadSession())!
    expect(session.accessToken).toBe('old')
    await storeTokens(id, 'new')

    await expect(renewAccessToken(session, 'old')).resolves.toBe('new')
    expect(session.accessToken).toBe('new')
    // The rest of the request sees it too.
    expect((await loadSession())?.accessToken).toBe('new')
    expect(await sessionRow(id)).toBeDefined()
  })

  it('hands later failures with the old token the newer one, without asking D1 again', async () => {
    const session = (await loadSession())!
    await storeTokens(id, 'new')
    await renewAccessToken(session, 'old')
    await getDb().delete(sessions)
    await expect(renewAccessToken(session, 'old')).resolves.toBe('new')
  })

  it('refreshes a rejected token that is about to expire', async () => {
    const session = (await loadSession())!
    await storeTokens(id, 'old', 60 * 1000)
    oauth.refreshTokens.mockResolvedValue({
      accessToken: 'refreshed',
      accessExpiresAt: Date.now() + 8 * HOUR,
      refreshToken: 'refresh-2',
      refreshExpiresAt: Date.now() + 30 * 24 * HOUR,
    })

    await expect(renewAccessToken(session, 'old')).resolves.toBe('refreshed')
    expect(oauth.refreshTokens).toHaveBeenCalledWith('refresh-for-old')
    expect(await sessionRow(id)).toBeDefined()
  })

  it('deletes the session when GitHub rejected the token it still holds', async () => {
    const session = (await loadSession())!

    await expect(renewAccessToken(session, 'old')).resolves.toBeNull()
    expect(await sessionRow(id)).toBeUndefined()
    // The rest of the request sees it's gone.
    expect(await loadSession()).toBeNull()
  })

  it('returns null when the session is already gone', async () => {
    const session = (await loadSession())!
    await getDb().delete(sessions)
    await expect(renewAccessToken(session, 'old')).resolves.toBeNull()
  })
})
