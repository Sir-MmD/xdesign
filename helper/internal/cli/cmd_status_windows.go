package cli

import (
	"context"
	"errors"
	"net/http"

	"golang.org/x/sys/windows"

	"github.com/Sir-MmD/xdesign/helper/internal/controlclient"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

const statusUsage = `Usage: xdesign status [--json] [--config FILE]

Shows how xDesign runs on this server (docs/plan/18-third-owner-list-2026-11-23.md section
8.7): the version, the port, the address, the health of the front and the app, the
uptime, the sizes of the database and the media, the free disk, the last backups, and the
HTTPS method with the certificate's expiry. It asks the running service over its control
channel, and its website for /api/health under the web base path of the address; while
the service does not run it shows what the files say. Run it in a terminal opened as
Administrator.

Flags:
  --json           print everything as one JSON object
  --config FILE    the settings file (default C:\ProgramData\xDesign\config.toml)
`

// The words of `xdesign status` that name Administrator, the service and its log where
// Linux names root, systemd and journalctl (docs/plan/18-third-owner-list-2026-11-23.md
// section 8.7).
const (
	// statusRefused follows "xdesign status: " when the process may not run it.
	statusRefused = "Run this in a terminal opened as Administrator."
	// serviceName is the service whose state the status shows; serviceWhy says where to
	// read why it does not run.
	serviceName = "the service xdesign"
	serviceWhy  = "xdesign logs says why"
	// backupHint says how to make the first backup.
	backupHint = "xdesign backup makes one"
)

// windowsService is the name of the site's service (section 8.2).
const windowsService = "xdesign"

// statusAllowed reports whether the process may run `xdesign status`: elevated, in a
// terminal opened as Administrator.
func statusAllowed(*Env) bool {
	return platform.Elevated()
}

// serviceState is what the service manager says of the service xdesign: running, stopped,
// starting, stopping, resuming, pausing, paused, or "not installed"; "unknown" when it
// cannot be asked.
func serviceState(context.Context, *Env) string {
	m, err := windows.OpenSCManager(nil, nil, windows.SC_MANAGER_CONNECT)
	if err != nil {
		return "unknown"
	}
	defer func() { _ = windows.CloseServiceHandle(m) }() // only asked
	name, err := windows.UTF16PtrFromString(windowsService)
	if err != nil {
		return "unknown"
	}
	s, err := windows.OpenService(m, name, windows.SERVICE_QUERY_STATUS)
	if errors.Is(err, windows.ERROR_SERVICE_DOES_NOT_EXIST) {
		return "not installed"
	}
	if err != nil {
		return "unknown"
	}
	defer func() { _ = windows.CloseServiceHandle(s) }() // only asked
	var st windows.SERVICE_STATUS
	if err := windows.QueryServiceStatus(s, &st); err != nil {
		return "unknown"
	}
	switch st.CurrentState {
	case windows.SERVICE_RUNNING:
		return "running"
	case windows.SERVICE_STOPPED:
		return "stopped"
	case windows.SERVICE_START_PENDING:
		return "starting"
	case windows.SERVICE_STOP_PENDING:
		return "stopping"
	case windows.SERVICE_CONTINUE_PENDING:
		return "resuming"
	case windows.SERVICE_PAUSE_PENDING:
		return "pausing"
	case windows.SERVICE_PAUSED:
		return "paused"
	}
	return "unknown"
}

// controlClient is the control channel's client and the URL its requests start with: on
// Windows the control server listens on a loopback port and takes a secret (section 8.2),
// both in the control file serve writes, C:\ProgramData\xDesign\control.json. While the
// service does not run the file is missing, and the status shows what the files say.
func controlClient() (*http.Client, string, error) {
	client, err := controlclient.New(platform.ControlFile)
	if err != nil {
		return nil, "", err
	}
	return client, "http://xdesign", nil
}
