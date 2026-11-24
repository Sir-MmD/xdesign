package cli

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"path/filepath"

	"github.com/Sir-MmD/xdesign/helper/internal/install"
)

// RunUninstall is `sudo xdesign --uninstall` (`xdesign --uninstall` on Windows): the flags,
// then install.Updater.Uninstall. The usage is in cmd_uninstall_linux.go and
// cmd_uninstall_windows.go. On Windows, started in a window of its own (Windows' list of
// installed apps, or Explorer) without Administrator, it starts itself again through the
// Administrator prompt, and that window waits for Enter at its end
// (docs/plan/19-uninstall-2026-11-24.md section 3).
func RunUninstall(ctx context.Context, env *Env, args []string) int {
	var o install.UninstallOptions
	var noColor bool
	fs := flag.NewFlagSet("xdesign --uninstall", flag.ContinueOnError)
	fs.SetOutput(env.Stderr)
	fs.Usage = func() { fmt.Fprint(env.Stderr, uninstallUsage) }
	fs.BoolVar(&o.KeepData, "keep-data", false, "")
	fs.BoolVar(&o.RemoveAll, "remove-everything", false, "")
	fs.BoolVar(&o.Backup, "backup", false, "")
	fs.BoolVar(&o.NoBackup, "no-backup", false, "")
	uninstallSystemFlags(fs, &o)
	fs.BoolVar(&o.Yes, "yes", false, "")
	fs.BoolVar(&o.JSON, "json", false, "")
	fs.BoolVar(&o.DryRun, "dry-run", false, "")
	fs.BoolVar(&noColor, "no-color", false, "")
	fs.StringVar(&o.LogPath, "log", "", "")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return ExitOK
		}
		return ExitUsage
	}
	if fs.NArg() > 0 {
		fmt.Fprintf(env.Stderr, "xdesign --uninstall: unexpected argument %q\n", fs.Arg(0))
		return ExitUsage
	}
	if o.LogPath != "" && !filepath.IsAbs(o.LogPath) {
		abs, err := filepath.Abs(o.LogPath)
		if err != nil {
			fmt.Fprintf(env.Stderr, "xdesign --uninstall: %v\n", err)
			return ExitUsage
		}
		o.LogPath = abs
	}
	if code, ok := uninstallAsAdministrator(env, args); ok {
		return code
	}
	code := updater(env, noColor).Uninstall(ctx, o)
	holdWindow(env)
	return code
}
