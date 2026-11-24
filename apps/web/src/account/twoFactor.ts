// Helpers of the two-factor screens (docs/plan/17 section 7, from xWriter's
// features/panel-settings/security/twoFactor.ts and features/auth/login.ts): the key for typing
// by hand, the recovery codes as a text file for "Download", made in the browser from the answer
// so the server keeps no plain codes, and the codes left in words.

/** The account page warns when this many recovery codes or fewer are left. */
export const fewRecoveryCodes = 3

/** How long the server keeps a sign-in step and an unfinished setup. */
export const signInStepMs = 5 * 60 * 1000
export const setupMs = 15 * 60 * 1000

/**
 * A deadline of the server on this browser's clock: the server's time when the two clocks agree,
 * else `longest` from now, so a computer clock that is off neither ends a step at once nor shows
 * more time than the server gives.
 */
export function localDeadline(serverTime: number, longest: number): number {
  const now = Date.now()
  return serverTime > now && serverTime <= now + longest ? serverTime : now + longest
}

/** The base32 key in groups of four characters, for typing it into an app by hand. */
export function groupSecret(secret: string): string {
  return (secret.replace(/\s/g, '').match(/.{1,4}/g) ?? []).join(' ')
}

/** "10 recovery codes left.", "1 recovery code left.". */
export function recoveryCodesLeft(left: number): string {
  return left === 1 ? '1 recovery code left.' : `${String(left)} recovery codes left.`
}

/** The text file of the recovery codes ("Download"), made in the browser. */
export function recoveryCodesFile(codes: readonly string[], site: string, createdAt: string): string {
  return [
    'xDesign recovery codes',
    `Site: ${site}`,
    `Created: ${createdAt}`,
    '',
    'Each code signs you in once instead of a code from the authenticator app.',
    'Keep this file somewhere safe, away from this computer, for example in a password manager.',
    '',
    ...codes.map((code, index) => `${String(index + 1).padStart(2, ' ')}. ${code}`),
    '',
  ].join('\n')
}

/** Saves `text` as a file named `name` through the browser's downloads. */
export function downloadText(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  // The click started the download; an address freed at once gave an iPhone an error page.
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 40_000)
}
