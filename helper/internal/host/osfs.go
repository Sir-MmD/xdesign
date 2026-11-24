package host

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// OSFS is the real file system.
type OSFS struct{}

// The FS paths come from the installer's own constants and the release folder the
// owner gave; reading and writing them is the purpose of this type, so gosec's file
// inclusion warnings (G304) do not apply.

// Stat implements [FS].
func (OSFS) Stat(name string) (fs.FileInfo, error) {
	fi, err := os.Stat(name)
	return fi, wrap(err)
}

// Lstat implements [FS].
func (OSFS) Lstat(name string) (fs.FileInfo, error) {
	fi, err := os.Lstat(name)
	return fi, wrap(err)
}

// Owner implements [FS].
func (OSFS) Owner(name string) (Owner, error) {
	fi, err := os.Stat(name)
	if err != nil {
		return Owner{}, wrap(err)
	}
	uid, gid, ok := platform.FileOwner(fi)
	if !ok {
		return Owner{}, fmt.Errorf("owner of %s: no Unix file information", name)
	}
	return Owner{UID: uid, GID: gid}, nil
}

// ReadFile implements [FS].
func (OSFS) ReadFile(name string) ([]byte, error) {
	b, err := os.ReadFile(name) //nolint:gosec // G304: see the note on OSFS
	return b, wrap(err)
}

// ReadDir implements [FS].
func (OSFS) ReadDir(name string) ([]fs.DirEntry, error) {
	entries, err := os.ReadDir(name)
	return entries, wrap(err)
}

// Readlink implements [FS].
func (OSFS) Readlink(name string) (string, error) {
	target, err := os.Readlink(name)
	return target, wrap(err)
}

// Open implements [FS].
func (OSFS) Open(name string) (io.ReadCloser, error) {
	f, err := os.Open(name) //nolint:gosec // G304: see the note on OSFS
	return f, wrap(err)
}

// WriteFile implements [FS].
func (OSFS) WriteFile(name string, data []byte, perm fs.FileMode, owner Owner) error {
	dir := filepath.Dir(name)
	suffix := make([]byte, 6)
	if _, err := rand.Read(suffix); err != nil {
		return fmt.Errorf("write %s: %w", name, err)
	}
	tmp := filepath.Join(dir, "."+filepath.Base(name)+".tmp-"+hex.EncodeToString(suffix))
	f, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_EXCL, perm) //nolint:gosec // G304: see the note on OSFS
	if err != nil {
		return fmt.Errorf("write %s: %w", name, err)
	}
	err = writeSynced(f, data, perm, owner)
	if err == nil {
		err = os.Rename(tmp, name)
	}
	if err != nil {
		_ = os.Remove(tmp) // best effort: the error below is what matters
		return fmt.Errorf("write %s: %w", name, err)
	}
	// The rename is durable only once the directory is flushed too.
	return syncDir(dir)
}

// writeSynced writes data to f, sets its mode and owner, flushes it and closes it.
func writeSynced(f *os.File, data []byte, perm fs.FileMode, owner Owner) error {
	_, err := f.Write(data)
	if err == nil {
		// The mode given to OpenFile is reduced by the umask.
		err = f.Chmod(perm)
	}
	if err == nil {
		err = chownFile(f, owner)
	}
	if err == nil {
		err = f.Sync()
	}
	return errors.Join(err, f.Close())
}

// OpenAppend implements [FS].
func (OSFS) OpenAppend(name string, perm fs.FileMode) (io.WriteCloser, error) {
	f, err := os.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_APPEND, perm) //nolint:gosec // G304: see the note on OSFS
	return f, wrap(err)
}

// MkdirAll implements [FS].
func (OSFS) MkdirAll(name string, perm fs.FileMode) error {
	return wrap(os.MkdirAll(name, perm))
}

// Chmod implements [FS].
func (OSFS) Chmod(name string, perm fs.FileMode) error {
	return wrap(os.Chmod(name, perm))
}

// Chown implements [FS].
func (OSFS) Chown(name string, owner Owner) error {
	return chown(name, owner)
}

// Symlink implements [FS].
func (OSFS) Symlink(target, name string) error {
	return wrap(os.Symlink(target, name))
}

// Rename implements [FS].
func (OSFS) Rename(oldname, newname string) error {
	return wrap(os.Rename(oldname, newname))
}

// Remove implements [FS].
func (OSFS) Remove(name string) error {
	return wrap(os.Remove(name))
}

// RemoveAll implements [FS].
func (OSFS) RemoveAll(name string) error {
	return wrap(os.RemoveAll(name))
}

// wrap returns err unchanged: os errors already name the operation and the path
// (*fs.PathError, *os.LinkError), so wrapping them again would only repeat it.
func wrap(err error) error {
	return err
}
