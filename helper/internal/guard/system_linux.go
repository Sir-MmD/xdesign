package guard

import (
	"fmt"
	"os"
)

// The words of the guard's log lines that name the root helper and sudo.
const (
	helperWords   = "the root helper"
	rollbackWords = "sudo xdesign rollback"
)

// Dir is the folder of the marker: the data folder itself (/var/lib/xdesign), which
// belongs to the xdesign user.
func Dir(dataDir string) string {
	return dataDir
}

// giveTo gives the new marker f to the service user, so serve can count its starts in it.
func giveTo(f *os.File, owner Owner) error {
	return f.Chown(owner.UID, owner.GID) //nolint:wrapcheck // writeMarker wraps it
}

// syncDir flushes a folder, making the renames and removals in it durable.
func syncDir(dir string) error {
	d, err := os.Open(dir) //nolint:gosec // G304: the data folder
	if err != nil {
		return fmt.Errorf("sync %s: %w", dir, err)
	}
	defer func() { _ = d.Close() }() // a folder opened for reading
	if err := d.Sync(); err != nil {
		return fmt.Errorf("sync %s: %w", dir, err)
	}
	return nil
}
