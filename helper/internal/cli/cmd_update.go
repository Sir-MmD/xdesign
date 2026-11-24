package cli

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/install"
)

// RunUpdate is `sudo xdesign update FILE`: the flags, then install.Updater. The second
// stage, which the first starts in the new file, comes here too with --stage 2.
func RunUpdate(ctx context.Context, env *Env, args []string) int {
	var o install.UpdateOptions
	fs := flag.NewFlagSet("xdesign update", flag.ContinueOnError)
	fs.SetOutput(env.Stderr)
	fs.Usage = func() { fmt.Fprint(env.Stderr, updateUsage) }
	fs.BoolVar(&o.DryRun, "dry-run", false, "")
	fs.StringVar(&o.SHA256, "sha256", "", "")
	fs.BoolVar(&o.Yes, "yes", false, "")
	fs.BoolVar(&o.JSON, "json", false, "")
	fs.BoolVar(&o.NoColor, "no-color", false, "")
	fs.StringVar(&o.LogPath, "log", "", "")
	// The hand-over between the stages (not in the help).
	fs.IntVar(&o.Stage, "stage", 0, "")
	fs.StringVar(&o.From, "from", "", "")
	fs.StringVar(&o.Checksum, "checksum", "", "")
	fs.StringVar(&o.Signature, "signature", "", "")
	file, rest, code, ok := parseWithFile(fs, args)
	if !ok {
		return code
	}
	if len(rest) > 0 {
		fmt.Fprintf(env.Stderr, "xdesign update: unexpected argument %q\n", rest[0])
		return ExitUsage
	}
	o.File, o.SHA256 = file, strings.ToLower(o.SHA256)
	if o.LogPath != "" && !filepath.IsAbs(o.LogPath) {
		abs, err := filepath.Abs(o.LogPath)
		if err != nil {
			fmt.Fprintf(env.Stderr, "xdesign update: %v\n", err)
			return ExitUsage
		}
		o.LogPath = abs
	}
	if o.Stage == 2 {
		o.StageSteps = env.Getenv(install.EnvUpdateSteps)
	}
	return updater(env, o.NoColor).Run(ctx, o)
}

// parseWithFile parses fs where the file may come before or after the flags: it returns
// the file (made absolute) and what is left.
func parseWithFile(fs *flag.FlagSet, args []string) (file string, rest []string, code int, ok bool) {
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return "", nil, ExitOK, false
		}
		return "", nil, ExitUsage, false
	}
	rest = fs.Args()
	if len(rest) > 0 && !strings.HasPrefix(rest[0], "-") {
		file, rest = rest[0], rest[1:]
		if err := fs.Parse(rest); err != nil {
			if errors.Is(err, flag.ErrHelp) {
				return "", nil, ExitOK, false
			}
			return "", nil, ExitUsage, false
		}
		rest = fs.Args()
	}
	if file != "" && !filepath.IsAbs(file) && !strings.Contains(file, "://") {
		if abs, err := filepath.Abs(file); err == nil {
			file = abs
		}
	}
	return file, rest, ExitOK, true
}

// updater is the Updater of env: the update, the rollback and the root helper share it.
func updater(env *Env, noColor bool) *install.Updater {
	return &install.Updater{
		Sys: env.System, Build: env.Build, Rand: env.Rand, Stdin: env.Stdin, Stdout: env.Stdout, Stderr: env.Stderr,
		Terminal: env.Terminal, Color: install.UseColor(env.Terminal, noColor, env.Getenv), Get: env.Get, Upgrade: env.Upgrade,
	}
}

// RunRollback is `sudo xdesign rollback`: the flags, then install.Updater.Rollback.
func RunRollback(ctx context.Context, env *Env, args []string) int {
	var o install.RollbackOptions
	var noColor bool
	fs := flag.NewFlagSet("xdesign rollback", flag.ContinueOnError)
	fs.SetOutput(env.Stderr)
	fs.Usage = func() { fmt.Fprint(env.Stderr, rollbackUsage) }
	fs.StringVar(&o.To, "to", "", "")
	fs.BoolVar(&o.RestoreDB, "restore-db", false, "")
	fs.BoolVar(&o.Yes, "yes", false, "")
	fs.BoolVar(&o.JSON, "json", false, "")
	fs.BoolVar(&noColor, "no-color", false, "")
	fs.StringVar(&o.LogPath, "log", "", "")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return ExitOK
		}
		return ExitUsage
	}
	if fs.NArg() > 0 {
		fmt.Fprintf(env.Stderr, "xdesign rollback: unexpected argument %q\n", fs.Arg(0))
		return ExitUsage
	}
	return updater(env, noColor).Rollback(ctx, o)
}
