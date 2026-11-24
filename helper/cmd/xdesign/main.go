// Command xdesign is the Go helper of xDesign: the single self-installing file that
// installs, updates, backs up and fronts the website (docs/plan/07-server-install-update.md).
package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	_ "time/tzdata" // embedded IANA time zone data, independent of the server

	"github.com/Sir-MmD/xdesign/helper/internal/app"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	code := app.Run(ctx, os.Args[1:], os.Stdout, os.Stderr)
	stop()
	os.Exit(code)
}
