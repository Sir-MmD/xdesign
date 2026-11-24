// The desktop app's data folder (docs/plan/18 section 9.7, DESK-01): the settings table keeps the
// newest xDesign version that opened the database, and an older version refuses it before its
// migrations run, with exit code 78 and the sentence the app's window shows (the last line on
// standard error, after `xdesign-desktop-error: `). A server has no such check.
import { existsSync } from 'node:fs'

import Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'

import { getDb } from '../db/index.ts'
import { settings } from '../db/schema.ts'
import { version } from '../version.ts'

// The exit codes the app's shell reads. DESK-02: a restore stages its files, then the server exits
// with exitRestart and the shell starts it again.
export const exitRestart = 75
export const exitDataFolder = 78

const sentencePrefix = 'xdesign-desktop-error: '

// The settings row of the newest version that opened the database.
const newestKey = 'newestVersion'

// X.Y.Z with an optional pre-release and build, as build.sh and the helper's ParseVersion take them.
const versionPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

// Two pre-release identifiers in semantic versioning's order: digits only below the others.
function compareIdentifiers(a: string, b: string): number {
  const aDigits = /^\d+$/.test(a)
  const bDigits = /^\d+$/.test(b)
  if (aDigits && bDigits) {
    return Math.sign(Number(a) - Number(b))
  }
  if (aDigits !== bDigits) {
    return aDigits ? -1 : 1
  }
  return a === b ? 0 : a < b ? -1 : 1
}

// Semantic versioning's order (semver.org item 11): below 0 when a is older than b, 0 when they are
// the same, above 0 when a is newer; null when one is not a version. DESK-02's restore compares a
// backup's version the same way.
export function compareVersions(a: string, b: string): number | null {
  const left = versionPattern.exec(a)
  const right = versionPattern.exec(b)
  if (!left || !right) {
    return null
  }
  for (const part of [1, 2, 3]) {
    const difference = Number(left[part]) - Number(right[part])
    if (difference !== 0) {
      return Math.sign(difference)
    }
  }
  const leftPre = left[4]?.split('.')
  const rightPre = right[4]?.split('.')
  if (leftPre === undefined || rightPre === undefined) {
    // A release comes after its pre-releases.
    return leftPre === rightPre ? 0 : leftPre === undefined ? 1 : -1
  }
  for (let i = 0; i < Math.max(leftPre.length, rightPre.length); i++) {
    const leftId = leftPre[i]
    const rightId = rightPre[i]
    if (leftId === undefined || rightId === undefined) {
      return leftId === undefined ? -1 : 1
    }
    const order = compareIdentifiers(leftId, rightId)
    if (order !== 0) {
      return order
    }
  }
  return 0
}

// The newest version that opened the database file, read before it is opened for real; undefined
// for a new data folder, or one no desktop app opened yet.
function newestVersionIn(dbPath: string): string | undefined {
  if (!existsSync(dbPath)) {
    return undefined
  }
  const sqlite = new Database(dbPath, { fileMustExist: true })
  try {
    const table = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'settings'").get()
    if (table === undefined) {
      return undefined
    }
    // The value as the settings table keeps it: JSON text.
    const row = sqlite
      .prepare("SELECT json_extract(value, '$') AS value FROM settings WHERE key = ? AND json_valid(value)")
      .get(newestKey)
    const value = (row as { value?: unknown } | undefined)?.value
    return typeof value === 'string' ? value : undefined
  } finally {
    sqlite.close()
  }
}

// Writes the sentence for the app's window as the last line on standard error and exits with
// code 78.
async function refuseDataFolder(sentence: string): Promise<never> {
  await new Promise<void>((resolve) => {
    process.stderr.write(`${sentencePrefix}${sentence}\n`, () => {
      resolve()
    })
  })
  process.exit(exitDataFolder)
}

// Before the database opens: a data folder saved by a newer xDesign stops the server.
export async function checkDataFolder(dbPath: string): Promise<void> {
  const newest = newestVersionIn(dbPath)
  if (newest !== undefined && (compareVersions(newest, version) ?? 0) > 0) {
    await refuseDataFolder(`These designs were saved by xDesign ${newest}. Use that version or a newer one.`)
  }
}

// Once the database is open: this version, when it is newer than the one kept.
export function keepNewestVersion(): void {
  const db = getDb()
  const row = db.select().from(settings).where(eq(settings.key, newestKey)).get()
  const kept = typeof row?.value === 'string' ? row.value : undefined
  if (kept === undefined || (compareVersions(version, kept) ?? 1) > 0) {
    db.insert(settings)
      .values({ key: newestKey, value: version })
      .onConflictDoUpdate({ target: settings.key, set: { value: version } })
      .run()
  }
}
