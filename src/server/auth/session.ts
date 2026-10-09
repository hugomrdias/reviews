import { env, waitUntil } from 'cloudflare:workers'
import { deleteCookie, getCookie, getRequest, setCookie } from '@tanstack/react-start/server'
import { eq, lt } from 'drizzle-orm'
import { getDb, type Db } from '../db/client'
import { tagInvocation } from '../tracing'
import { sessions, users, type User } from '../db/schema'
import { decrypt, deriveKey, encrypt, randomToken, sha256Hex } from './crypto'
import { OAuthError, refreshTokens, type TokenSet } from './oauth'

const SESSION_MAX_AGE = 60 * 60 * 24 * 30
const REFRESH_MARGIN_MS = 5 * 60 * 1000
const TOUCH_INTERVAL_MS = 10 * 60 * 1000

export type SessionUser = Pick<User, 'id' | 'login' | 'name' | 'avatarUrl'>

export interface ActiveSession {
  id: string
  user: SessionUser
  accessToken: string
}

function isSecure() {
  return env.APP_URL.startsWith('https://')
}

/** `__Host-` cookies must be Secure, which plain-http localhost can't always do. */
export function sessionCookieName() {
  return isSecure() ? '__Host-session' : 'session'
}

export function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: isSecure(),
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}

/** Deletion must repeat `Secure`, or the cookie library rejects the `__Host-` name. */
function clearSessionCookie() {
  deleteCookie(sessionCookieName(), cookieOptions(0))
}

function tokenKey() {
  return deriveKey(env.SESSION_SECRET, 'session-tokens')
}

// Sessions already loaded for a request. A server render calls several server
// functions, and each one asks for the session.
const loaded = new WeakMap<Request, Promise<ActiveSession | null>>()

function upsertUserQuery(db: Db, user: SessionUser, now: number) {
  return db
    .insert(users)
    .values({ ...user, updatedAt: now })
    .onConflictDoUpdate({
      target: users.id,
      set: { login: user.login, name: user.name, avatarUrl: user.avatarUrl, updatedAt: now },
    })
}

/** Records who someone is on GitHub, so their comments can show it. */
export async function upsertUser(user: SessionUser) {
  await upsertUserQuery(getDb(), user, Date.now())
}

export async function createSession(user: SessionUser, tokens: TokenSet) {
  const db = getDb()
  const now = Date.now()
  const key = await tokenKey()
  const token = randomToken()
  await db.batch([
    upsertUserQuery(db, user, now),
    // Sessions whose refresh token has expired can never be used again.
    db.delete(sessions).where(lt(sessions.refreshExpiresAt, now)),
    db.insert(sessions).values({
      id: await sha256Hex(token),
      userId: user.id,
      accessTokenEnc: await encrypt(key, tokens.accessToken),
      accessExpiresAt: tokens.accessExpiresAt,
      refreshTokenEnc: await encrypt(key, tokens.refreshToken),
      refreshExpiresAt: tokens.refreshExpiresAt,
      createdAt: now,
      lastSeenAt: now,
    }),
  ])
  setCookie(sessionCookieName(), token, cookieOptions(SESSION_MAX_AGE))
}

export async function destroySession() {
  const token = getCookie(sessionCookieName())
  if (token) await getDb().delete(sessions).where(eq(sessions.id, await sha256Hex(token)))
  clearSessionCookie()
}

export async function deleteSessionById(id: string) {
  await getDb().delete(sessions).where(eq(sessions.id, id))
  loaded.delete(getRequest())
}

async function readSession(id: string) {
  const rows = await getDb()
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .limit(1)
  return rows[0] ?? null
}

// Refreshes in flight in this isolate, so parallel requests share one refresh.
const inflight = new Map<string, Promise<string | null>>()

/**
 * Returns a usable access token, refreshing it when it's about to expire.
 * GitHub invalidates a refresh token the moment it's used, so when two
 * isolates race, the loser gets `bad_refresh_token` and picks up the
 * winner's tokens from D1 instead.
 */
async function freshAccessToken(row: typeof sessions.$inferSelect): Promise<string | null> {
  const key = await tokenKey()
  const now = Date.now()
  if (row.accessExpiresAt - now > REFRESH_MARGIN_MS) return decrypt(key, row.accessTokenEnc)
  if (row.refreshExpiresAt <= now) return null

  let pending = inflight.get(row.id)
  if (!pending) {
    pending = (async () => {
      const refreshToken = await decrypt(key, row.refreshTokenEnc)
      if (!refreshToken) return null
      try {
        const tokens = await refreshTokens(refreshToken)
        await getDb()
          .update(sessions)
          .set({
            accessTokenEnc: await encrypt(key, tokens.accessToken),
            accessExpiresAt: tokens.accessExpiresAt,
            refreshTokenEnc: await encrypt(key, tokens.refreshToken),
            refreshExpiresAt: tokens.refreshExpiresAt,
          })
          .where(eq(sessions.id, row.id))
        return tokens.accessToken
      } catch (error) {
        if (!(error instanceof OAuthError) || error.code !== 'bad_refresh_token') throw error
        // Another isolate won the race. Give its write a moment to land.
        for (const delay of [150, 400]) {
          await new Promise((r) => setTimeout(r, delay))
          const latest = await readSession(row.id)
          if (latest && latest.session.refreshTokenEnc !== row.refreshTokenEnc) {
            return decrypt(key, latest.session.accessTokenEnc)
          }
        }
        return null
      }
    })().finally(() => inflight.delete(row.id))
    inflight.set(row.id, pending)
  }
  return pending
}

/** Loads the signed-in user's session, or null. Clears dead sessions. Reads D1 once per request. */
export function loadSession(): Promise<ActiveSession | null> {
  const request = getRequest()
  let session = loaded.get(request)
  if (!session) {
    session = readActiveSession()
    loaded.set(request, session)
  }
  return session
}

async function readActiveSession(): Promise<ActiveSession | null> {
  const token = getCookie(sessionCookieName())
  if (!token) return null
  const id = await sha256Hex(token)
  const found = await readSession(id)
  if (!found) {
    clearSessionCookie()
    return null
  }
  const accessToken = await freshAccessToken(found.session)
  if (!accessToken) {
    await destroySession()
    return null
  }
  if (Date.now() - found.session.lastSeenAt > TOUCH_INTERVAL_MS) {
    // Bookkeeping only, so the page doesn't wait for the write.
    waitUntil(
      getDb()
        .update(sessions)
        .set({ lastSeenAt: Date.now() })
        .where(eq(sessions.id, id))
        .catch(() => {}),
    )
  }
  const { id: userId, login, name, avatarUrl } = found.user
  // The session ID is the cookie's hash, not the cookie.
  tagInvocation({ 'user.id': userId, 'user.name': login, 'session.id': id })
  return { id, user: { id: userId, login, name, avatarUrl }, accessToken }
}
