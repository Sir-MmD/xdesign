// USER-01a: the usernames of the accounts made before there were usernames (docs/plan/18 section
// 3.2, D-731), given once, right after the migration that adds them (openDatabase, so before the
// server answers or a command reads): each made from the person's Name, oldest account first, so
// the site owner keeps the plain one; one Activity row each, by nobody.
import { asc, eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import type { AuditAction } from '../audit.ts'
import type { Db } from './index.ts'
import { audit, users } from './schema.ts'

const maxLength = 32
const given: AuditAction = 'username_given'

// The Name in lower case: letters a to z and digits kept, each run of spaces, dots, underscores
// and hyphens one dot, every other character dropped (a Persian Name gives nothing), no dot at
// the start or the end, at most 32 characters; "user" when that leaves fewer than 3.
export function usernameFromName(name: string): string {
  const made = name
    .toLowerCase()
    .replace(/[^a-z0-9\s._-]/g, '')
    .replace(/[\s._-]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, maxLength)
  return made.length < 3 ? 'user' : made
}

// The first free one of "mmd", "mmd2", "mmd3", cut so it stays within 32 characters.
function freeUsername(base: string, taken: ReadonlySet<string>): string {
  for (let n = 1; ; n++) {
    const number = n === 1 ? '' : String(n)
    const username = base.slice(0, maxLength - number.length) + number
    if (!taken.has(username)) {
      return username
    }
  }
}

// Gives every account without a username one; nothing to do once each has one.
export function giveUsernames(db: Db): void {
  db.transaction((tx) => {
    const rows = tx
      .select({ id: users.id, name: users.name, username: users.username })
      .from(users)
      .orderBy(asc(users.createdAt), asc(users.id))
      .all()
    const taken = new Set(rows.flatMap((row) => (row.username === null ? [] : [row.username.toLowerCase()])))
    const now = Date.now()
    for (const row of rows) {
      if (row.username !== null) {
        continue
      }
      const username = freeUsername(usernameFromName(row.name), taken)
      taken.add(username)
      tx.update(users).set({ username }).where(eq(users.id, row.id)).run()
      tx.insert(audit)
        .values({
          id: nanoid(),
          at: now,
          userId: null,
          action: given,
          designId: null,
          detail: { memberId: row.id, name: row.name, username },
        })
        .run()
    }
  })
}
