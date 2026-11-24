package cli

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"path/filepath"

	"golang.org/x/sys/windows"

	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

const maintenanceUsage = `Usage: xdesign admin maintenance --request FILE

Carries out an update, a rollback, a restore or an uninstall asked for in Maintenance, a
domain change asked for in Settings > HTTPS (docs/plan/07-server-install-update.md
sections 4, 5 and 6) or an address change asked for in Settings > Site address. The
service xdesign-maintenance runs it as LocalSystem once the website has written the
request file and started it (docs/plan/18-third-owner-list-2026-11-23.md section 8.6);
run by hand, it needs a terminal opened as Administrator. An uninstall runs from a copy of
this file in C:\Windows\Temp\xdesign-uninstall-<time>\, a process of its own, and the
request is done once it started.

The request file must be C:\ProgramData\xDesign\maintenance\request.json, a regular file
of at most 64 KiB, written within the last hour by an xDesign of this version. It is
deleted once read, whatever happens next. The progress goes to progress.json and the
outcome to result.json next to it, where the website reads them; the service writes its
own lines to C:\ProgramData\xDesign\logs\maintenance.log.

Flags:
  --request FILE  the request file: C:\ProgramData\xDesign\maintenance\request.json
`

// The words of the maintenance service (docs/plan/18-third-owner-list-2026-11-23.md
// section 8.6), in place of root and the journal.
const (
	// maintenanceRefused follows "xdesign admin maintenance: " when the process may not run
	// it.
	maintenanceRefused = "it runs as LocalSystem, from the service xdesign-maintenance, or in a terminal opened as Administrator"
	// maintenanceJournal is where the service's own lines are, for a result without one of
	// the command's.
	maintenanceJournal = platform.MaintenanceLog
	// protectedFolder is where an upload or a backup is copied before it is used, for the
	// progress titles: maintenance\run, which only SYSTEM and Administrators open.
	protectedFolder = "a protected folder"
)

// maintenanceAllowed reports whether the process may carry out a request: elevated
// (LocalSystem, or a terminal opened as Administrator).
func maintenanceAllowed(*Env) bool {
	return platform.Elevated()
}

// outputFile creates a new temporary file of this account's (never an existing file or a
// link) that Windows deletes once its last handle closes, in place of Linux's unlinked
// file. It is opened to append only: every write, this process's and those of an update's
// second stage, which inherits it, goes to its end, wherever the follower's reads leave
// the shared position.
func outputFile(what string) (*os.File, error) {
	suffix := make([]byte, 8)
	_, _ = rand.Read(suffix) // crypto/rand never fails since Go 1.24
	name := filepath.Join(os.TempDir(), "xdesign-maintenance-"+what+"-"+hex.EncodeToString(suffix))
	p, err := windows.UTF16PtrFromString(name)
	if err != nil {
		return nil, fmt.Errorf("create the %s file of the command: %w", what, err)
	}
	h, err := windows.CreateFile(p, windows.GENERIC_READ|windows.FILE_APPEND_DATA|windows.DELETE,
		windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE, nil, windows.CREATE_NEW,
		windows.FILE_ATTRIBUTE_TEMPORARY|windows.FILE_FLAG_DELETE_ON_CLOSE, 0)
	if err != nil {
		return nil, fmt.Errorf("create the %s file of the command: %w", what, err)
	}
	return os.NewFile(uintptr(h), name), nil
}
