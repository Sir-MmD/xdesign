// The database: one SQLite file in WAL mode, <XD_DATA_DIR>/xdesign.db (docs/plan/02-architecture.md
// section 5), opened once by the server or a command; the migrations run before anything else.
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import * as schema from './schema.ts'
import { giveUsernames } from './usernames.ts'

// Under tsx this module runs as source (src/db/index.ts, the migrations two folders up); in the
// bundles (dist/server.mjs and dist/cli.mjs, app/ in a release) the migrations folder is beside it.
const migrationsDir = fileURLToPath(
  new URL(import.meta.url.endsWith('.ts') ? '../../migrations' : './migrations', import.meta.url),
)

function open(file: string) {
  mkdirSync(dirname(file), { recursive: true })
  const sqlite = new Database(file)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  // Waits up to 5 seconds for a lock instead of failing at once.
  sqlite.pragma('busy_timeout = 5000')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: migrationsDir })
  return db
}

export type Db = ReturnType<typeof open>

let current: Db | undefined

// Opens the database and runs the migrations it has not had yet, then (USER-01a) gives the
// accounts made before usernames theirs.
export function openDatabase(file: string): Db {
  current = open(file)
  giveUsernames(current)
  return current
}

// The open database (openDatabase ran at start).
export function getDb(): Db {
  if (!current) {
    throw new Error('The database is not open.')
  }
  return current
}

export function closeDatabase(): void {
  current?.$client.close()
  current = undefined
}
