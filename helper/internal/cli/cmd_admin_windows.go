package cli

import "github.com/Sir-MmD/xdesign/helper/internal/platform"

// The usage of the admin commands and their refusal on Windows: run in a terminal opened
// as Administrator (docs/plan/18-third-owner-list-2026-11-23.md section 8.7), with the
// names of cmd_admin_linux.go.

const resetUsage = `Usage: xdesign admin reset-password <username>

Gives the person with this username a new password, prints it once and ends their
sessions (the app's own reset-password command). Run it in a terminal opened as
Administrator.
`

const reset2faUsage = `Usage: xdesign admin reset-2fa <username> [--yes]

Turns off two-factor authentication for the person with this username, the site owner
too, when they lost the phone and the recovery codes, and ends their sessions (the app's
own reset-2fa command). They then sign in with the password alone. Run it in a terminal
opened as Administrator.

Flags:
  --yes  ask nothing
`

const listUsersUsage = `Usage: xdesign admin list-users

Lists the site's people: username, name, site owner or member, active or disabled, and
when they were last seen (the app's own list-users command). Run it in a terminal opened
as Administrator.
`

const setPortUsage = `Usage: xdesign admin set-port PORT [--no-firewall] [--json] [--yes]

Moves xDesign to another TCP port (docs/plan/18-third-owner-list-2026-11-23.md section
8.7). Run it in a terminal opened as Administrator. The port must be free, from 1 to 65535
and not 80; on 443 the address has no port. The new port is opened in Windows Firewall
first (the rule "xDesign (TCP PORT)"; the command to add it is shown with --no-firewall),
the setting is saved in C:\ProgramData\xDesign\config.toml, and the service xdesign
restarts with a health check; then the old port's rule is removed if xDesign made it. If
xDesign does not answer on the new port, the old port is put back and nothing is left
half-changed.

Flags:
  --no-firewall  do not touch Windows Firewall (the rule to add is shown)
  --yes          ask nothing
  --json         progress as JSON lines on standard error, one result object on
                 standard output (needs --yes)
`

const setPathUsage = `Usage: xdesign admin set-path PATH | --random [--json] [--yes]

Changes the web base path of xDesign (docs/plan/18-third-owner-list-2026-11-23.md section
8.7): the site answers only under it. Run it in a terminal opened as Administrator. PATH
is like /k3v9x2m1/: 1 to 3 parts of 4 to 64 letters, digits, _ and - between the slashes;
--random makes one of 16 characters. / is allowed but not recommended: then anyone who
finds the port finds the sign-in page. The old address stops working: view-only links and
Claude links you already sent, and Claude Code's connection to xDesign, need the new
address. The setting is saved in C:\ProgramData\xDesign\config.toml and the service
xdesign restarts with a health check; if it does not answer under the new path, the path
from before is put back.

Flags:
  --random  make a new random path
  --yes     ask nothing
  --json    progress as JSON lines on standard error, one result object on standard
            output (needs --yes)
`

// appCommandAllowed reports whether the process may run the app's admin commands:
// elevated, in a terminal opened as Administrator.
func appCommandAllowed(*Env) bool {
	return platform.Elevated()
}

// appCommandRefusal follows "xdesign admin <command>: " when the process may not run it.
func appCommandRefusal(string) string {
	return "Run this in a terminal opened as Administrator."
}
