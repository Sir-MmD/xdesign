package cli

import (
	"context"
	"net"
	"net/http"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/control"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

const statusUsage = `Usage: xdesign status [--json] [--config FILE]

Shows how xDesign runs on this server (docs/plan/07-server-install-update.md sections 7 and
8): the version, the port, the address, the health of the front and the app, the
uptime, the sizes of the database and the media, the free disk, the last backups, and the
HTTPS method with the certificate's expiry. It asks the running service over its control
socket, and its website for /api/health under the web base path of the address; while the
service does not run it shows what the files say. Run it as root (sudo xdesign status) or
as the xdesign user.

Flags:
  --json           print everything as one JSON object
  --config FILE    the settings file (default /etc/xdesign/config.toml)
`

// The words of `xdesign status` that name root, sudo, systemd and journalctl; Windows has
// its own (docs/plan/18-third-owner-list-2026-11-23.md section 8.7).
const (
	// statusRefused follows "xdesign status: " when the process may not run it.
	statusRefused = "run it as root (sudo xdesign status) or as the xdesign user"
	// serviceName is the service whose state the status shows; serviceWhy says where to
	// read why it does not run.
	serviceName = "xdesign.service"
	serviceWhy  = "journalctl -u xdesign -n 50 --no-pager says why"
	// backupHint says how to make the first backup.
	backupHint = "sudo xdesign backup makes one"
)

// statusAllowed reports whether the process may run `xdesign status`: root or the xdesign
// user.
func statusAllowed(env *Env) bool {
	return rootOrServiceUser(env)
}

// serviceState is what systemctl says of xdesign.service: active, inactive, failed...
func serviceState(ctx context.Context, env *Env) string {
	res, err := env.System.Runner.Run(ctx, host.Command("systemctl", "is-active", "xdesign.service"))
	if err != nil {
		return "unknown"
	}
	if s := strings.TrimSpace(string(res.Stdout)); s != "" {
		return s
	}
	return "unknown"
}

// controlClient is the control channel's client: the HTTP client of the control socket
// (control.SocketPath) and the URL its requests start with.
func controlClient() (*http.Client, string, error) {
	return &http.Client{Transport: &http.Transport{DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
		var d net.Dialer
		return d.DialContext(ctx, "unix", control.SocketPath)
	}}}, "http://xdesign", nil
}
