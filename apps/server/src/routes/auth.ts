// Signing in and out, the account and its sessions, "Confirm it's you" and two-factor sign-in
// (authRoutes of @xdesign/api; docs/plan/04 section 2, 05 section 1, 02 section 8, 17 section 7).
import { routes } from '@xdesign/api'
import { and, eq, isNotNull } from 'drizzle-orm'
import type { FastifyRequest } from 'fastify'

import { audit } from '../audit.ts'
import type { SessionUser } from '../auth/context.ts'
import { signInTries, tryKeys } from '../auth/limits.ts'
import { checkNewPassword, hashPassword, verifyPassword } from '../auth/passwords.ts'
import {
  clearSessionCookie,
  confirmSession,
  endRequestSession,
  endSession,
  endUserSessions,
  listSessions,
  startSession,
  unconfirmSession,
} from '../auth/sessions.ts'
import { newTotpSecret, totpUri } from '../auth/totp.ts'
import {
  checkSecondFactorGiven,
  endSignInStep,
  failSignInStep,
  newRecoveryCodes,
  openSignInStep,
  setupMs,
  startSignInStep,
  turnOffTwoFactor,
  turnOnTwoFactor,
  twoFactorTexts,
  useSecondFactor,
} from '../auth/two-factor.ts'
import { findUserByUsername, toUser, usernameTaken } from '../auth/users.ts'
import { config } from '../config.ts'
import { getDb } from '../db/index.ts'
import { users } from '../db/schema.ts'
import { ApiError } from '../errors.ts'
import { addRoute, type Register } from '../route.ts'

// The signed-in person's own password, for "Change password" and "Confirm it's you": counted
// like sign-in tries.
async function checkOwnPassword(
  req: FastifyRequest,
  user: SessionUser,
  password: string,
  wrong: string,
): Promise<void> {
  const keys = tryKeys(req.ip, user.username)
  signInTries.check(keys)
  const row = getDb().select().from(users).where(eq(users.id, user.id)).get()
  if (!row || !(await verifyPassword(row.passwordHash, password))) {
    signInTries.fail(keys)
    throw new ApiError('bad_request', wrong)
  }
}

