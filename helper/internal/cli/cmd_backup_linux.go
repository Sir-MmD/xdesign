package cli

const backupUsage = `Usage: xdesign backup [--daily] [--json] [--config FILE]

Makes a backup of xDesign now (docs/plan/07-server-install-update.md section 5): a copy of
the database made with VACUUM INTO, the media, the settings and the certificates in
/var/lib/xdesign/backups/xdesign-<UTC time>.tar.zst. Then the newest 14 daily and manual
backups and the newest 3 pre-update backups are kept, and older ones deleted. Run it as
root (sudo xdesign backup) or as the xdesign user; xdesign-backup.timer runs it with
--daily every day at 03:30.

Flags:
  --daily          a daily backup (the timer's) instead of a manual one
  --json           print the result as one JSON object
  --config FILE    the settings file (default /etc/xdesign/config.toml)
`

const restoreUsage = `Usage: sudo xdesign restore FILE [--yes]

Puts the backup FILE back (docs/plan/07-server-install-update.md section 5.4): a backup of
xDesign's own making (/var/lib/xdesign/backups/*.tar.zst, or one downloaded from
Maintenance > Backups). The whole file is checked first, and a backup of a newer xDesign is
refused. Then a backup of the site as it is now is made (pre-update-<version>-<time>), the
service stops, the database, the media, the settings and the certificates are replaced,
the database's migrations run, and the service starts and must answer its health check.
When anything after the stop fails, the site is put back as it was and started again.

Flags:
  --yes    restore without asking
`

// The words of `xdesign backup` and `xdesign restore` that name root and sudo; Windows has
// its own (docs/plan/18-third-owner-list-2026-11-23.md section 8.7).
const (
	// backupRefused and restoreRefused follow "xdesign backup: " and "xdesign restore: "
	// when the process may not run the command.
	backupRefused  = "run it as root (sudo xdesign backup) or as the xdesign user"
	restoreRefused = "run it as root: sudo xdesign restore FILE"
	// restoreLine is the command line of a restore.
	restoreLine = "sudo xdesign restore FILE"
)

// backupAllowed reports whether the process may make a backup: root or the xdesign user.
func backupAllowed(env *Env) bool {
	return rootOrServiceUser(env)
}

// restoreAllowed reports whether the process may restore a backup: root.
func restoreAllowed(env *Env) bool {
	return env.System.Machine.Euid() == 0
}

// serviceUser is the system user the site runs as.
const serviceUser = "xdesign"

// rootOrServiceUser reports whether the process runs as root or as the xdesign user.
func rootOrServiceUser(env *Env) bool {
	euid := env.System.Machine.Euid()
	if euid == 0 {
		return true
	}
	uid, _, err := env.System.Users.LookupUser(serviceUser)
	return err == nil && uid == euid
}
