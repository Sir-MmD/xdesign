// The site owner of `make dev` (XD_DEV=1): on the first start with no people, the username "owner"
// with a generated password, both written to <XD_DATA_DIR>/dev-owner.txt; every dev start
// prints them (USER-01a: the site owner's username as the database has it, as a file written
// before usernames still holds the email).
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { count } from 'drizzle-orm'

import { getDb } from '../db/index.ts'
import { users } from '../db/schema.ts'
import { hashPassword } from './passwords.ts'
import { generatePassword } from './tokens.ts'
import { createUser, findSiteOwner } from './users.ts'

const devUsername = 'owner'

export async function ensureDevOwner(dataDir: string): Promise<void> {
  const file = join(dataDir, 'dev-owner.txt')
  const [{ n } = { n: 0 }] = getDb().select({ n: count() }).from(users).all()
  if (n === 0) {
    const password = generatePassword()
    createUser({ username: devUsername, name: 'Owner', passwordHash: await hashPassword(password), isSiteOwner: true })
    writeFileSync(file, `${devUsername}\n${password}\n`, { mode: 0o600 })
  }
  if (existsSync(file)) {
    const [, password = ''] = readFileSync(file, 'utf8').split('\n')
    console.log(`Dev owner: ${findSiteOwner()?.username ?? devUsername} / ${password}`)
  }
}
