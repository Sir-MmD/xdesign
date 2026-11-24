package platform

import (
	"errors"
	"io/fs"
	"os"
	"syscall"
)

// NoFollow is the open flag that refuses a link in the file's place instead of following
// it.
const NoFollow = syscall.O_NOFOLLOW

// stNoExec is ST_NOEXEC, the statfs flag of a file system mounted with noexec.
const stNoExec = 0x8

// DiskSpace describes the file system that holds path (statfs(2)). The error is an
// *fs.PathError with the operation "statfs".
func DiskSpace(path string) (Space, error) {
	var st syscall.Statfs_t
	if err := syscall.Statfs(path, &st); err != nil {
		return Space{}, &fs.PathError{Op: "statfs", Path: path, Err: err}
	}
	return Space{
		Free:   st.Bavail * uint64(st.Bsize), //nolint:gosec // G115: the block size is a small positive number
		NoExec: st.Flags&stNoExec != 0,
	}, nil
}

// TryLock takes the exclusive lock of f without waiting (flock(2)), or returns ErrLocked
// when another open file holds it. Closing f releases it.
func TryLock(f *os.File) error {
	err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
	if errors.Is(err, syscall.EWOULDBLOCK) {
		return ErrLocked
	}
	return err //nolint:wrapcheck // the callers name the lock, as they did around syscall.Flock
}

// RefuseLink does nothing on Linux: the open with NoFollow already refused a link with
// ELOOP. On Windows it refuses the link that NoFollow opened in the file's place.
func RefuseLink(*os.File) error {
	return nil
}

// FileOwner returns the numeric owner and group of the file fi describes (a FileInfo of
// os.Stat, os.Lstat or File.Stat); ok is false when fi has no Unix file information.
func FileOwner(fi fs.FileInfo) (uid, gid int, ok bool) {
	st, ok := fi.Sys().(*syscall.Stat_t)
	if !ok {
		return 0, 0, false
	}
	return int(st.Uid), int(st.Gid), true
}

// SyncAll writes every file system's changed data to disk (sync(2)).
func SyncAll() {
	syscall.Sync()
}
