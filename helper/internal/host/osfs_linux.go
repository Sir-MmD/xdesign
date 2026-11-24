package host

import (
	"fmt"
	"os"
)

// chown sets the owner of the file at name, following symbolic links.
func chown(name string, owner Owner) error {
	return wrap(os.Chown(name, owner.UID, owner.GID))
}

// chownFile sets the owner of the open file f.
func chownFile(f *os.File, owner Owner) error {
	return wrap(f.Chown(owner.UID, owner.GID))
}

// syncDir flushes the folder dir, so a rename in it is durable.
func syncDir(dir string) error {
	d, err := os.Open(dir) //nolint:gosec // G304: see the note on OSFS
	if err != nil {
		return fmt.Errorf("sync %s: %w", dir, err)
	}
	err = d.Sync()
	if cerr := d.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return fmt.Errorf("sync %s: %w", dir, err)
	}
	return nil
}
