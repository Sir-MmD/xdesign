package platform

import (
	"errors"
	"io/fs"
	"os"
	"syscall"

	"golang.org/x/sys/windows"
)

// ErrHardLink is OpenHeld's error for a file that has other names (hard links): one may
// name a file the caller must never read.
var ErrHardLink = errors.New("the file has other names (hard links)")

// OpenHeld opens the file or the folder at path for reading as the maintenance service
// opens what NT SERVICE\xdesign may change (docs/plan/18-third-owner-list-2026-11-23.md
// section 8.6), in place of Linux's O_NOFOLLOW and openat: a link in its place (a reparse
// point, a symbolic link or a junction) is opened itself and refused with ELOOP, a file
// with other names with ErrHardLink, and it is opened without delete sharing, so nobody
// can rename, move or delete it while it is open: its path keeps naming what was checked,
// and so do the paths of what is inside a held folder. Closing the file ends the hold.
func OpenHeld(path string) (*os.File, error) {
	h, err := openHeld(path)
	if err != nil {
		return nil, err
	}
	return os.NewFile(uintptr(h), path), nil
}

// HoldFolder holds the folder at path as OpenHeld does until this process ends: its handle
// is never closed (an *os.File would close it once it is no longer used).
func HoldFolder(path string) error {
	h, err := openHeld(path)
	if err != nil {
		return err
	}
	var info windows.ByHandleFileInformation
	if err := windows.GetFileInformationByHandle(h, &info); err != nil || info.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY == 0 {
		_ = windows.CloseHandle(h) // only checked
		return &fs.PathError{Op: "open", Path: path, Err: syscall.ENOTDIR}
	}
	return nil
}

// openHeld is OpenHeld's open and checks, with the handle the caller closes.
func openHeld(path string) (windows.Handle, error) {
	p, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return 0, &fs.PathError{Op: "open", Path: path, Err: err}
	}
	h, err := windows.CreateFile(p, windows.GENERIC_READ, windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE, nil, windows.OPEN_EXISTING,
		windows.FILE_FLAG_BACKUP_SEMANTICS|windows.FILE_FLAG_OPEN_REPARSE_POINT, 0)
	if err != nil {
		return 0, &fs.PathError{Op: "open", Path: path, Err: err}
	}
	var info windows.ByHandleFileInformation
	err = windows.GetFileInformationByHandle(h, &info)
	switch {
	case err != nil:
		err = &fs.PathError{Op: "GetFileInformationByHandle", Path: path, Err: err}
	case info.FileAttributes&windows.FILE_ATTRIBUTE_REPARSE_POINT != 0:
		err = &fs.PathError{Op: "open", Path: path, Err: syscall.ELOOP}
	case info.FileAttributes&windows.FILE_ATTRIBUTE_DIRECTORY == 0 && info.NumberOfLinks > 1:
		err = &fs.PathError{Op: "open", Path: path, Err: ErrHardLink}
	}
	if err != nil {
		_ = windows.CloseHandle(h) // only checked, nothing read
		return 0, err
	}
	return h, nil
}
