package app

import (
	"context"
	"io"
	"os"

	"github.com/Sir-MmD/xdesign/helper/internal/cli"
)

// cmdBackup is `xdesign backup` (docs/plan/07-server-install-update.md section 5): a
// backup now, as root or as the xdesign user; xdesign-backup.timer runs it with --daily.
func cmdBackup(ctx context.Context, args []string, stdout, stderr io.Writer) int {
	return cli.RunBackup(ctx, cli.OSEnv(os.Stdin, stdout, stderr), args)
}

// cmdRestore is `sudo xdesign restore FILE` (section 5.4).
func cmdRestore(ctx context.Context, args []string, stdout, stderr io.Writer) int {
	return cli.RunRestore(ctx, cli.OSEnv(os.Stdin, stdout, stderr), args)
}
