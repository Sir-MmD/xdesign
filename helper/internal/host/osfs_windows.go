package host

import "os"

// chown does nothing on Windows: a file's owner there is a security identifier, and the
// files of xDesign take the permissions of their folder
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.2), which the installer sets.
func chown(string, Owner) error {
	return nil
}

// chownFile does nothing on Windows, as chown.
func chownFile(*os.File, Owner) error {
	return nil
}

// syncDir does nothing on Windows: a folder cannot be flushed there, and NTFS journals
// the rename itself.
func syncDir(string) error {
	return nil
}
