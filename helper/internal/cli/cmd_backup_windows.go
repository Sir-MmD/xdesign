package cli

import "github.com/Sir-MmD/xdesign/helper/internal/platform"

const backupUsage = `Usage: xdesign backup [--daily] [--json] [--config FILE]

Makes a backup of xDesign now (docs/plan/18-third-owner-list-2026-11-23.md section 8.5): a
copy of the database made with VACUUM INTO, the media, the settings and the certificates in
C:\ProgramData\xDesign\backups\xdesign-<UTC time>.tar.zst. Then the newest 14 daily and
manual backups and the newest 3 pre-update backups are kept, and older ones deleted. Run it
in a terminal opened as Administrator; the xdesign service makes the daily backup itself
every day at 03:30.

Flags:
  --daily          a daily backup instead of a manual one
  --json           print the result as one JSON object
  --config FILE    the settings file (default C:\ProgramData\xDesign\config.toml)
`

const restoreUsage = `Usage: xdesign restore FILE [--yes]

Puts the backup FILE back (docs/plan/18-third-owner-list-2026-11-23.md section 8.5): a
backup of xDesign's own making, made on Windows or on Linux
(C:\ProgramData\xDesign\backups\*.tar.zst, or one downloaded from Maintenance > Backups).
The whole file is checked first, and a backup of a newer xDesign is refused. Then a backup
of the site as it is now is made (pre-update-<version>-<time>), the service stops, the
database, the media and the certificates are replaced (this server's settings,
config.toml, are kept), the database's migrations run, and the service starts and must
answer its health check. When anything after the stop fails, the site is put back as it
was and started again. Run it in a terminal opened as Administrator.

Flags:
  --yes    restore without asking
`

// The words of `xdesign backup` and `xdesign restore` that name Administrator where Linux
// names root and sudo (docs/plan/18-third-owner-list-2026-11-23.md section 8.7).
const (
	// backupRefused and restoreRefused follow "xdesign backup: " and "xdesign restore: "
	// when the process may not run the command.
	backupRefused  = "Run this in a terminal opened as Administrator."
	restoreRefused = "Run this in a terminal opened as Administrator."
	// restoreLine is the command line of a restore.
	restoreLine = "xdesign restore FILE"
)

// backupAllowed reports whether the process may make a backup: elevated, in a terminal
// opened as Administrator (the service makes its daily backup itself).
func backupAllowed(*Env) bool {
	return platform.Elevated()
}

// restoreAllowed reports whether the process may restore a backup: elevated.
func restoreAllowed(*Env) bool {
	return platform.Elevated()
}
