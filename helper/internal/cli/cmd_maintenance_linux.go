package cli

import (
	"fmt"
	"os"

	"github.com/Sir-MmD/xdesign/helper/internal/maintreq"
)

const maintenanceUsage = `Usage: xdesign admin maintenance --request FILE

Carries out an update, a rollback, a restore or an uninstall asked for in Maintenance, a
domain change asked for in Settings > HTTPS (docs/plan/07-server-install-update.md
sections 4, 5 and 6) or an address change asked for in Settings > Site address.
xdesign-maintenance.service runs it as root when the website writes the request file; it
is not meant to be run by hand. An uninstall runs as the transient unit
xdesign-uninstall-<time>.service, and the request is done once it started.

The request file must be <data dir>/maintenance/request.json, a regular file of the
xdesign user of at most 64 KiB, written within the last hour by an xDesign of this
version. It is deleted once read, whatever happens next. The progress goes to
progress.json and the outcome to result.json next to it, where the website reads them.

Flags:
  --request FILE  the request file: /var/lib/xdesign/maintenance/request.json
`

// The words of the root helper that name root and the journal; Windows has its own
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.6).
const (
	// maintenanceRefused follows "xdesign admin maintenance: " when the process may not run
	// it.
	maintenanceRefused = "it runs as root, from xdesign-maintenance.service"
	// maintenanceJournal is where the helper's own lines are, for a result without one of
	// the command's.
	maintenanceJournal = "sudo journalctl -u " + maintreq.ServiceUnit
	// protectedFolder is where an upload or a backup is copied before it is used, for the
	// progress titles.
	protectedFolder = "a folder of root's"
)

// maintenanceAllowed reports whether the process may carry out a request: root.
func maintenanceAllowed(env *Env) bool {
	return env.System.Machine.Euid() == 0
}

// outputFile creates a new temporary file of root's (mode 0600, never an existing file
// or a link: the helper's unit has a /tmp of its own) and unlinks it at once.
func outputFile(what string) (*os.File, error) {
	f, err := os.CreateTemp("", "xdesign-maintenance-"+what+"-*")
	if err != nil {
		return nil, fmt.Errorf("create the %s file of the command: %w", what, err)
	}
	if err := os.Remove(f.Name()); err != nil {
		_ = f.Close() // nothing was written
		return nil, fmt.Errorf("create the %s file of the command: %w", what, err)
	}
	return f, nil
}
