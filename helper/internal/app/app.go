// Package app is the command line of the xdesign file: it dispatches the subcommands
// (docs/plan/07-server-install-update.md section 7). Copied from xWriter's internal/app
// dispatch and adapted.
package app

import (
	"context"
	"fmt"
	"io"
	"slices"
)

// Exit codes of the xdesign command.
const (
	exitOK    = 0
	exitError = 1
	exitUsage = 2
)

// command is one subcommand of the xdesign file. Each command lives in its own
// cmd_<name>.go file.
type command struct {
	name    string
	summary string
	run     func(ctx context.Context, args []string, stdout, stderr io.Writer) int
}

// commands lists the subcommands in the order `xdesign help` shows them.
func commands() []command {
	return []command{
		{name: "serve", summary: "run the front and the website (the service; --dev on the desktop)", run: cmdServe},
		{name: "update", summary: "update xDesign from the new file or a tar.gz, zip, tar.xz or tar.zst holding it (FILE [--dry-run])", run: cmdUpdate},
		{name: "rollback", summary: "go back to a kept release ([--to <version>] [--restore-db])", run: cmdRollback},
		{name: "backup", summary: "back up the database, the media, the settings and the certificates now ([--daily] [--json])", run: cmdBackup},
		{name: "restore", summary: "put a backup back (FILE [--yes])", run: cmdRestore},
		{name: "status", summary: "version, mode, address, health, disk use, backups and certificate expiry", run: cmdStatus},
		{name: "logs", summary: logsSummary, run: cmdLogs},
		{name: "admin", summary: "administration: reset-password <username>, reset-2fa <username>, list-users, set-port PORT, " +
			"set-path PATH | --random, maintenance --request", run: cmdAdmin},
		{name: "version", summary: "print the version (--json for machine-readable output)", run: cmdVersion},
	}
}

// Run executes the xdesign command line (without the program name) and returns the
// process exit code.
func Run(ctx context.Context, args []string, stdout, stderr io.Writer) int {
	if len(args) == 0 {
		// Double-clicked on Windows: the installer (docs/plan/18-third-owner-list-2026-11-23.md
		// section 8.3).
		if code, ok := doubleClicked(ctx, stdout, stderr); ok {
			return code
		}
		usage(stderr)
		return exitUsage
	}
	if slices.Contains([]string{"help", "-h", "-help", "--help"}, args[0]) {
		usage(stdout)
		return exitOK
	}
	// The top-level switches of docs/plan/07-server-install-update.md section 3:
	// `sudo ./xdesign --install` installs from the single file.
	switch args[0] {
	case installFlag:
		return cmdInstall(ctx, args[1:], stdout, stderr)
	case uninstallFlag:
		return cmdUninstall(ctx, args[1:], stdout, stderr)
	case releaseFilesCommand: // not in the help: the install, the update and the release build run it
		return cmdReleaseFiles(ctx, args[1:], stdout, stderr)
	}
	for _, c := range commands() {
		if c.name == args[0] {
			return c.run(ctx, args[1:], stdout, stderr)
		}
	}
	fmt.Fprintf(stderr, "xdesign: unknown command %q\n\n", args[0])
	usage(stderr)
	return exitUsage
}

// The top-level switches (docs/plan/07-server-install-update.md section 3).
const (
	installFlag   = "--install"
	uninstallFlag = "--uninstall"
)

func usage(w io.Writer) {
	fmt.Fprint(w, "Usage: xdesign <command> [flags]\n"+installLine+uninstallLine+"\nCommands:\n")
	width := 0
	for _, c := range commands() {
		width = max(width, len(c.name))
	}
	for _, c := range commands() {
		fmt.Fprintf(w, "  %-*s %s\n", width, c.name, c.summary)
	}
	fmt.Fprint(w, "\nRun 'xdesign <command> -h' (or 'xdesign "+installFlag+" -h') for the flags of a command.\n")
}