export const register: Register = (app) => {
  addRoute(app, routes.signIn, async ({ req, reply, body }) => {
    // USER-01a: the username as typed, without its surrounding spaces and in lower case.
    const keys = tryKeys(req.ip, body.username)
    signInTries.check(keys)
    const row = findUserByUsername(body.username)
    // An unknown username takes as long and answers the same as a wrong password.
    if (!row || !(await verifyPassword(row.passwordHash, body.password))) {
      signInTries.fail(keys)
      audit('sign_in_failed', { userId: row?.id, detail: { username: body.username } })
      throw new ApiError('bad_request', 'Username or password is wrong.')
    }
    if (row.disabledAt !== null) {
      audit('sign_in_failed', { userId: row.id, detail: { username: body.username, disabled: true } })
      throw new ApiError('no_access', 'This account is disabled. Ask the owner to enable it.')
    }
    // TFA-01: with two-factor sign-in on, the code step comes before the session.
    if (row.totpSecret !== null) {
      return startSignInStep(row.id, req.ip)
    }
    startSession(req, reply, row.id)
    audit('sign_in', { userId: row.id })
    return { user: toUser(row) }
  })

  // TFA-01 "Enter your code": wrong codes count in the sign-in limits and in the step's 5.
  addRoute(app, routes.signInCode, ({ req, reply, body }) => {
    checkSecondFactorGiven(body)
    const step = openSignInStep(body.challenge, req.ip)
    const keys = tryKeys(req.ip, step?.username)
    signInTries.check(keys, twoFactorTexts.tooManyCodes)
    if (!step) {
      signInTries.fail(keys)
      throw new ApiError('step_expired', twoFactorTexts.stepExpired)
    }
    const used = useSecondFactor(step.userId, body)
    if (used === 'wrong') {
      signInTries.fail(keys)
      audit('sign_in_failed', { userId: step.userId, detail: { username: step.username, twoFactor: true } })
      const left = failSignInStep(step.id)
      if (left === 0) {
        throw new ApiError('step_expired', twoFactorTexts.noAttemptsLeft)
      }
      throw new ApiError('bad_request', `Wrong code. ${String(left)} ${left === 1 ? 'attempt' : 'attempts'} left.`)
    }
    endSignInStep(step.id)
    // Read again: a recovery code was used up.
    const row = getDb().select().from(users).where(eq(users.id, step.userId)).get()
    if (!row) {
      throw new ApiError('step_expired', twoFactorTexts.stepExpired)
    }
    startSession(req, reply, row.id)
    audit('sign_in', { userId: row.id, detail: used === 'recoveryCode' ? { recoveryCode: true } : null })
    return { user: toUser(row) }
  })

  addRoute(app, routes.signOut, ({ req, reply }) => {
    endRequestSession(req, reply)
    return { ok: true as const }
  })

  // DESK-01: the desktop app's port of this start beside the one it prefers.
  addRoute(app, routes.me, ({ user }) => ({
    user: toUser(user),
    mode: config.mode,
    desktop: config.desktop && { port: config.port, preferredPort: config.desktop.preferredPort },
  }))

  addRoute(app, routes.updateMe, ({ user, body }) => {
    const changes: Partial<typeof users.$inferInsert> = {}
    if (body.name !== undefined) {
      changes.name = body.name
    }
    if (body.color !== undefined) {
      changes.color = body.color.toLowerCase()
    }
    if (body.theme !== undefined) {
      changes.theme = body.theme
    }
    if (body.mapLines !== undefined) {
      changes.mapLines = body.mapLines
    }
    if (body.username !== undefined && body.username !== user.username) {
      // Only the site owner changes usernames, their own here (USER-01a, 18 section 3.5).
      if (!user.isSiteOwner) {
        throw new ApiError('no_access', 'Only the site owner changes usernames.')
      }
      const taken = findUserByUsername(body.username)
      if (taken && taken.id !== user.id) {
        throw new ApiError('conflict', usernameTaken)
      }
      changes.username = body.username
    }
    if (Object.keys(changes).length === 0) {
      return { user: toUser(user) }
    }
    const [row] = getDb().update(users).set(changes).where(eq(users.id, user.id)).returning().all()
    if (!row) {
      throw new ApiError('not_signed_in')
    }
    if (changes.username !== undefined) {
      audit('username_changed', {
        userId: user.id,
        detail: { memberId: row.id, name: row.name, from: user.username, to: changes.username },
      })
    }
    return { user: toUser(row) }
  })

  // A new password ends the person's other sessions.
  addRoute(app, routes.changePassword, async ({ req, user, body }) => {
    await checkOwnPassword(req, user, body.current, 'The current password is wrong.')
    checkNewPassword(body.next)
    const passwordHash = await hashPassword(body.next)
    getDb().update(users).set({ passwordHash }).where(eq(users.id, user.id)).run()
    endUserSessions(user.id, user.sessionId)
    audit('password_changed', { userId: user.id })
    return { ok: true as const }
  })

  addRoute(app, routes.sessions, ({ user }) => ({
    sessions: listSessions(user.id).map((session) => ({ ...session, current: session.id === user.sessionId })),
  }))

  addRoute(app, routes.endSession, ({ req, reply, user, params }) => {
    if (!endSession(user.id, params.sessionId)) {
      throw new ApiError('not_found', 'This session has already ended.')
    }
    if (params.sessionId === user.sessionId) {
      clearSessionCookie(req, reply)
    }
    return { ok: true as const }
  })

  addRoute(app, routes.signOutOthers, ({ user }) => {
    endUserSessions(user.id, user.sessionId)
    return { ok: true as const }
  })

  // TFA-01: with two-factor sign-in on, a code too, used up here; a wrong one counts like a wrong
  // password.
  addRoute(app, routes.confirm, async ({ req, user, body }) => {
    if (user.twoFactor) {
      checkSecondFactorGiven(body)
    }
    await checkOwnPassword(req, user, body.password, 'The password is wrong.')
    if (user.twoFactor && useSecondFactor(user.id, body) === 'wrong') {
      signInTries.fail(tryKeys(req.ip, user.username))
      throw new ApiError('bad_request', twoFactorTexts.wrongCode)
    }
    return { until: confirmSession(user.sessionId) }
  })

  // TFA-01 "Turn on", after "Confirm it's you" with the password.
  addRoute(
    app,
    routes.twoFactorSetup,
    ({ user }) => {
      if (user.twoFactor) {
        throw new ApiError('conflict', twoFactorTexts.alreadyOn)
      }
      const key = newTotpSecret()
      const now = Date.now()
      getDb().update(users).set({ totpPending: key, totpPendingAt: now }).where(eq(users.id, user.id)).run()
      const domain = new URL(config.origin).hostname
      return { key, uri: totpUri(domain, user.username, key), expiresAt: now + setupMs }
    },
    { confirm: true },
  )

  // The setup's code: it is on, the other sessions end, and this one confirms again (its window
  // was opened with the password alone).
  addRoute(app, routes.twoFactorOn, ({ user, body }) => {
    const codes = newRecoveryCodes()
    turnOnTwoFactor(user.id, body.code, codes.hashes)
    endUserSessions(user.id, user.sessionId)
    unconfirmSession(user.sessionId)
    audit('two_factor_on', { userId: user.id })
    return { recoveryCodes: codes.shown }
  })

  addRoute(
    app,
    routes.twoFactorOff,
    ({ user }) => {
      if (!turnOffTwoFactor(user.id, user.sessionId)) {
        throw new ApiError('conflict', twoFactorTexts.off)
      }
      audit('two_factor_off', { userId: user.id })
      return { ok: true as const }
    },
    { confirm: true },
  )

  addRoute(
    app,
    routes.newRecoveryCodes,
    ({ user }) => {
      const codes = newRecoveryCodes()
      const [row] = getDb()
        .update(users)
        .set({ recoveryCodes: codes.hashes })
        .where(and(eq(users.id, user.id), isNotNull(users.totpSecret)))
        .returning({ id: users.id })
        .all()
      if (!row) {
        throw new ApiError('conflict', twoFactorTexts.off)
      }
      audit('recovery_codes_made', { userId: user.id })
      return { recoveryCodes: codes.shown }
    },
    { confirm: true },
  )
}
