// Sessions (docs/plan/05 section 1 item 6, 02 sections 7 and 8): a random 32-byte token in the
// `xd_session` cookie (HttpOnly, SameSite=Lax, Secure behind the front), the sessions row keyed
// by its SHA-256. A session lasts 30 days from its last use; the row and the cookie are renewed
// at most once an hour.
import type { CookieSerializeOptions } from '@fastify/cookie'
import { and, eq, lte, ne } from 'drizzle-orm'
import type { FastifyReply, FastifyRequest } from 'fastify'

import { config } from '../config.ts'
import { getDb } from '../db/index.ts'
import { sessions, signInSteps, users } from '../db/schema.ts'
import type { SessionUser } from './context.ts'
import { emitUserAccessChanged } from './events.ts'
import { hashToken, newToken } from './tokens.ts'
import { toUser } from './users.ts'

export const sessionCookie = 'xd_session'

const sessionMs = 30 * 24 * 60 * 60 * 1000
const renewMs = 60 * 60 * 1000
// "Confirm it's you" opens the site owner's risky actions for 5 minutes.
const confirmMs = 5 * 60 * 1000

function cookieOptions(): CookieSerializeOptions {
  return {
    // The site's secret path (XD_BASE_PATH).
    path: config.basePath,
    httpOnly: true,
    // Behind the helper's front (its socket, or on Windows its proxy secret) the site is HTTPS;
    // `make dev` is plain HTTP on localhost TCP.
    secure: config.behindFront,
    sameSite: 'lax',
  }
}

// Requests whose session was renewed: the onSend hook (src/auth/http.ts) sends the cookie again.
const renewed = new WeakSet<FastifyRequest>()

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(sessionCookie, token, { ...cookieOptions(), maxAge: sessionMs / 1000 })
}

export function clearSessionCookie(req: FastifyRequest, reply: FastifyReply): void {
  renewed.delete(req)
  reply.clearCookie(sessionCookie, cookieOptions())
}

// Sends the cookie of a session renewed during this request again, with a new 30 days.
// (A request outside the base path is answered before its cookies are read: it has none.)
export function renewSessionCookie(req: FastifyRequest, reply: FastifyReply): void {
  const token = renewed.has(req) ? req.cookies[sessionCookie] : undefined
  if (token !== undefined) {
    setSessionCookie(reply, token)
  }
}

// Signs the person in on this browser: a new session and its cookie.
export function startSession(req: FastifyRequest, reply: FastifyReply, userId: string): void {
  const db = getDb()
  const token = newToken()
  const now = Date.now()
  // The browser's previous session, and ended sessions of everyone, go first.
  const previous = req.cookies[sessionCookie]
  if (previous !== undefined && previous !== '') {
    db.delete(sessions)
      .where(eq(sessions.id, hashToken(previous)))
      .run()
  }
  db.delete(sessions).where(lte(sessions.expiresAt, now)).run()
  db.insert(sessions)
    .values({
      id: hashToken(token),
      userId,
      createdAt: now,
      expiresAt: now + sessionMs,
      lastUsedAt: now,
      userAgent: req.headers['user-agent']?.slice(0, 300) ?? null,
      ip: req.ip,
    })
    .run()
  db.update(users).set({ lastSeenAt: now }).where(eq(users.id, userId)).run()
  setSessionCookie(reply, token)
}

interface Found {
  user: SessionUser
  lastUsedAt: number
}

function loadSession(sessionId: string, now: number): Found | null {
  const db = getDb()
  const row = db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, sessionId))
    .get()
  if (!row) {
    return null
  }
  if (row.session.expiresAt <= now) {
    db.delete(sessions).where(eq(sessions.id, sessionId)).run()
    return null
  }
  if (row.user.disabledAt !== null) {
    return null
  }
  const user = { ...toUser(row.user), sessionId, confirmedUntil: row.session.confirmedUntil }
  return { user, lastUsedAt: row.session.lastUsedAt }
}

// The person of a session row (its ID is the token's hash), or null once it ended or the person
// is disabled. Live editing checks its connections again with it.
export function findSessionUser(sessionId: string): SessionUser | null {
  return loadSession(sessionId, Date.now())?.user ?? null
}

// The person of the request's cookie; a session last renewed over an hour ago gets 30 more days
// and the person's "last seen" moves.
export function sessionUserOf(req: FastifyRequest): SessionUser | null {
  const token = req.cookies[sessionCookie]
  if (token === undefined || token === '') {
    return null
  }
  const now = Date.now()
  const found = loadSession(hashToken(token), now)
  if (!found) {
    return null
  }
  if (found.lastUsedAt <= now - renewMs) {
    const db = getDb()
    db.update(sessions)
      .set({ lastUsedAt: now, expiresAt: now + sessionMs })
      .where(eq(sessions.id, found.user.sessionId))
      .run()
    db.update(users).set({ lastSeenAt: now }).where(eq(users.id, found.user.id)).run()
    renewed.add(req)
  }
  return found.user
}

// Ends the session of the request's cookie, if any ("Sign out").
export function endRequestSession(req: FastifyRequest, reply: FastifyReply): void {
  const token = req.cookies[sessionCookie]
  if (token !== undefined && token !== '') {
    const row = getDb()
      .delete(sessions)
      .where(eq(sessions.id, hashToken(token)))
      .returning()
      .get()
    if (row) {
      emitUserAccessChanged({ userId: row.userId, reason: 'sessionsEnded' })
    }
  }
  clearSessionCookie(req, reply)
}

// Ends one session of the person; false when they have no such session.
export function endSession(userId: string, sessionId: string): boolean {
  const row = getDb()
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .returning()
    .get()
  if (row) {
    emitUserAccessChanged({ userId, reason: 'sessionsEnded' })
  }
  return row !== undefined
}

// Ends every session of the person, or every one but `keep` ("Sign out everywhere else"), and
// their unfinished two-factor sign-ins (TFA-01): a new password or a reset ends them too.
export function endUserSessions(userId: string, keep?: string): void {
  const db = getDb()
  const where =
    keep === undefined ? eq(sessions.userId, userId) : and(eq(sessions.userId, userId), ne(sessions.id, keep))
  db.delete(sessions).where(where).run()
  db.delete(signInSteps).where(eq(signInSteps.userId, userId)).run()
  emitUserAccessChanged({ userId, reason: 'sessionsEnded' })
}

// "Confirm it's you": the session passes `confirm` routes until the time returned.
export function confirmSession(sessionId: string): number {
  const until = Date.now() + confirmMs
  getDb().update(sessions).set({ confirmedUntil: until }).where(eq(sessions.id, sessionId)).run()
  return until
}

// Closes the session's "Confirm it's you" window: one opened with the password alone does not
// count once two-factor sign-in is on (TFA-01).
export function unconfirmSession(sessionId: string): void {
  getDb().update(sessions).set({ confirmedUntil: null }).where(eq(sessions.id, sessionId)).run()
}

export interface SessionRow {
  id: string
  createdAt: number
  lastUsedAt: number
  expiresAt: number
  userAgent: string | null
  ip: string | null
}

// The person's live sessions, the last used first (the account page's "Sessions").
export function listSessions(userId: string): SessionRow[] {
  const now = Date.now()
  return getDb()
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      lastUsedAt: sessions.lastUsedAt,
      expiresAt: sessions.expiresAt,
      userAgent: sessions.userAgent,
      ip: sessions.ip,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .all()
    .filter((row) => row.expiresAt > now)
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
}
