package app

import (
	"context"
	"io"
	"os"

	"github.com/Sir-MmD/xdesign/helper/internal/cli"
)

// cmdInstall is `sudo ./xdesign --install` (docs/plan/07-server-install-update.md
// section 3): the installer of internal/install, which reads its answers from the
// standard input.
func cmdInstall(ctx context.Context, args []string, stdout, stderr io.Writer) int {
	return cli.RunInstall(ctx, cli.OSEnv(os.Stdin, stdout, stderr), args)
}
