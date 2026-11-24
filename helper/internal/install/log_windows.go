package install

import (
	"errors"
	"io/fs"
	"path/filepath"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// logSecurity is the security descriptor of the install log: only SYSTEM and
// Administrators, as root:root 0600 on Linux.
const logSecurity = "O:BAD:P(A;;FA;;;SY)(A;;FA;;;BA)"

// prepareLog makes the log's folder, C:\ProgramData\xDesign\logs, which Windows does not
// have: C:\ProgramData\xDesign with its permissions first (makeConfigDir), so nothing is
// written there before they are set. Without Administrator nothing can be.
func prepareLog(fsys host.FS, path string) error {
	if !platform.Elevated() {
		return errors.New("run this in a terminal opened as Administrator")
	}
	inside := strings.HasPrefix(strings.ToLower(path), strings.ToLower(etcDir)+`\`)
	if _, err := fsys.Stat(etcDir); inside && errors.Is(err, fs.ErrNotExist) {
		if err := makeConfigDir(fsys); err != nil {
			return err
		}
	}
	return fsys.MkdirAll(filepath.Dir(path), 0o755)
}

// protectLog gives the log its permissions (logSecurity).
func protectLog(_ host.FS, path string) error {
	return platform.SetSecurity(path, logSecurity)
}
