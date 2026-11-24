package backup

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// Modes of the restored settings file, root:xdesign 0640 as the installer writes it.
const configMode = 0o640

// spaceMargin is the free space a restore leaves on top of the unpacked backup.
const spaceMargin = 64 << 20

// Site is the site's service, which a restore stops, migrates and starts
// (internal/install's Service: xdesign.service and the app's migrate command).
type Site interface {
	// Stop stops the site and returns once it no longer runs.
	Stop(ctx context.Context) error
	// Migrate runs the app's database migrations as the service user.
	Migrate(ctx context.Context) error
	// Start starts the site and returns once its health check passed.
	Start(ctx context.Context) error
}

// Parts are the parts a restore puts back; the parts a backup does not hold are left as
// they are.
type Parts struct {
	Database, Config, Media, Certs bool
}

// AllParts puts back every part (section 5.4).
func AllParts() Parts {
	return Parts{Database: true, Config: true, Media: true, Certs: true}
}

// RestoreOptions are what Restore works with.
type RestoreOptions struct {
	Options
	// Site is the service the restore stops, migrates and starts.
	Site Site
	// Progress gets a line for each phase ("Checking the backup..."); nil drops them.
	Progress func(line string)
}

// RestoreResult is what Restore did.
type RestoreResult struct {
	// Backup is the restored backup's metadata.
	Backup Meta
	// PreRestore is the archive of the backup made before the restore; "" when the site
	// had no database to back up.
	PreRestore string
}

// Restore puts the backup at file back (section 5.4): it checks the whole file and refuses
// a backup of a newer xDesign, makes a pre-update backup of the site, unpacks the backup
// next to the data, stops the site, swaps in the database (its -wal and -shm files
// removed), the settings (only when [Meta.RestoresConfig]), the media and the
// certificates, runs the app's migrations and starts the site with its health check. When
// a step after the stop fails, it puts the pre-update backup back the same way and starts
// the site again.
func Restore(ctx context.Context, o RestoreOptions, file string) (RestoreResult, error) {
	say := func(line string) {
		if o.Progress != nil {
			o.Progress(line)
		}
	}
	say("Checking the backup...")
	meta, err := checkRestore(file, o.Options)
	if err != nil {
		return RestoreResult{}, err
	}
	res := RestoreResult{Backup: meta}
	dir := o.Dir()
	w, err := ensureDir(o.DataDir, dir)
	if err != nil {
		return res, err
	}
	unlock, err := lock(dir, w)
	if err != nil {
		return res, err
	}
	defer unlock()
	if _, err := os.Stat(filepath.Join(o.DataDir, DatabaseName)); err == nil {
		say("Making a backup of the site first...")
		// No retention here: it could delete the backup being restored.
		pre, err := makeLocked(ctx, o.Options, KindPreUpdate, w, false)
		if err != nil {
			return res, fmt.Errorf("the backup before the restore failed, and nothing was changed: %w", err)
		}
		res.PreRestore = pre.Path
	}
	changed, err := replace(ctx, o, file, AllParts(), w, say)
	switch {
	case err == nil:
		return res, nil
	case !changed:
		return res, fmt.Errorf("the restore failed, and nothing was changed: %w", err)
	case res.PreRestore == "":
		return res, fmt.Errorf("the restore failed: %w", err)
	}
	say("The restore failed: " + err.Error())
	say("Putting the site back as it was before the restore...")
	// The site is down: putting it back runs even when the restore was interrupted.
	if _, perr := replace(context.WithoutCancel(ctx), o, res.PreRestore, AllParts(), w, say); perr != nil {
		return res, fmt.Errorf("the restore failed: %w; putting the site back failed too: %w. The backup made before the "+
			"restore is %s: %s %s", err, perr, res.PreRestore, restoreCommand, res.PreRestore)
	}
	return res, fmt.Errorf("the restore failed, and the site runs as it was before it: %w", err)
}

// PutBack puts the parts of the backup at file in place without a service to stop or
// start: the installer does it after the files are in place, before its migrations and
// its start (section 3 step 2).
func PutBack(ctx context.Context, o Options, file string, parts Parts) error {
	if _, err := checkRestore(file, o); err != nil {
		return err
	}
	dir := o.Dir()
	w, err := ensureDir(o.DataDir, dir)
	if err != nil {
		return err
	}
	unlock, err := lock(dir, w)
	if err != nil {
		return err
	}
	defer unlock()
	_, err = replace(ctx, RestoreOptions{Options: o}, file, parts, w, func(string) {})
	return err
}

