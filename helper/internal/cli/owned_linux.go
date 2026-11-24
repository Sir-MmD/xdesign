package cli

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"

	"golang.org/x/sys/unix"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// ownedDir is a folder of the xdesign user that the root helper (cmd_maintenance.go)
// opened without following a link (docs/plan/07-server-install-update.md section 6). Every
// file in it is opened once, relative to the folder's descriptor, with O_NOFOLLOW, and
// checked on the open descriptor: a regular file of the user, within its size limit. The
// helper reads only those descriptors, so a link, a FIFO or another file the user puts
// in a checked file's place afterwards is never read, and no path is resolved again.
type ownedDir struct {
	f    *os.File
	path string
	uid  int
}

// openMaintenanceDir opens the maintenance folder at path, a folder of the xdesign user,
// and returns it with that user, who owns the progress and result files the helper writes.
func openMaintenanceDir(env *Env, path string) (*ownedDir, host.Owner, error) {
	uid, gid, err := env.System.Users.LookupUser(serviceUser)
	if err != nil {
		return nil, host.Owner{}, fmt.Errorf("the user %s: %w", serviceUser, err)
	}
	dir, err := openOwnedDir(path, uid)
	if err != nil {
		return nil, host.Owner{}, err
	}
	return dir, host.Owner{UID: uid, GID: gid}, nil
}

// openOwnedDir opens the folder at path, which must be a folder of the user uid, not a
// link.
func openOwnedDir(path string, uid int) (*ownedDir, error) {
	fd, err := unix.Open(path, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, openError(path, linkError(unix.AT_FDCWD, path, err))
	}
	return checkOwnedDir(fd, path, uid)
}

// openDir opens the folder name of d, which must be a folder of d's user, not a link.
func (d *ownedDir) openDir(name string) (*ownedDir, error) {
	p := filepath.Join(d.path, name)
	fd, err := unix.Openat(int(d.f.Fd()), name, unix.O_RDONLY|unix.O_DIRECTORY|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0)
	if err != nil {
		return nil, openError(p, linkError(int(d.f.Fd()), name, err))
	}
	return checkOwnedDir(fd, p, d.uid)
}

// linkError returns ELOOP for a folder that could not be opened because it is a link:
// Linux answers an O_DIRECTORY|O_NOFOLLOW open of a link with ENOTDIR. It looks at the
// entry itself (relative to dirFD), never at what the link points to.
func linkError(dirFD int, name string, err error) error {
	var st unix.Stat_t
	if errors.Is(err, unix.ENOTDIR) && unix.Fstatat(dirFD, name, &st, unix.AT_SYMLINK_NOFOLLOW) == nil &&
		st.Mode&unix.S_IFMT == unix.S_IFLNK {
		return unix.ELOOP
	}
	return err
}

// checkOwnedDir checks the folder open on fd and returns it; it closes fd when the
// folder is refused.
func checkOwnedDir(fd int, path string, uid int) (*ownedDir, error) {
	var st unix.Stat_t
	err := unix.Fstat(fd, &st)
	switch {
	case err != nil:
		err = fmt.Errorf("check %s: %w", path, err)
	case st.Mode&unix.S_IFMT != unix.S_IFDIR:
		err = fmt.Errorf("%s is not a folder", path)
	case int64(st.Uid) != int64(uid):
		err = fmt.Errorf("%s does not belong to the user %s", path, serviceUser)
	}
	if err != nil {
		_ = unix.Close(fd) // only checked, nothing read
		return nil, err
	}
	return &ownedDir{f: os.NewFile(uintptr(fd), path), path: path, uid: uid}, nil
}

