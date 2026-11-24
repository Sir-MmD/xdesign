// `reset-password <username>`: gives the person a new generated password, prints it once and ends
// their sessions. `xdesign admin reset-password <username>` runs it (docs/plan/07 section 7, 05
// section 1 item 1, USER-01a).
import { eq } from 'drizzle-orm'

import { audit } from '../audit.ts'
import { hashPassword } from '../auth/passwords.ts'
import { endUserSessions } from '../auth/sessions.ts'
import { generatePassword } from '../auth/tokens.ts'
import { findUserByUsername } from '../auth/users.ts'
import { config } from '../config.ts'
import { closeDatabase, getDb, openDatabase } from '../db/index.ts'
import { users } from '../db/schema.ts'
import type { Command } from './command.ts'

export const resetPassword: Command = {
  summary: 'Give a person a new password, print it once and end their sessions',
  usage: '<username>',
  run: async ([login]) => {
    if (login === undefined || login.trim() === '') {
      console.error('Usage: reset-password <username>')
      return 2
    }
    openDatabase(config.dbPath)
    try {
      const row = findUserByUsername(login)
      if (!row) {
        console.error(`No one on this site has the username ${login.trim().toLowerCase()}.`)
        return 1
      }
      const password = generatePassword()
      const passwordHash = await hashPassword(password)
      getDb().update(users).set({ passwordHash }).where(eq(users.id, row.id)).run()
      // Live connections of the running server follow once it checks them again (LIVE-01).
      endUserSessions(row.id)
      audit('password_reset', { userId: row.id, detail: { by: 'command' } })
      console.log(
        `Sign in with ${row.username ?? ''} and this new password. It is shown only now: ${password}. Change it under Account.`,
      )
      return 0
    } finally {
      closeDatabase()
    }
  },
}
