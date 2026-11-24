package install

import "github.com/Sir-MmD/xdesign/helper/internal/host"

// prepareLog does nothing on Linux: the log's folder, /var/log, is the system's.
func prepareLog(host.FS, string) error {
	return nil
}

// protectLog makes the log root:root 0600.
func protectLog(fsys host.FS, path string) error {
	if err := fsys.Chmod(path, 0o600); err != nil {
		return err
	}
	return fsys.Chown(path, host.Root())
}
