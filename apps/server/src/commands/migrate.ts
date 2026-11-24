// `migrate`: runs the database migrations and exits. The installer and the updater run it before
// they start the app (docs/plan/07 sections 3 and 6.3); the server also runs them at start.
import { config } from '../config.ts'
import { closeDatabase, openDatabase } from '../db/index.ts'
import type { Command } from './command.ts'

export const migrate: Command = {
  summary: 'Run the database migrations and exit',
  run: () => {
    openDatabase(config.dbPath)
    closeDatabase()
    console.log(`The database is up to date: ${config.dbPath}`)
    return 0
  },
}
