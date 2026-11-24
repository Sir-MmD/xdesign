package cli

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/install"
)

// The usages and words of backup and restore that differ between Linux and Windows are in
// cmd_backup_linux.go and cmd_backup_windows.go.

// RunBackup is `xdesign backup`: one backup now, then the retention (section 5.1).
func RunBackup(ctx context.Context, env *Env, args []string) int {
	fs := flag.NewFlagSet("xdesign backup", flag.ContinueOnError)
	fs.SetOutput(env.Stderr)
	fs.Usage = func() { fmt.Fprint(env.Stderr, backupUsage) }
	daily := fs.Bool("daily", false, "")
	asJSON := fs.Bool("json", false, "")
	configPath := fs.String("config", config.DefaultPath, "")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return ExitOK
		}
		return ExitUsage
	}
	if fs.NArg() > 0 {
		fmt.Fprintf(env.Stderr, "xdesign backup: unexpected argument %q\n", fs.Arg(0))
		return ExitUsage
	}
	if !backupAllowed(env) {
		fmt.Fprintln(env.Stderr, "xdesign backup: "+backupRefused)
		return ExitError
	}
	data, err := env.System.FS.ReadFile(*configPath)
	if err != nil {
		fmt.Fprintf(env.Stderr, "xdesign backup: read the settings: %v\n", err)
		return ExitError
	}
	cfg, err := config.Parse(data, *configPath)
	if err != nil {
		fmt.Fprintf(env.Stderr, "xdesign backup: %v\n", err)
		return ExitError
	}
	kind := backup.KindManual
	if *daily {
		kind = backup.KindDaily
	}
	o := backup.Options{DataDir: cfg.DataDir, ConfigPath: *configPath, CertsDir: filepath.Join(cfg.DataDir, backup.CertsDir),
		Version: env.Build.Version}
	if !*asJSON {
		fmt.Fprintln(env.Stdout, ":: Backing up xDesign...")
	}
	res, err := backup.Make(ctx, o, kind)
	if err != nil && res.Path == "" {
		fmt.Fprintf(env.Stderr, "error: the backup failed: %v\n", err)
		return ExitError
	}
	if *asJSON {
		if err := json.NewEncoder(env.Stdout).Encode(res); err != nil {
			fmt.Fprintf(env.Stderr, "xdesign backup: %v\n", err)
			return ExitError
		}
	} else {
		fmt.Fprintf(env.Stdout, " -> backup   %s (%s)\n", res.Path, backup.FormatBytes(res.Backup.Size))
		for _, name := range res.Deleted {
			fmt.Fprintf(env.Stdout, " -> deleted  %s (the newest %d daily and manual and %d pre-update backups are kept)\n", name,
				backup.KeepDaily, backup.KeepPreUpdate)
		}
	}
	if err != nil {
		fmt.Fprintf(env.Stderr, "warning: the backup was made, but deleting older backups failed: %v\n", err)
	}
	return ExitOK
}

// errMetaRead stops Open after the metadata: the restore question shows it.
var errMetaRead = errors.New("metadata read")

// RunRestore is `sudo xdesign restore FILE` (section 5.4).
func RunRestore(ctx context.Context, env *Env, args []string) int {
	fs := flag.NewFlagSet("xdesign restore", flag.ContinueOnError)
	fs.SetOutput(env.Stderr)
	fs.Usage = func() { fmt.Fprint(env.Stderr, restoreUsage) }
	yes := fs.Bool("yes", false, "")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return ExitOK
		}
		return ExitUsage
	}
	if fs.NArg() != 1 {
		fmt.Fprintln(env.Stderr, "xdesign restore: give the backup file: "+restoreLine)
		return ExitUsage
	}
	if !restoreAllowed(env) {
		fmt.Fprintln(env.Stderr, "xdesign restore: "+restoreRefused)
		return ExitError
	}
	file, err := filepath.Abs(fs.Arg(0))
	if err != nil {
		fmt.Fprintf(env.Stderr, "xdesign restore: %v\n", err)
		return ExitUsage
	}
	version := env.Build.Version
	meta, err := backup.Open(file, backup.Handler{Meta: func(backup.Meta) error { return errMetaRead }})
	if err == nil || errors.Is(err, errMetaRead) {
		err = backup.CheckVersion(meta, version)
	}
	if err != nil {
		fmt.Fprintf(env.Stderr, "error: %s: %v\n", file, err)
		return ExitError
	}
	fmt.Fprintf(env.Stdout, " -> backup   %s\n", meta.Describe())
	replaced := "the database, the media, the settings and the certificates of this site are replaced by the backup's"
	if meta.Has(backup.PartConfig) && !meta.RestoresConfig() {
		// On Windows, and for a backup made on the other system (section 8.5).
		replaced = "the database, the media and the certificates of this site are replaced by the backup's, and this " +
			"server's settings are kept"
	}
	fmt.Fprintln(env.Stdout, " -> restore  "+replaced+"; a backup of the site as it is now is made first")
	if !*yes {
		ok, err := confirm(env, "Restore this backup?", "restore without asking")
		if err != nil {
			fmt.Fprintf(env.Stderr, "xdesign restore: %v\n", err)
			return ExitError
		}
		if !ok {
			fmt.Fprintln(env.Stdout, ":: Nothing was changed.")
			return ExitOK
		}
	}
	res, err := backup.Restore(ctx, backup.RestoreOptions{
		Options:  install.BackupOptions(version),
		Site:     install.Service{Sys: env.System, Get: env.Get},
		Progress: func(line string) { fmt.Fprintf(env.Stdout, ":: %s\n", line) },
	}, file)
	if err != nil {
		fmt.Fprintf(env.Stderr, "error: %v\n", err)
		return ExitError
	}
	fmt.Fprintf(env.Stdout, ":: xDesign was restored from %s.\n", file)
	if res.PreRestore != "" {
		fmt.Fprintf(env.Stdout, " -> before   %s (the site as it was before the restore)\n", res.PreRestore)
	}
	return ExitOK
}

// confirm asks a yes or no question on the terminal; the answer no is the default. withYes
// says what the command's --yes does instead ("restore without asking").
func confirm(env *Env, question, withYes string) (bool, error) {
	in := bufio.NewReader(env.Stdin)
	for {
		fmt.Fprintf(env.Stdout, ":: %s [y/N] ", question)
		line, err := in.ReadString('\n')
		if err != nil && line == "" {
			return false, errors.New("no answer: standard input ended; give --yes to " + withYes)
		}
		switch strings.ToLower(strings.TrimSpace(line)) {
		case "y", "yes":
			return true, nil
		case "", "n", "no":
			return false, nil
		}
		fmt.Fprintln(env.Stdout, "error: please answer y or n")
	}
}
