package certs

import "io/fs"

// fileID returns zeros on Windows, whose FileInfo has no file index: the size and the
// modification time tell a changed certificate file there.
func fileID(fs.FileInfo) (inode, device uint64) {
	return 0, 0
}
