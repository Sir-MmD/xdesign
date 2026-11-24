// Package cli holds the commands of the xdesign file that work on the server as root:
// `xdesign --install`, `xdesign --uninstall`, `xdesign backup`, `xdesign status` and
// `xdesign admin reset-password|reset-2fa|list-users` (these three also as the xdesign user),
// `xdesign restore FILE`, `xdesign update FILE`, `xdesign rollback`, `xdesign admin
// set-port|set-path` and the root helper `xdesign admin maintenance --request`
// (docs/plan/07-server-install-update.md sections 3, 5, 6 and 7), and `xdesign logs`, the
// Windows service's log (docs/plan/18-third-owner-list-2026-11-23.md section 8.2). Copied
// from xWriter's internal/cli entry files and cut to these.
package cli

import (
	"context"
	"io"
	"net/netip"

	"github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// Exit statuses of the commands.
const (
	ExitOK    = 0
	ExitError = 1
	ExitUsage = 2
)

// Env is what the commands work with. OSEnv fills it with the real operating system.
type Env struct {
	Stdin  io.Reader
	Stdout io.Writer
	Stderr io.Writer
	// Terminal reports whether Stdout is a terminal.
	Terminal bool
	// System is the operating system: commands, files, users, machine facts.
	System host.System
	// Rand is the source of generated values (crypto/rand in production).
	Rand io.Reader
	// Build is the build information of this file.
	Build buildinfo.Info
	// Executable returns the path of the running file (os.Executable).
	Executable func() (string, error)
	// Getenv reads the environment: NO_COLOR and FORCE_COLOR.
	Getenv func(string) string
	// LookupIP returns the addresses of a host name in the DNS.
	LookupIP func(ctx context.Context, host string) ([]netip.Addr, error)
	// Get asks the website on this server for a URL (the installer's health check).
	Get func(ctx context.Context, url, host string) (status int, body []byte, err error)
	// Upgrade asks the website on this server for a WebSocket upgrade and returns the
	// status of its answer (the update's health check of the live server).
	Upgrade func(ctx context.Context, url, host, origin string) (status int, err error)
}
