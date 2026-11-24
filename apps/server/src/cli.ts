// The app's own commands (docs/plan/07 section 7): `node app/cli.mjs <command> [arguments]`, run
// by the Go helper and the installer as the xdesign user with the server's environment
// (src/config.ts). Each command is a module of src/commands/ with one row in the table below.
import type { Command } from './commands/command.ts'
import { initOwner } from './commands/init-owner.ts'
import { listUsers } from './commands/list-users.ts'
import { migrate } from './commands/migrate.ts'
import { reset2fa } from './commands/reset-2fa.ts'
import { resetPassword } from './commands/reset-password.ts'

const commands = new Map<string, Command>([
  ['migrate', migrate],
  ['init-owner', initOwner],
  ['reset-password', resetPassword],
  ['reset-2fa', reset2fa],
  ['list-users', listUsers],
])

function usage(): string {
  const rows = [...commands].map(([name, command]) => {
    const call = command.usage ? `${name} ${command.usage}` : name
    return `  ${call.padEnd(28)} ${command.summary}`
  })
  return ['Usage: node cli.mjs <command> [arguments]', '', 'Commands:', ...rows].join('\n')
}

const [name, ...args] = process.argv.slice(2)
const command = name === undefined ? undefined : commands.get(name)

if (command) {
  try {
    process.exitCode = await command.run(args)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
} else if (name === undefined || name === 'help' || name === '--help') {
  console.log(usage())
} else {
  console.error(`Unknown command: ${name}\n\n${usage()}`)
  process.exitCode = 2
}
