package app

import (
	"context"
	"io"
	"os"

	"github.com/Sir-MmD/xdesign/helper/internal/cli"
)

// runMaintenance is `xdesign admin maintenance --request FILE`: xdesign-maintenance.service
// runs it as root when the path unit sees the request file (docs/plan/07-server-install-
// update.md section 6), with its output in the journal.
func runMaintenance(ctx context.Context, args []string, stdout, stderr io.Writer) int {
	return cli.RunMaintenance(ctx, cli.OSEnv(os.Stdin, stdout, stderr), args)
}