// checkRestore reads the whole backup, checks its settings file when the restore puts it
// back, and the free space.
func checkRestore(file string, o Options) (Meta, error) {
	var cfg bytes.Buffer
	meta, err := Check(file, o.Version, &cfg)
	if err != nil {
		return meta, err
	}
	if meta.RestoresConfig() {
		if _, err := config.Parse(cfg.Bytes(), ConfigName); err != nil {
			return meta, fmt.Errorf("the backup's settings are not valid: %w", err)
		}
	}
	if space, err := platform.DiskSpace(o.DataDir); err == nil {
		free := int64(space.Free) //nolint:gosec // G115: the free bytes of a file system fit in an int64
		if need := meta.Size() + spaceMargin; free < need {
			return meta, fmt.Errorf("there is not enough free space in %s: the restore needs about %s, and %s are free",
				o.DataDir, FormatBytes(need), FormatBytes(free))
		}
	}
	return meta, nil
}

// replace unpacks the backup at file into a folder next to the data, stops the site,
// swaps the parts in (the replaced files go to the folder, which is removed at the end),
// runs the migrations and starts the site. Without a Site it only swaps. changed reports
// that the site was stopped or its files touched.
func replace(ctx context.Context, o RestoreOptions, file string, parts Parts, w *owner, say func(string)) (changed bool, err error) {
	stage := filepath.Join(o.DataDir, ".restore-"+o.now().UTC().Format(stemTime))
	_ = os.RemoveAll(stage) // left by a restore that was stopped
	defer func() { _ = os.RemoveAll(stage) }()
	if err := os.Mkdir(stage, dirMode); err != nil {
		return false, fmt.Errorf("unpack the backup: %w", err)
	}
	say("Unpacking the backup...")
	staged, old := filepath.Join(stage, "new"), filepath.Join(stage, "old")
	meta, err := extract(file, staged, o.Version, w)
	if err != nil {
		return false, err
	}
	if err := os.Mkdir(old, dirMode); err != nil {
		return false, fmt.Errorf("unpack the backup: %w", err)
	}
	if o.Site != nil {
		say("Stopping xDesign...")
		if err := o.Site.Stop(ctx); err != nil {
			return true, err
		}
	}
	say("Putting the backup in place...")
	if err := swap(o.Options, meta, parts, staged, old, w); err != nil {
		return true, err
	}
	if o.Site == nil {
		return true, nil
	}
	say("Running the database migrations...")
	if err := o.Site.Migrate(ctx); err != nil {
		return true, err
	}
	say("Starting xDesign...")
	return true, o.Site.Start(ctx)
}

// swap moves the current parts into old and the staged ones into their places.
func swap(o Options, meta Meta, parts Parts, staged, old string, w *owner) error {
	if parts.Database && meta.Has(PartDatabase) {
		db := filepath.Join(o.DataDir, DatabaseName)
		for _, p := range []string{db + "-wal", db + "-shm", db} {
			if err := moveAside(p, filepath.Join(old, filepath.Base(p))); err != nil {
				return err
			}
		}
		if err := move(filepath.Join(staged, DatabaseName), db); err != nil {
			return err
		}
	}
	if parts.Config && meta.RestoresConfig() && o.ConfigPath != "" {
		if err := putConfig(filepath.Join(staged, ConfigName), o.ConfigPath, w); err != nil {
			return err
		}
	}
	trees := []struct {
		on        bool
		name, dir string
	}{{parts.Media, MediaDir, filepath.Join(o.DataDir, MediaDir)}, {parts.Certs, CertsDir, o.CertsDir}}
	for _, t := range trees {
		if !t.on || t.dir == "" {
			continue
		}
		if err := moveAside(t.dir, filepath.Join(old, t.name)); err != nil {
			return err
		}
		src := filepath.Join(staged, t.name)
		if _, err := os.Lstat(src); errors.Is(err, fs.ErrNotExist) {
			continue // the backup's folder was empty
		}
		if err := move(src, t.dir); err != nil {
			return err
		}
	}
	return syncDir(o.DataDir)
}

// moveAside moves p to dst when it exists.
func moveAside(p, dst string) error {
	if _, err := os.Lstat(p); errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	return move(p, dst)
}

func move(src, dst string) error {
	if err := os.Rename(src, dst); err != nil {
		return fmt.Errorf("put the backup in place: %w", err)
	}
	return nil
}

// putConfig writes the backup's settings file as path, root:xdesign 0640, through a
// temporary file in its folder.
func putConfig(src, path string, w *owner) error {
	data, err := os.ReadFile(src) //nolint:gosec // G304: the unpacked backup
	if err != nil {
		return fmt.Errorf("put the settings in place: %w", err)
	}
	tmp := path + ".restore"
	_ = os.Remove(tmp) // left by a restore that was stopped
	if err := writeSynced(tmp, data); err != nil {
		return err
	}
	if err := os.Chmod(tmp, configMode); err != nil {
		return fmt.Errorf("put the settings in place: %w", err)
	}
	if w != nil {
		if err := os.Chown(tmp, 0, w.gid); err != nil {
			return fmt.Errorf("put the settings in place: %w", err)
		}
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("put the settings in place: %w", err)
	}
	return syncDir(filepath.Dir(path))
}
