package app

import (
	"context"
	"io"
	"log/slog"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
)

// nodeFile is the Node.js runtime in a release's runtime folder.
const nodeFile = "node"

// runServe runs serve in a terminal or under systemd: its lines and the app's output go to
// stderr, the journal under systemd (docs/plan/07-server-install-update.md section 1).
func runServe(ctx context.Context, stderr io.Writer, run serveFunc) int {
	return serveExit(stderr, run(ctx, serveOutput{log: stderr, app: stderr, listening: func() {}}))
}

// dailyBackups does nothing on Linux: xdesign-backup.timer runs `xdesign backup --daily`
// at 03:30 (section 5.1).
func dailyBackups(context.Context, backup.Options, *slog.Logger) {}
