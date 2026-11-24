// What "Confirm it's you" asks for (ConfirmItsYouDialog.tsx): the password, and with two-factor
// sign-in on (docs/plan/17 section 7) a code from the authenticator app or one recovery code.

/** The proof POST /api/auth/confirm takes: the password, and a code or a recovery code. */
export interface Proof {
  password: string
  code?: string
  recoveryCode?: string
}

/** What the dialog asks for, inside a sentence: "It needs your password." */
export function proofWords(twoFactor: boolean): string {
  return twoFactor ? 'your password and a code from your authenticator app' : 'your password'
}
