package guard

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// The words of the guard's log lines that name the maintenance service and the terminal
// opened as Administrator (section 8.6).
const (
	helperWords   = "the maintenance service"
	rollbackWords = "xdesign rollback in a terminal opened as Administrator"
)

// serviceName is the site's service, whose account NT SERVICE\xdesign serve runs as
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.2).
const serviceName = "xdesign"

// modify is the right to read, write and delete the marker, without changing its
// permissions (the folders' "modify" of internal/install).
const modify = "0x1301bf"

// Dir is the folder of the marker beside the data folder: C:\ProgramData\xDesign for
// C:\ProgramData\xDesign\data (section 8.6), where serve may create files.
func Dir(dataDir string) string {
	return filepath.Dir(dataDir)
}

// giveTo lets the service's account change and remove the new marker f, so serve can count
// its starts in it and remove it: C:\ProgramData\xDesign gives that account only read on
// the files others write there. Windows has no numeric owners, so owner is not used.
func giveTo(f *os.File, _ Owner) error {
	if err := platform.SetSecurity(f.Name(), "O:BAD:(A;;"+modify+";;;"+platform.ServiceSID(serviceName)+")"); err != nil {
		return fmt.Errorf("give the update marker to the service: %w", err)
	}
	return nil
}

// syncDir does nothing on Windows: a folder cannot be flushed there, and NTFS journals the
// rename itself.
func syncDir(string) error {
	return nil
}
