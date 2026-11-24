package cli

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"syscall"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/install"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// ownedDir is a folder NT SERVICE\xdesign may change (the maintenance folder, the backups)
// that the maintenance service opened (docs/plan/18-third-owner-list-2026-11-23.md section
// 8.6), in place of owned_linux.go's descriptors: the folder must have the permissions the
// installer gives it, and it and every folder and file in it are opened once with
// platform.OpenHeld: a link (a reparse point) or a file with other names (a hard link) is
// refused, and none can be renamed, moved or deleted while it is open, so the paths below
// a held folder keep naming what was checked. The helper reads only those files.
type ownedDir struct {
	f    *os.File
	path string
}

// openMaintenanceDir opens the maintenance folder at path. Windows has no numeric owners:
// the progress and result files take the folder's permissions, which let serve's account
// read them.
func openMaintenanceDir(_ *Env, path string) (*ownedDir, host.Owner, error) {
	dir, err := openOwnedDir(path, 0)
	return dir, host.Owner{}, err
}

// openOwnedDir opens the folder at path, which must have the permissions the installer
// gives the folders of NT SERVICE\xdesign; uid is not used.
func openOwnedDir(path string, _ int) (*ownedDir, error) {
	d, err := openHeldDir(path)
	if err != nil {
		return nil, err
	}
	if err := install.CheckServiceFolder(path); err != nil {
		_ = d.Close() // only checked, nothing read
		return nil, err
	}
	return d, nil
}

// openDir opens the folder name of d.
func (d *ownedDir) openDir(name string) (*ownedDir, error) {
	return openHeldDir(filepath.Join(d.path, name))
}

// openHeldDir opens the folder at path with platform.OpenHeld and checks that it is a
// folder.
func openHeldDir(path string) (*ownedDir, error) {
	f, err := platform.OpenHeld(path)
	if err != nil {
		return nil, openError(path, err)
	}
	fi, err := f.Stat()
	if err == nil && !fi.IsDir() {
		err = fmt.Errorf("%s is not a folder", path)
	}
	if err != nil {
		_ = f.Close() // only checked, nothing read
		return nil, err
	}
	return &ownedDir{f: f, path: path}, nil
}

// openFile opens the file name of d for reading: a regular file, not a link, with no other
// name, of at most limit bytes when limit is positive. A missing file is fs.ErrNotExist.
func (d *ownedDir) openFile(name string, limit int64) (*os.File, error) {
	p := filepath.Join(d.path, name)
	f, err := platform.OpenHeld(p)
	if err != nil {
		return nil, openError(p, err)
	}
	fi, err := f.Stat()
	switch {
	case err != nil:
		err = fmt.Errorf("check %s: %w", p, err)
	case !fi.Mode().IsRegular():
		err = fmt.Errorf("%s is not a regular file", p)
	case limit > 0 && fi.Size() > limit:
		err = fmt.Errorf("%s is larger than %d bytes", p, limit)
	}
	if err != nil {
		_ = f.Close() // only checked, nothing read
		return nil, err
	}
	return f, nil
}

// remove removes the entry name of d: a file, or a link itself, never what it points to.
// A missing entry is no error.
func (d *ownedDir) remove(name string) error {
	if err := os.Remove(filepath.Join(d.path, name)); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return fmt.Errorf("remove %s: %w", filepath.Join(d.path, name), err)
	}
	return nil
}

// writeFile replaces the file name of d with data through a new file and a rename, which
// replaces whatever is at name (a link too) without writing through it. The file takes the
// folder's permissions, so serve reads it; owner is not used.
func (d *ownedDir) writeFile(name string, data []byte, _ host.Owner) error {
	p := filepath.Join(d.path, name)
	suffix := make([]byte, 6)
	_, _ = rand.Read(suffix) // crypto/rand never fails since Go 1.24
	tmp := filepath.Join(d.path, "."+name+".tmp-"+hex.EncodeToString(suffix))
	f, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600) //nolint:gosec // G304: a new file in the held folder
	if err != nil {
		return fmt.Errorf("write %s: %w", p, err)
	}
	_, err = f.Write(data)
	if err == nil {
		err = f.Sync()
	}
	err = errors.Join(err, f.Close())
	if err == nil {
		err = os.Rename(tmp, p)
	}
	if err != nil {
		_ = os.Remove(tmp) // best effort: the error below is what matters
		return fmt.Errorf("write %s: %w", p, err)
	}
	return nil
}

// Close closes the folder, which ends its hold.
func (d *ownedDir) Close() error {
	return d.f.Close() //nolint:wrapcheck // closing a folder opened for reading
}

// openError describes a failed open of p for the result of the maintenance service.
func openError(p string, err error) error {
	switch {
	case errors.Is(err, syscall.ELOOP):
		return fmt.Errorf("%s is a link; the maintenance service refuses links", p)
	case errors.Is(err, platform.ErrHardLink):
		return fmt.Errorf("%s has other names (hard links); the maintenance service refuses them", p)
	case errors.Is(err, fs.ErrNotExist):
		return fmt.Errorf("%s is missing: %w", p, fs.ErrNotExist)
	}
	return fmt.Errorf("open %s: %w", p, err)
}
