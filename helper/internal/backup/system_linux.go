package backup

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// system is what a backup made here records as its system: nothing on Linux, as every
// backup made before the Windows server.
const system = ""

// restoreCommand restores a backup by hand.
const restoreCommand = "sudo xdesign restore"

// Dir returns the backups' folder, <data_dir>/backups.
func (o Options) Dir() string {
	return filepath.Join(o.DataDir, FolderName)
}

// RestoresConfig reports whether a restore here puts the backup's settings file back: a
// backup made on Linux that holds one. A backup made on Windows keeps this server's
// config.toml, whose data folder is a Windows path there (section 8.5).
func (m Meta) RestoresConfig() bool {
	return m.System == system && m.Has(PartConfig)
}

// dataOwner returns the owner of the data folder when this process is root, so the files
// root writes there stay the service's.
func dataOwner(dataDir string) (*owner, error) {
	if os.Geteuid() != 0 {
		return nil, nil
	}
	fi, err := os.Stat(dataDir)
	if err != nil {
		return nil, fmt.Errorf("the data folder: %w", err)
	}
	uid, gid, ok := platform.FileOwner(fi)
	if !ok {
		return nil, fmt.Errorf("the owner of %s cannot be read", dataDir)
	}
	return &owner{uid: uid, gid: gid}, nil
}

// syncDir syncs a folder, so a rename in it survives a power cut.
func syncDir(dir string) error {
	d, err := os.Open(dir) //nolint:gosec // G304: a folder of the site's data
	if err != nil {
		return fmt.Errorf("sync %s: %w", dir, err)
	}
	defer func() { _ = d.Close() }() // read only
	if err := d.Sync(); err != nil {
		return fmt.Errorf("sync %s: %w", dir, err)
	}
	return nil
}

// localName reports whether a member's name can be a file here: on Linux every name the
// metadata allows can.
func localName(string) bool {
	return true
}
