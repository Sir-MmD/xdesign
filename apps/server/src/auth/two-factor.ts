// TFA-01 two-factor sign-in (docs/plan/17 section 7), as xWriter's: each person turns it on for
// themselves (a secret for the authenticator app, then a code, then 10 recovery codes), every
// sign-in then asks a code after the password (a sign-in step), and "Confirm it's you" asks one
// too. The site owner turns it off for a member, and `reset-2fa <username>` for anyone.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import { and, eq, isNotNull, lte, sql } from 'drizzle-orm'

import { audit } from '../audit.ts'
import { getDb } from '../db/index.ts'
import { signInSteps, users } from '../db/schema.ts'
import { ApiError } from '../errors.ts'
import { endUserSessions } from './sessions.ts'
import { hashToken, newToken } from './tokens.ts'
import { base32, matchTotp } from './totp.ts'

// A setup waits this long for its first code ("Finish within <countdown>.").
export const setupMs = 15 * 60 * 1000
// A sign-in step lasts 5 minutes and allows 5 wrong codes.
const stepMs = 5 * 60 * 1000
const stepAttempts = 5

export const twoFactorTexts = {
  alreadyOn: 'Two-factor authentication is already on.',
  off: 'Two-factor authentication is off.',
  notStarted: 'There is no unfinished two-factor setup, or it expired. Start the setup again.',
  wrongSetupCode: 'The code does not match. Enter the code the authenticator app shows now for xDesign.',
  codeNeeded: 'Enter the code from the authenticator app, or one recovery code.',
  wrongCode: 'Wrong code. Check the code in your authenticator app and try again.',
  stepExpired: 'The sign-in step expired. Enter your password again.',
  noAttemptsLeft: 'Wrong code, and no attempts are left. Enter your password again.',
  tooManyCodes: 'Too many failed attempts. Wait and try again.',
}

// Recovery codes: 10 codes of 10 random bytes (80 bits) in the Crockford base32 alphabet, shown
// as XXXX-XXXX-XXXX-XXXX and kept only as the SHA-256 of the 16 characters. A fast hash is
// enough: 80 random bits cannot be guessed offline.
const recoveryCodeCount = 10
const crockford = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

export interface RecoveryCodes {
  // As the person sees them, once.
  shown: string[]
  // As the users row keeps them.
  hashes: string[]
}

function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

export function newRecoveryCodes(): RecoveryCodes {
  const codes: RecoveryCodes = { shown: [], hashes: [] }
  while (codes.shown.length < recoveryCodeCount) {
    const code = base32(randomBytes(10), crockford)
    const hash = hashRecoveryCode(code)
    // 80 random bits never repeat in practice; the kept hashes must be unique all the same.
    if (!codes.hashes.includes(hash)) {
      codes.shown.push(`${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12)}`)
      codes.hashes.push(hash)
    }
  }
  return codes
}

// What the person typed as the 16 characters of a code: spaces and dashes removed, upper case,
// O read as 0, I and L as 1; null when that is not 16 characters of the alphabet.
function normalizeRecoveryCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, '').replaceAll('O', '0').replace(/[IL]/g, '1')
  return /^[0-9A-HJKMNP-TV-Z]{16}$/.test(code) ? code : null
}

// The kept hash that `input` is, compared in constant time with every one; null when none.
function matchRecoveryCode(hashes: string[], input: string): string | null {
  const code = normalizeRecoveryCode(input)
  if (code === null) {
    return null
  }
  const typed = Buffer.from(hashRecoveryCode(code))
  let matched: string | null = null
  for (const hash of hashes) {
    if (timingSafeEqual(Buffer.from(hash), typed) && matched === null) {
      matched = hash
    }
  }
  return matched
}

// A code from the app or a recovery code: exactly one of the two.
export interface SecondFactor {
  code?: string | undefined
  recoveryCode?: string | undefined
}

// Answers 400 when the request has neither or both.
export function checkSecondFactorGiven(proof: SecondFactor): void {
  if ((proof.code === undefined) === (proof.recoveryCode === undefined)) {
    throw new ApiError('bad_request', twoFactorTexts.codeNeeded)
  }
}

