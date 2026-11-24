package maintreq

import "path/filepath"

// Folder returns the maintenance folder beside the data folder dataDir:
// C:\ProgramData\xDesign\maintenance for C:\ProgramData\xDesign\data
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.2), the folder of the request file
// that the service xdesign-maintenance is given.
func Folder(dataDir string) string {
	return filepath.Join(filepath.Dir(dataDir), FolderName)
}