// openFile opens the file name of d for reading: a regular file of d's user, not a link,
// of at most limit bytes when limit is positive. A missing file is fs.ErrNotExist.
func (d *ownedDir) openFile(name string, limit int64) (*os.File, error) {
	p := filepath.Join(d.path, name)
	// O_NONBLOCK: a FIFO in the file's place does not block the open (the check below
	// refuses it); O_NOCTTY: a terminal never becomes this process's.
	flags := unix.O_RDONLY | unix.O_NOFOLLOW | unix.O_NONBLOCK | unix.O_NOCTTY | unix.O_CLOEXEC
	fd, err := unix.Openat(int(d.f.Fd()), name, flags, 0)
	if err != nil {
		return nil, openError(p, err)
	}
	var st unix.Stat_t
	err = unix.Fstat(fd, &st)
	switch {
	case err != nil:
		err = fmt.Errorf("check %s: %w", p, err)
	case st.Mode&unix.S_IFMT != unix.S_IFREG:
		err = fmt.Errorf("%s is not a regular file", p)
	case int64(st.Uid) != int64(d.uid):
		err = fmt.Errorf("%s does not belong to the user %s", p, serviceUser)
	case limit > 0 && st.Size > limit:
		err = fmt.Errorf("%s is larger than %d bytes", p, limit)
	default:
		// Reads of a regular file never block; the flag only had to cover the open.
		if err = unix.SetNonblock(fd, false); err != nil {
			err = fmt.Errorf("open %s: %w", p, err)
		}
	}
	if err != nil {
		_ = unix.Close(fd) // only checked, nothing read
		return nil, err
	}
	return os.NewFile(uintptr(fd), p), nil
}

// remove removes the entry name of d: a file, or a link itself, never what it points to.
// A missing entry is no error.
func (d *ownedDir) remove(name string) error {
	if err := unix.Unlinkat(int(d.f.Fd()), name, 0); err != nil && !errors.Is(err, unix.ENOENT) {
		return fmt.Errorf("remove %s: %w", filepath.Join(d.path, name), err)
	}
	return nil
}

// writeFile replaces the file name of d with data, mode 0600 and owned by owner,
// through a new temporary file and a rename, both relative to d's descriptor.
func (d *ownedDir) writeFile(name string, data []byte, owner host.Owner) error {
	p := filepath.Join(d.path, name)
	suffix := make([]byte, 6)
	_, _ = rand.Read(suffix) // crypto/rand never fails since Go 1.24
	tmp := "." + name + ".tmp-" + hex.EncodeToString(suffix)
	dirFD := int(d.f.Fd())
	fd, err := unix.Openat(dirFD, tmp, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0o600)
	if err != nil {
		return fmt.Errorf("write %s: %w", p, err)
	}
	f := os.NewFile(uintptr(fd), filepath.Join(d.path, tmp))
	_, err = f.Write(data)
	if err == nil {
		err = f.Chmod(0o600)
	}
	if err == nil {
		err = f.Chown(owner.UID, owner.GID)
	}
	if err == nil {
		err = f.Sync()
	}
	err = errors.Join(err, f.Close())
	if err == nil {
		err = unix.Renameat(dirFD, tmp, dirFD, name)
	}
	if err != nil {
		_ = unix.Unlinkat(dirFD, tmp, 0) // best effort: the error below is what matters
		return fmt.Errorf("write %s: %w", p, err)
	}
	if err := d.f.Sync(); err != nil {
		return fmt.Errorf("write %s: %w", p, err)
	}
	return nil
}

// Close closes the folder's descriptor.
func (d *ownedDir) Close() error {
	return d.f.Close() //nolint:wrapcheck // closing a folder opened for reading
}

// openError describes a failed open of p for the result of a root helper (a restore or
// a maintenance request), copied from xWriter.
func openError(p string, err error) error {
	switch {
	case errors.Is(err, unix.ELOOP):
		return fmt.Errorf("%s is a link; the root helpers refuse links", p)
	case errors.Is(err, unix.ENOTDIR):
		return fmt.Errorf("%s is not a folder", p)
	case errors.Is(err, unix.ENOENT):
		return fmt.Errorf("%s is missing: %w", p, fs.ErrNotExist)
	}
	return fmt.Errorf("open %s: %w", p, err)
}
