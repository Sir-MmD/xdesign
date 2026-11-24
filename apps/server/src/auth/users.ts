// The people of the site (users table): made by init-owner and the dev owner, and shown to the
// web app as `user` of @xdesign/api.
import type { User } from '@xdesign/api'
import { count, eq, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { getDb } from '../db/index.ts'
import { users } from '../db/schema.ts'

export type UserRow = typeof users.$inferSelect

// New people get the next of these colors in turn; they pick another on the Account page. The
// same ten as the Account page's personColors (apps/web/src/lib/colors.ts), in its order.
const colors = [
  '#2563eb',
  '#4f46e5',
  '#7c3aed',
  '#be185d',
  '#dc2626',
  '#c2410c',
  '#b45309',
  '#15803d',
  '#0f766e',
  '#0e7490',
]

// The fields of `user` alone, from a row or a SessionUser (made from a row, with its two-factor
// fields already).
export function toUser(person: User | UserRow): User {
  const { twoFactor, recoveryCodesLeft } =
    'passwordHash' in person
      ? { twoFactor: person.totpSecret !== null, recoveryCodesLeft: person.recoveryCodes.length }
      : person
  return {
    id: person.id,
    // Every account has one once openDatabase gave the old ones theirs (db/usernames.ts).
    username: person.username ?? '',
    name: person.name,
    color: person.color,
    isSiteOwner: person.isSiteOwner,
    twoFactor,
    recoveryCodesLeft,
    theme: person.theme,
    mapLines: person.mapLines,
  }
}

// A username is one person's, ignoring case (USER-01a): making or changing one to a used one fails.
export const usernameTaken = 'Someone on this site already uses this username.'

// Usernames are stored in lower case (the `username` schema lowers them); the index compares in
// lower case too.
export function findUserByUsername(username: string): UserRow | undefined {
  return getDb()
    .select()
    .from(users)
    .where(eq(sql`lower(${users.username})`, username.trim().toLowerCase()))
    .get()
}

export function findSiteOwner(): UserRow | undefined {
  return getDb().select().from(users).where(eq(users.isSiteOwner, true)).get()
}

export interface NewUser {
  username: string
  name: string
  passwordHash: string
  isSiteOwner?: boolean
}

// Also inside a transaction: better-sqlite3 runs one at a time on the one connection.
export function createUser(person: NewUser): UserRow {
  const db = getDb()
  const [{ n } = { n: 0 }] = db.select({ n: count() }).from(users).all()
  return db
    .insert(users)
    .values({
      id: nanoid(),
      username: person.username.toLowerCase(),
      name: person.name,
      passwordHash: person.passwordHash,
      isSiteOwner: person.isSiteOwner ?? false,
      createdAt: Date.now(),
      color: colors[n % colors.length] ?? '#2563eb',
    })
    .returning()
    .get()
}
