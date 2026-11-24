package platform

import (
	"errors"
	"io/fs"
	"os"
	"syscall"

	"golang.org/x/sys/windows"
)

// NoFollow is the open flag that opens a link (a reparse point: a symbolic link or a
// junction) itself instead of what it points to (FILE_FLAG_OPEN_REPARSE_POINT). Windows has
// no flag that refuses it: [RefuseLink] does, on the opened file.
const NoFollow = windows.O_FILE_FLAG_OPEN_REPARSE_POINT

// DiskSpace describes the file system that holds the folder path (GetDiskFreeSpaceEx).
// The error is an *fs.PathError.
func DiskSpace(path string) (Space, error) {
	p, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return Space{}, &fs.PathError{Op: "GetDiskFreeSpaceEx", Path: path, Err: err}
	}
	var free uint64
	if err := windows.GetDiskFreeSpaceEx(p, &free, nil, nil); err != nil {
		return Space{}, &fs.PathError{Op: "GetDiskFreeSpaceEx", Path: path, Err: err}
	}
	return Space{Free: free}, nil
}

// TryLock takes the exclusive lock of f's first byte without waiting (LockFileEx), or
// returns ErrLocked when another open file holds it. Closing f releases it.
func TryLock(f *os.File) error {
	var ol windows.Overlapped
	err := windows.LockFileEx(windows.Handle(f.Fd()), windows.LOCKFILE_EXCLUSIVE_LOCK|windows.LOCKFILE_FAIL_IMMEDIATELY, 0, 1, 0, &ol)
	if errors.Is(err, windows.ERROR_LOCK_VIOLATION) {
		return ErrLocked
	}
	if err != nil {
		return &fs.PathError{Op: "LockFileEx", Path: f.Name(), Err: err}
	}
	return nil
}

// RefuseLink returns an *fs.PathError with ELOOP, as Linux's open with O_NOFOLLOW does,
// when f, opened with NoFollow, is a reparse point: a symbolic link or a junction in the
// file's place (or another reparse point, which xDesign's files never are).
func RefuseLink(f *os.File) error {
	var info windows.ByHandleFileInformation
	if err := windows.GetFileInformationByHandle(windows.Handle(f.Fd()), &info); err != nil {
		return &fs.PathError{Op: "GetFileInformationByHandle", Path: f.Name(), Err: err}
	}
	if info.FileAttributes&windows.FILE_ATTRIBUTE_REPARSE_POINT != 0 {
		return &fs.PathError{Op: "open", Path: f.Name(), Err: syscall.ELOOP}
	}
	return nil
}

// FileOwner reports ok false: a Windows file's owner is a security identifier, and the
// files take the permissions of their folder (section 8.2).
func FileOwner(fs.FileInfo) (uid, gid int, ok bool) {
	return 0, 0, false
}

// SyncAll writes the changed data and metadata of every fixed drive to disk, as sync(2)
// does on Linux: FlushFileBuffers on each volume (\\.\C:). Opening a volume needs an
// Administrator or LocalSystem; for anyone else, and for a drive that cannot be opened, it
// does nothing.
func SyncAll() {
	drives, err := windows.GetLogicalDrives()
	if err != nil {
		return
	}
	for i, letter := range "ABCDEFGHIJKLMNOPQRSTUVWXYZ" {
		if drives&(1<<i) == 0 {
			continue
		}
		root, err := windows.UTF16PtrFromString(string(letter) + `:\`)
		if err != nil || windows.GetDriveType(root) != windows.DRIVE_FIXED {
			continue
		}
		flushVolume(`\\.\` + string(letter) + ":")
	}
}

// flushVolume flushes the volume name (\\.\C:), best effort.
func flushVolume(name string) {
	p, err := windows.UTF16PtrFromString(name)
	if err != nil {
		return
	}
	h, err := windows.CreateFile(p, windows.GENERIC_READ|windows.GENERIC_WRITE, windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE, nil,
		windows.OPEN_EXISTING, 0, 0)
	if err != nil {
		return
	}
	_ = windows.FlushFileBuffers(h) // best effort, as sync(2), which reports nothing
	_ = windows.CloseHandle(h)      // only flushed
}
