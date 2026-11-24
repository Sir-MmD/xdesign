// One of the app's own commands (src/cli.ts): `node app/cli.mjs <name> [arguments]`.
export interface Command {
  // One line for the list of commands.
  summary: string
  // The arguments after the name, for the usage line ("<username>").
  usage?: string
  // Prints plain text and returns the exit status.
  run: (args: string[]) => number | Promise<number>
}
