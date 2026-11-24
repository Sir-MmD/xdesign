// Signing in and out, the account page and its sessions, and "Confirm it's you" (docs/plan/04
// section 2, 05 section 1, 02 section 8).
import { z } from 'zod'

import {
  color,
  mapLinesView,
  newPassword,
  ok,
  password,
  personName,
  recoveryCode,
  serverMode,
  siteTheme,
  time,
  token,
  totpCode,
  user,
  username,
} from '../common.ts'
import { defineRoute } from '../route.ts'

// A signed-in browser on the account page's "Sessions" list.
export const session = z.object({
  id: z.string(),
  createdAt: time,
  lastUsedAt: time,
  expiresAt: time,
  userAgent: z.string().nullable(),
  ip: z.string().nullable(),
  // The session of this request.
  current: z.boolean(),
})

// TFA-01: the 10 new recovery codes as XXXX-XXXX-XXXX-XXXX, shown only now.
const recoveryCodes = z.object({ recoveryCodes: z.array(z.string()) })

// USER-01a: the username as typed to sign in, matched ignoring case and surrounding spaces; any
// other text is only a wrong one.
const typedUsername = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Enter your username.')
  .max(200, 'Use at most 200 characters.')

export const authRoutes = {
  // A person with two-factor sign-in on gets the code step instead of the session: its token
  // (`challenge`, for signInCode) and when it ends (5 minutes).
  signIn: defineRoute({
    key: 'signIn',
    method: 'POST',
    path: '/api/auth/sign-in',
    body: z.object({ username: typedUsername, password }),
    response: z.union([z.object({ user }), z.object({ challenge: z.string(), expiresAt: time })]),
    auth: 'public',
  }),
  // TFA-01 "Enter your code": a code from the app or one recovery code (exactly one), from the
  // same IP address. A wrong one answers 400 "Wrong code. N attempts left."; after the fifth, or
  // once the step expired, 401 step_expired: enter the password again.
  signInCode: defineRoute({
    key: 'signInCode',
    method: 'POST',
    path: '/api/auth/sign-in/code',
    body: z.object({ challenge: token, code: totpCode.optional(), recoveryCode: recoveryCode.optional() }),
    response: z.object({ user }),
    auth: 'public',
  }),
  // Public, so it also answers when the session has already ended.
  signOut: defineRoute({
    key: 'signOut',
    method: 'POST',
    path: '/api/auth/sign-out',
    response: ok,
    auth: 'public',
  }),
  // DESK-01: `mode`, and in the desktop app the port its server uses this time and the one it
  // prefers (the Claude card says when they differ, 18 section 9.6); null on a server.
  me: defineRoute({
    key: 'me',
    method: 'GET',
    path: '/api/me',
    response: z.object({
      user,
      mode: serverMode,
      desktop: z.object({ port: z.number().int(), preferredPort: z.number().int() }).nullable(),
    }),
    auth: 'member',
  }),
  updateMe: defineRoute({
    key: 'updateMe',
    method: 'PATCH',
    path: '/api/me',
    // Only the site owner changes their username (USER-01a, 18 section 3.5). THEME-01: the top
    // bar's Light and Dark switch. MAP-11: the map's Lines switch.
    body: z.object({
      name: personName.optional(),
      username: username.optional(),
      color: color.optional(),
      theme: siteTheme.nullable().optional(),
      mapLines: mapLinesView.optional(),
    }),
    response: z.object({ user }),
    auth: 'member',
  }),
  changePassword: defineRoute({
    key: 'changePassword',
    method: 'POST',
    path: '/api/me/password',
    body: z.object({ current: password, next: newPassword }),
    response: ok,
    auth: 'member',
  }),
  sessions: defineRoute({
    key: 'sessions',
    method: 'GET',
    path: '/api/me/sessions',
    response: z.object({ sessions: z.array(session) }),
    auth: 'member',
  }),
  endSession: defineRoute({
    key: 'endSession',
    method: 'DELETE',
    path: '/api/me/sessions/:sessionId',
    params: z.object({ sessionId: z.string().min(1).max(200) }),
    response: ok,
    auth: 'member',
  }),
  // "Sign out everywhere else".
  signOutOthers: defineRoute({
    key: 'signOutOthers',
    method: 'POST',
    path: '/api/me/sessions/sign-out-others',
    response: ok,
    auth: 'member',
  }),
  // "Confirm it's you": the password opens a 5-minute window for risky actions. With two-factor
  // sign-in on, also a code from the app or one recovery code (exactly one; TFA-01).
  confirm: defineRoute({
    key: 'confirm',
    method: 'POST',
    path: '/api/auth/confirm',
    body: z.object({ password, code: totpCode.optional(), recoveryCode: recoveryCode.optional() }),
    response: z.object({ until: time }),
    auth: 'member',
  }),
  // TFA-01 "Turn on", after "Confirm it's you": a new secret for the authenticator app, its key
  // to type in and the otpauth address the browser draws as a QR code, waiting 15 minutes for
  // twoFactorOn.
  twoFactorSetup: defineRoute({
    key: 'twoFactorSetup',
    method: 'POST',
    path: '/api/me/two-factor/setup',
    response: z.object({ key: z.string(), uri: z.string(), expiresAt: time }),
    auth: 'member',
  }),
  // The app's code for the setup turns it on: the person's other sessions end.
  twoFactorOn: defineRoute({
    key: 'twoFactorOn',
    method: 'POST',
    path: '/api/me/two-factor',
    body: z.object({ code: totpCode }),
    response: recoveryCodes,
    auth: 'member',
  }),
  // "Turn off", after "Confirm it's you" with a code: the person's other sessions end.
  twoFactorOff: defineRoute({
    key: 'twoFactorOff',
    method: 'DELETE',
    path: '/api/me/two-factor',
    response: ok,
    auth: 'member',
  }),
  // "New recovery codes", after "Confirm it's you" with a code: the old ones stop working.
  newRecoveryCodes: defineRoute({
    key: 'newRecoveryCodes',
    method: 'POST',
    path: '/api/me/two-factor/recovery-codes',
    response: recoveryCodes,
    auth: 'member',
  }),
}
