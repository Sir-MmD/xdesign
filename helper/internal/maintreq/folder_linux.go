package maintreq

import "path/filepath"

// Folder returns the maintenance folder of the data folder dataDir:
// /var/lib/xdesign/maintenance on a server.
func Folder(dataDir string) string {
	return filepath.Join(dataDir, FolderName)
}
