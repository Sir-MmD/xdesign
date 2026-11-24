package backup

import (
	"path/filepath"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// system is what a backup made here records as its system (section 8.5).
const system = "windows"

// restoreCommand restores a backup by hand, in a terminal opened as Administrator.
const restoreCommand = "xdesign restore"

// Dir returns the backups' folder beside the data folder: C:\ProgramData\xDesign\backups
// for the data folder C:\ProgramData\xDesign\data (section 8.2).
func (o Options) Dir() string {
	return filepath.Join(filepath.Dir(o.DataDir), FolderName)
}

// RestoresConfig reports false: a restore on Windows keeps this server's config.toml, with
// the permissions the installer gave it, its paths and its port, whatever system made the
// backup (section 8.5).
func (Meta) RestoresConfig() bool {
	return false
}

// dataOwner returns no owner: on Windows the files take the permissions of their folder
// (section 8.2), and nothing is given to the service's account.
func dataOwner(string) (*owner, error) {
	return nil, nil
}

// syncDir flushes the fixed drives (platform.SyncAll), so a rename in the folder survives a
// power cut: Windows cannot flush one folder. Only an Administrator or LocalSystem can; for
// the service's account it does nothing, and NTFS keeps the rename in its journal.
func syncDir(string) error {
	platform.SyncAll()
	return nil
}

// windowsReserved are the characters a Windows file name cannot hold.
const windowsReserved = `<>:"|?*`

// localName reports whether a member's name can be a file here: no device name (CON, NUL,
// COM1...), no colon (which would name a stream of another file), none of the characters
// Windows refuses, and no part ending in a dot or a space (which Windows drops). The
// metadata already allows only clean relative paths under media/ and certs/.
func localName(name string) bool {
	if !filepath.IsLocal(filepath.FromSlash(name)) || strings.ContainsAny(name, windowsReserved) {
		return false
	}
	for _, el := range strings.Split(name, "/") {
		if strings.HasSuffix(el, ".") || strings.HasSuffix(el, " ") || strings.ContainsFunc(el, func(r rune) bool { return r < ' ' }) {
			return false
		}
	}
	return true
}
