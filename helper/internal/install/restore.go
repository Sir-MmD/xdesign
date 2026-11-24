package install

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// BackupOptions are the backups of the installed site (internal/backup): its data folder,
// its settings and its certificates.
func BackupOptions(version string) backup.Options {
	return backup.Options{DataDir: dataDir, ConfigPath: configPath, CertsDir: filepath.Join(dataDir, backup.CertsDir), Version: version}
}

// Service is xdesign.service as a restore stops, migrates and starts it (backup.Site):
// `sudo xdesign restore FILE` and the root helper's restore (GO-08). On Windows it is the
// service xdesign, in a terminal opened as Administrator and in the maintenance service
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.5); Stop and Start are in
// restore_linux.go and restore_windows.go.
type Service struct {
	// Sys is the operating system.
	Sys host.System
	// Get asks the website on this server for a URL (Installer.Get); nil leaves the health
	// check out.
	Get func(ctx context.Context, url, host string) (status int, body []byte, err error)
}

func (s Service) run(ctx context.Context, cmd host.Cmd) error {
	res, err := s.Sys.Runner.Run(ctx, cmd)
	if err != nil {
		return fmt.Errorf("%s: %w", cmd, err)
	}
	return res.Err(cmd)
}

// Migrate runs the app's migrations as the xdesign user (`node app/cli.mjs migrate`).
func (s Service) Migrate(ctx context.Context) error {
	return s.run(ctx, appCmd("migrate"))
}

// restorePlan is the backup the owner gave at the installer's restore question.
type restorePlan struct {
	// file is the backup's path, "" when there is none; meta its metadata.
	file string
	meta backup.Meta
	// domain is the domain in the backup's settings file.
	domain string
}

// askRestore asks "Do you have an xDesign backup to restore? [y/N]" on a new installation
// (section 3 step 2), then the backup's path, which is checked at once; the installer puts
// it in place after the files (stepRestore), and the owner questions are skipped.
func (r *run) askRestore() error {
	if r.mode != ModeFresh {
		return nil
	}
	ok, err := r.ask.confirm("Do you have an xDesign backup to restore?", false)
	if err != nil || !ok {
		return err
	}
	for {
		answer, err := r.ask.text("Path to the backup file (a .tar.zst from Maintenance > Backups or xdesign backup):",
			func(s string) string {
				if s == "" {
					return "give the path of the backup file"
				}
				return ""
			})
		if err != nil {
			return err
		}
		file, err := filepath.Abs(answer)
		if err != nil {
			r.out.errorf("%v", err)
			continue
		}
		var cfg bytes.Buffer
		meta, err := backup.Check(file, r.version, &cfg)
		if err != nil {
			r.out.errorf("%s: %v", file, err)
			continue
		}
		r.restore = restorePlan{file: file, meta: meta}
		if c, err := config.Parse(cfg.Bytes(), backup.ConfigName); err == nil {
			r.restore.domain = c.Domain
		}
		r.out.fact("backup", meta.Describe())
		return nil
	}
}

// restoreFacts are the lines of the summary for the backup to restore.
func (r *run) restoreFacts() {
	if r.restore.file == "" {
		return
	}
	r.out.fact("restore", r.restore.file+": the database, the media"+r.restoreCertsText()+", and its owner and accounts")
}

// restoreCerts reports whether the backup's certificates are put back: only for the same
// domain, as a certificate is made for its names.
func (r *run) restoreCerts() bool {
	return r.restore.domain != "" && strings.EqualFold(r.restore.domain, r.cfg.Domain)
}

func (r *run) restoreCertsText() string {
	if r.restoreCerts() {
		return " and the certificates"
	}
	return ""
}

// stepRestore puts the backup of the restore question in place after the files and before
// the migrations, which bring an older backup's database up to date (section 3 step 2,
// section 5.4). The settings stay the installer's: this server's answers.
func (r *run) stepRestore() Step {
	return Step{
		Num: "9", ID: "restore", Title: "Restore the backup",
		Check: func(context.Context, *Env) (string, error) {
			if r.restore.file == "" {
				return "no backup to restore", nil
			}
			return "", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			parts := backup.Parts{Database: true, Media: true, Certs: r.restoreCerts()}
			desc := fmt.Sprintf("put %s in place in %s (the database, the media%s)", r.restore.file, dataDir, r.restoreCertsText())
			return env.Do(desc, func() error {
				return backup.PutBack(ctx, BackupOptions(r.version), r.restore.file, parts)
			})
		},
		Verify: func(context.Context, *Env) error {
			if r.restore.file == "" {
				return nil
			}
			if _, err := r.sys.FS.Stat(filepath.Join(dataDir, backup.DatabaseName)); err != nil {
				return errors.New("the database of the backup is not in place")
			}
			return nil
		},
	}
}
