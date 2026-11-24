package app

import (
	"context"
	"fmt"
	"io"
	"os"

	"github.com/Sir-MmD/xdesign/helper/internal/cli"
)

// cmdUpdate is `sudo xdesign update FILE [--dry-run]` (docs/plan/07-server-install-update.md
// section 6.1), and the second stage of an update that the first starts in the new file.
func cmdUpdate(ctx context.Context, args []string, stdout, stderr io.Writer) int {
	return cli.RunUpdate(ctx, cli.OSEnv(os.Stdin, stdout, stderr), args)
}

// cmdStatus is `xdesign status` (sections 7 and 8).
func cmdStatus(ctx context.Context, args []string, stdout, stderr io.Writer) int {
	return cli.RunStatus(ctx, cli.OSEnv(os.Stdin, stdout, stderr), args)
}

// cmdLogs is `xdesign logs [-f] [--lines N]` (docs/plan/18-third-owner-list-2026-11-23.md
// section 8.2): the service's log on Windows; on Linux it names journalctl.
func cmdLogs(ctx context.Context, args []string, stdout, stderr io.Writer) int {
	return cli.RunLogs(ctx, cli.OSEnv(os.Stdin, stdout, stderr), args)
}

// cmdUninstall is `sudo xdesign --uninstall` (section 7): "Keep the data" or "Remove
// everything", a backup offered first.
func cmdUninstall(ctx context.Context, args []string, stdout, stderr io.Writer) int {
	return cli.RunUninstall(ctx, cli.OSEnv(os.Stdin, stdout, stderr), args)
}

// cmdRollback is `sudo xdesign rollback [--to <version>] [--restore-db]` (section 6.3).
func cmdRollback(ctx context.Context, args []string, stdout, stderr io.Writer) int {
	return cli.RunRollback(ctx, cli.OSEnv(os.Stdin, stdout, stderr), args)
}

// cmdAdmin is `xdesign admin <command>` (section 7): reset-password <username>, reset-2fa
// <username> (docs/plan/17-second-owner-list-2026-11-23.md section 7) and list-users, the
// app's own commands as the xdesign user; set-port PORT and set-path PATH | --random,
// which move the site as root (docs/plan/16-owner-list-2026-11-23.md section 7); and
// `maintenance --request FILE`, the root helper that xdesign-maintenance.service runs
// (section 6).
func cmdAdmin(ctx context.Context, args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		fmt.Fprintln(stderr, "Usage: xdesign admin reset-password <username> | reset-2fa <username> | list-users | set-port PORT | "+
			"set-path PATH | --random | maintenance --request FILE")
		return exitUsage
	}
	switch args[0] {
	case "maintenance":
		return runMaintenance(ctx, args[1:], stdout, stderr)
	case "reset-password", "reset-2fa", "list-users":
		return cli.RunAppCommand(ctx, cli.OSEnv(os.Stdin, stdout, stderr), args[0], args[1:])
	case "set-port":
		return cli.RunSetPort(ctx, cli.OSEnv(os.Stdin, stdout, stderr), args[1:])
	case "set-path":
		return cli.RunSetPath(ctx, cli.OSEnv(os.Stdin, stdout, stderr), args[1:])
	}
	fmt.Fprintf(stderr, "xdesign admin: unknown command %q\n", args[0])
	return exitUsage
}
