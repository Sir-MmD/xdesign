// Schemas shared by the areas of the API: IDs, times, the fields of the account forms, the error
// format (docs/plan/02-architecture.md sections 5, 7 and 8).
import { z } from 'zod'

// IDs are random 21-character nanoid strings; times are UTC milliseconds.
export const id = z.string().regex(/^[\w-]{21}$/, 'Not a valid id.')
export const time = z.number().int()

// The secret token of a view-only or Claude link, as the link carries it, and of a sign-in step.
export const token = z.string().min(1).max(200)

// USER-01a: what a person signs in with (D-730, from xWriter): 3 to 32 characters, letters a to
// z, digits, dots, underscores and hyphens, starting with a letter or a digit; unique on the site
// ignoring case and kept in lower case (what is typed in capitals is lowered).
const usernameLength = 'A username has 3 to 32 characters.'
export const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, usernameLength)
  .max(32, usernameLength)
  .regex(
    /^[a-z0-9][a-z0-9._-]*$/,
    'Use letters a to z, digits, dots, underscores and hyphens, starting with a letter or a digit.',
  )

// The hint under every username field.
export const usernameHint = 'Letters, digits, dots, underscores and hyphens.'

// A new password: at least 10 characters (the server also refuses the most common ones).
export const newPassword = z.string().min(10, 'Use at least 10 characters.').max(200, 'Use at most 200 characters.')

// A password typed to sign in or to confirm: any length, so the answer tells nothing.
export const password = z.string().min(1, 'Enter your password.').max(200, 'Use at most 200 characters.')

export const personName = z.string().trim().min(1, 'Enter a name.').max(100, 'Use at most 100 characters.')

// The person's color for cursors and avatars.
export const color = z.string().regex(/^#[0-9a-f]{6}$/i, 'Pick a color.')

// TFA-01: a code from the authenticator app (6 digits, a space in the middle is fine) and a
// recovery code as typed (XXXX-XXXX-XXXX-XXXX; dashes, spaces and case do not matter).
export const totpCode = z.string().regex(/^\s*\d{3}\s?\d{3}\s*$/, 'Enter the 6-digit code.')
export const recoveryCode = z.string().min(1, 'Enter a recovery code.').max(40, 'Use at most 40 characters.')

// THEME-01: the site's Light or Dark as the person chose it with the top bar's switch (17 section
// 8); null until they press it, while the site follows the computer.
export const siteThemes = ['light', 'dark'] as const
export const siteTheme = z.enum(siteThemes)
export type SiteTheme = z.output<typeof siteTheme>

// MAP-11: how the map draws its lines, from the map's switch "Lines: Short tags | All lines"
// (18 section 5.3): far lines as short tags (the default) or every line across the map.
export const mapLinesViews = ['short', 'all'] as const
export const mapLinesView = z.enum(mapLinesViews)
export type MapLinesView = z.output<typeof mapLinesView>

// DESK-01: which form of xDesign answers (GET /api/health and GET /api/me): the website on a
// server, or the desktop app on a PC for one person (docs/plan/18 section 9).
export const serverModes = ['server', 'desktop'] as const
export const serverMode = z.enum(serverModes)
export type ServerMode = z.output<typeof serverMode>

// The signed-in person (GET /api/me).
export const user = z.object({
  id,
  username: z.string(),
  name: z.string(),
  color: z.string(),
  isSiteOwner: z.boolean(),
  // TFA-01: two-factor sign-in is on, and how many unused recovery codes are left (0 when off).
  twoFactor: z.boolean(),
  recoveryCodesLeft: z.number().int(),
  theme: siteTheme.nullable(),
  mapLines: mapLinesView,
})
export type User = z.output<typeof user>

// Another person as a list shows them.
export const person = z.object({ id, name: z.string() })

// The answer of a route that only reports success.
export const ok = z.object({ ok: z.literal(true) })

export const errorCodes = [
  'bad_request',
  'not_signed_in',
  'no_access',
  // "Confirm it's you" first (POST /api/auth/confirm), then try again.
  'confirm_needed',
  // A changing request without the site's own Origin (02 section 7).
  'bad_origin',
  'not_found',
  'conflict',
  'too_large',
  'too_many_tries',
  // TFA-01: the sign-in code step is over (expired, no wrong codes left, another IP address):
  // enter the password again.
  'step_expired',
  'server_error',
  // The Go helper's control socket did not answer (`make dev` runs without it).
  'no_helper',
  // DESK-01: the desktop app has no such thing (desktop.ts), 404 "Not in the desktop app.".
  'not_in_desktop',
] as const
export type ApiErrorCode = (typeof errorCodes)[number]

// Every failure: { "error": { "code": "not_found", "message": "Plain-words text for the screen" } }.
export const apiError = z.object({
  error: z.object({ code: z.enum(errorCodes), message: z.string() }),
})
export type ApiErrorBody = z.output<typeof apiError>

// ACT-01: a list the server pages (docs/plan/18 section 6): the open page, from 1 (an address
// may carry it as text), and its rows per page, one of the four sizes of the pager's "Rows per
// page" (25 to start).
export const rowsPerPageChoices = [10, 25, 50, 100] as const
export type RowsPerPage = (typeof rowsPerPageChoices)[number]
export const defaultRowsPerPage: RowsPerPage = 25
export const pageNumber = z.coerce
  .number()
  .int('Use a whole number.')
  .min(1, 'Use page 1 or later.')
  .max(1_000_000_000, 'Use a lower page.')
export const rowsPerPage = z.coerce.number().pipe(z.literal(rowsPerPageChoices, 'Use 10, 25, 50 or 100.'))
