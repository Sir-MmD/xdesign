// `reset-2fa <username>`: turns two-factor sign-in off for a person who lost their phone and their
// recovery codes (the site owner's own too): the secret and the recovery codes go, and every
// session and unfinished sign-in of theirs ends. `xdesign admin reset-2fa <username>` runs it
// after its own question (docs/plan/17 section 7, TFA-01; USER-01a).
import { audit } from '../audit.ts'
import { turnOffTwoFactor } from '../auth/two-factor.ts'
import { findUserByUsername } from '../auth/users.ts'
import { config } from '../config.ts'
import { closeDatabase, openDatabase } from '../db/index.ts'
import type { Command } from './command.ts'

export const reset2fa: Command = {
  summary: 'Turn off two-factor sign-in for a person and end their sessions',
  usage: '<username>',
  run: ([login]) => {
    if (login === undefined || login.trim() === '') {
      console.error('Usage: reset-2fa <username>')
      return 2
    }
    openDatabase(config.dbPath)
    try {
      const row = findUserByUsername(login)
      if (!row) {
        console.error(`No one on this site has the username ${login.trim().toLowerCase()}.`)
        return 1
      }
      // Live connections of the running server follow once it checks them again (LIVE-01).
      if (!turnOffTwoFactor(row.id)) {
        console.error(`Two-factor authentication is already off for ${row.username ?? row.name}.`)
        return 1
      }
      audit('two_factor_reset', { userId: row.id, detail: { by: 'command' } })
      console.log('Two-factor authentication is off now.')
      return 0
    } finally {
      closeDatabase()
    }
  },
}
