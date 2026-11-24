// `list-users`: the site's people, one line each: username, name, site owner or member, disabled,
// last seen. `xdesign admin list-users` runs it (docs/plan/07 section 7, USER-01a).
import { asc } from 'drizzle-orm'

import { config } from '../config.ts'
import { closeDatabase, getDb, openDatabase } from '../db/index.ts'
import { users } from '../db/schema.ts'
import type { Command } from './command.ts'

// A time as "2026-11-23 14:05" (UTC).
function when(at: number | null): string {
  return at === null ? 'never' : new Date(at).toISOString().slice(0, 16).replace('T', ' ')
}

export const listUsers: Command = {
  summary: "List the site's people",
  run: () => {
    openDatabase(config.dbPath)
    try {
      const rows = getDb().select().from(users).orderBy(asc(users.createdAt)).all()
      if (rows.length === 0) {
        console.log('No one has an account yet.')
        return 0
      }
      const lines = [
        ['Username', 'Name', 'Role', 'Status', 'Last seen (UTC)'],
        ...rows.map((row) => [
          row.username ?? '',
          row.name,
          row.isSiteOwner ? 'site owner' : 'member',
          row.disabledAt === null ? 'active' : 'disabled',
          when(row.lastSeenAt),
        ]),
      ]
      const widths = lines[0]?.map((_, column) => Math.max(...lines.map((line) => line[column]?.length ?? 0))) ?? []
      for (const line of lines) {
        console.log(
          line
            .map((cell, column) => cell.padEnd(widths[column] ?? 0))
            .join('  ')
            .trimEnd(),
        )
      }
      return 0
    } finally {
      closeDatabase()
    }
  },
}
