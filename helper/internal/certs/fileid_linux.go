package certs

import (
	"io/fs"
	"syscall"
)

// fileID returns the inode and the device of the file fi describes; zeros when fi has no
// Unix file information.
func fileID(fi fs.FileInfo) (inode, device uint64) {
	if sys, ok := fi.Sys().(*syscall.Stat_t); ok {
		return sys.Ino, sys.Dev
	}
	return 0, 0
}
