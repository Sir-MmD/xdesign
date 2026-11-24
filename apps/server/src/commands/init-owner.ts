// `init-owner --username <username> --name <name>`: makes the site owner when there is none and
// prints a generated password once. The installer runs it (docs/plan/07 section 3, 05 section 1
// item 1; USER-01a: a username instead of the email).
import { parseArgs } from 'node:util'

import { personName, username } from '@xdesign/api'

import { audit } from '../audit.ts'
import { hashPassword } from '../auth/passwords.ts'
import { generatePassword } from '../auth/tokens.ts'
import { createUser, findSiteOwner, findUserByUsername } from '../auth/users.ts'
import { config } from '../config.ts'
import { closeDatabase, openDatabase } from '../db/index.ts'
import type { Command } from './command.ts'

const usage = '--username <username> --name <name>'

export const initOwner: Command = {
  summary: 'Make the site owner and print a generated password once',
  usage,
  run: async (args) => {
    const { values } = parseArgs({ args, options: { username: { type: 'string' }, name: { type: 'string' } } })
    const login = username.safeParse(values.username ?? '')
    const name = personName.safeParse(values.name ?? '')
    if (!login.success || !name.success) {
      const problem = (login.error ?? name.error)?.issues[0]?.message ?? ''
      console.error(`${problem}\nUsage: init-owner ${usage}`)
      return 2
    }
    openDatabase(config.dbPath)
    try {
      const owner = findSiteOwner()
      if (owner) {
        console.error(`The site already has an owner: ${owner.username ?? owner.name}`)
        return 1
      }
      if (findUserByUsername(login.data)) {
        console.error('Someone on this site already uses this username.')
        return 1
      }
      const password = generatePassword()
      const created = createUser({
        username: login.data,
        name: name.data,
        passwordHash: await hashPassword(password),
        isSiteOwner: true,
      })
      audit('owner_created', { userId: created.id })
      console.log(
        `Sign in with ${login.data} and this password. It is shown only now: ${password}. Change it under Account.`,
      )
      return 0
    } finally {
      closeDatabase()
    }
  },
}
