package platform

import "errors"

// ErrLocked is the error of [TryLock] when another open file holds the lock.
var ErrLocked = errors.New("the file is locked")

// Space is what xDesign needs to know about the file system that holds a path.
type Space struct {
	// Free is the space available to unprivileged users, in bytes.
	Free uint64
	// NoExec reports that programs on the file system cannot run (the Linux mount option
	// noexec; never on Windows).
	NoExec bool
}