// Checks the person's code or recovery code and uses it up in the same transaction: the code's
// time step becomes the last used one, the recovery code is deleted (and Activity lists it).
// 'wrong' when it does not match, was used already, or two-factor sign-in is off.
export function useSecondFactor(userId: string, proof: SecondFactor): 'wrong' | 'code' | 'recoveryCode' {
  const db = getDb()
  const now = Date.now()
  const used = db.transaction(() => {
    const row = db
      .select({ secret: users.totpSecret, lastStep: users.totpLastStep, recoveryCodes: users.recoveryCodes })
      .from(users)
      .where(eq(users.id, userId))
      .get()
    if (!row || row.secret === null) {
      return null
    }
    if (proof.code !== undefined) {
      const step = matchTotp(row.secret, proof.code, now, row.lastStep)
      if (step === null) {
        return null
      }
      db.update(users).set({ totpLastStep: step }).where(eq(users.id, userId)).run()
      return { left: null }
    }
    const hash = proof.recoveryCode === undefined ? null : matchRecoveryCode(row.recoveryCodes, proof.recoveryCode)
    if (hash === null) {
      return null
    }
    const left = row.recoveryCodes.filter((kept) => kept !== hash)
    db.update(users).set({ recoveryCodes: left }).where(eq(users.id, userId)).run()
    return { left: left.length }
  })
  if (used === null) {
    return 'wrong'
  }
  if (used.left === null) {
    return 'code'
  }
  audit('recovery_code_used', { userId, detail: { left: used.left } })
  return 'recoveryCode'
}

// Turning it on: the code of the setup's secret makes it the person's, with its time step as
// the last used one and the hashes of their first recovery codes.
export function turnOnTwoFactor(userId: string, code: string, recoveryHashes: string[]): void {
  const db = getDb()
  const now = Date.now()
  db.transaction(() => {
    const row = db.select().from(users).where(eq(users.id, userId)).get()
    if (!row) {
      throw new ApiError('not_signed_in')
    }
    if (row.totpSecret !== null) {
      throw new ApiError('conflict', twoFactorTexts.alreadyOn)
    }
    if (row.totpPending === null || (row.totpPendingAt ?? 0) <= now - setupMs) {
      throw new ApiError('bad_request', twoFactorTexts.notStarted)
    }
    const step = matchTotp(row.totpPending, code, now, 0)
    if (step === null) {
      throw new ApiError('bad_request', twoFactorTexts.wrongSetupCode)
    }
    db.update(users)
      .set({
        totpSecret: row.totpPending,
        totpPending: null,
        totpPendingAt: null,
        totpLastStep: step,
        recoveryCodes: recoveryHashes,
      })
      .where(eq(users.id, userId))
      .run()
  })
}

// Turning it off (the person, the site owner's reset, the server command): the secret, an
// unfinished setup and the recovery codes go, and every session and sign-in step of the person
// but the session `keep`. False when it was off already.
export function turnOffTwoFactor(userId: string, keep?: string): boolean {
  const [row] = getDb()
    .update(users)
    .set({ totpSecret: null, totpPending: null, totpPendingAt: null, totpLastStep: 0, recoveryCodes: [] })
    .where(and(eq(users.id, userId), isNotNull(users.totpSecret)))
    .returning({ id: users.id })
    .all()
  if (!row) {
    return false
  }
  endUserSessions(userId, keep)
  return true
}

// After a right password: a new sign-in step and its token (the `challenge` of the code step).
export function startSignInStep(userId: string, ip: string): { challenge: string; expiresAt: number } {
  const db = getDb()
  const token = newToken()
  const now = Date.now()
  db.delete(signInSteps).where(lte(signInSteps.expiresAt, now)).run()
  db.insert(signInSteps)
    .values({ id: hashToken(token), userId, createdAt: now, expiresAt: now + stepMs, ip })
    .run()
  return { challenge: token, expiresAt: now + stepMs }
}

export interface SignInStep {
  id: string
  userId: string
  username: string
}

// The step of a challenge while it can be used from this IP address: not expired, with wrong
// codes left, its person enabled and still with two-factor sign-in on. Null otherwise.
export function openSignInStep(challenge: string, ip: string): SignInStep | null {
  const row = getDb()
    .select({ step: signInSteps, username: users.username, disabledAt: users.disabledAt, secret: users.totpSecret })
    .from(signInSteps)
    .innerJoin(users, eq(users.id, signInSteps.userId))
    .where(eq(signInSteps.id, hashToken(challenge)))
    .get()
  if (!row) {
    return null
  }
  const usable =
    row.step.expiresAt > Date.now() &&
    row.step.attempts < stepAttempts &&
    row.step.ip === ip &&
    row.disabledAt === null &&
    row.secret !== null
  return usable ? { id: row.step.id, userId: row.step.userId, username: row.username ?? '' } : null
}

// A wrong code at the step: the wrong codes still allowed (the step goes at 0).
export function failSignInStep(stepId: string): number {
  const [row] = getDb()
    .update(signInSteps)
    .set({ attempts: sql`${signInSteps.attempts} + 1` })
    .where(eq(signInSteps.id, stepId))
    .returning({ attempts: signInSteps.attempts })
    .all()
  const left = Math.max(0, stepAttempts - (row?.attempts ?? stepAttempts))
  if (left === 0) {
    endSignInStep(stepId)
  }
  return left
}

export function endSignInStep(stepId: string): void {
  getDb().delete(signInSteps).where(eq(signInSteps.id, stepId)).run()
}
