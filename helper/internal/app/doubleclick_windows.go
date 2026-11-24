package app

import (
	"context"
	"io"
	"os"

	"github.com/Sir-MmD/xdesign/helper/internal/cli"
)

// doubleClicked runs the installer when Explorer started xdesign.exe with no arguments (a
// double click, docs/plan/18-third-owner-list-2026-11-23.md section 8.3); ok is false when
// a terminal started it.
func doubleClicked(ctx context.Context, stdout, stderr io.Writer) (code int, ok bool) {
	return cli.RunDoubleClicked(ctx, cli.OSEnv(os.Stdin, stdout, stderr))
}
