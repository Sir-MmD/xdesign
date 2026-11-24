package cli

// The usage of the admin commands and their refusal on Linux: run as root with sudo, or as
// the xdesign user (cmd_admin.go); cmd_admin_windows.go has the Windows forms.

const resetUsage = `Usage: sudo xdesign admin reset-password <username>

Gives the person with this username a new password, prints it once and ends their
sessions (the app's own reset-password command). Run it as root or as the xdesign user.
`

const reset2faUsage = `Usage: sudo xdesign admin reset-2fa <username> [--yes]

Turns off two-factor authentication for the person with this username, the site owner
too, when they lost the phone and the recovery codes, and ends their sessions (the app's
own reset-2fa command). They then sign in with the password alone. Run it as root or as
the xdesign user.

Flags:
  --yes  ask nothing
`

const listUsersUsage = `Usage: sudo xdesign admin list-users

Lists the site's people: username, name, site owner or member, active or disabled, and
when they were last seen (the app's own list-users command). Run it as root or as the
xdesign user.
`

const setPortUsage = `Usage: sudo xdesign admin set-port PORT [--no-firewall] [--json] [--yes]

Moves xDesign to another TCP port (docs/plan/07-server-install-update.md section 7). The
port must be free, from 1 to 65535 and not 80; on 443 the address has no port. The new
port is opened in the firewall first (ufw or firewalld; the rule to add is shown for
another firewall) and labeled under SELinux while it is enforcing, the setting is saved in
/etc/xdesign/config.toml, and xDesign restarts with a health check; then the old port is
closed if xDesign opened it. If xDesign does not answer on the new port, the old port is
put back and nothing is left half-changed.

Flags:
  --no-firewall  do not touch the firewall (the rule to add is shown)
  --yes          ask nothing
  --json         progress as JSON lines on standard error, one result object on
                 standard output (needs --yes)
`

const setPathUsage = `Usage: sudo xdesign admin set-path PATH | --random [--json] [--yes]

Changes the web base path of xDesign (docs/plan/07-server-install-update.md section 7):
the site answers only under it. PATH is like /k3v9x2m1/: 1 to 3 parts of 4 to 64
letters, digits, _ and - between the slashes; --random makes one of 16 characters.
/ is allowed but not recommended: then anyone who finds the port finds the sign-in page.
The old address stops working: view-only links and Claude links you already sent, and
Claude Code's connection to xDesign, need the new address. The setting is saved in
/etc/xdesign/config.toml and xDesign restarts with a health check; if it does not answer
under the new path, the path from before is put back.

Flags:
  --random  make a new random path
  --yes     ask nothing
  --json    progress as JSON lines on standard error, one result object on standard
            output (needs --yes)
`

// appCommandAllowed reports whether the process may run the app's admin commands: root or
// the xdesign user.
func appCommandAllowed(env *Env) bool {
	return rootOrServiceUser(env)
}

// appCommandRefusal follows "xdesign admin <command>: " when the process may not run it.
func appCommandRefusal(command string) string {
	return "run it as root (sudo xdesign admin " + command + ") or as the xdesign user"
}
