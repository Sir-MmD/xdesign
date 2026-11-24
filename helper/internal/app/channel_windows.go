package app

import (
	"path/filepath"

	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// The app's channel on Windows (docs/plan/18-third-owner-list-2026-11-23.md section 8.2):
// no Unix sockets. The front picks the app's port of 127.0.0.1 and its proxy secret at each
// start, and the control server writes its own port and secret to the control file.
const (
	appSocket   = ""
	controlPath = platform.ControlFile
)

// devChannel returns no app socket and the control file of `serve --dev`, in the
// repository's .dev\run.
func devChannel(repo string) (appSock, ctlPath string, err error) {
	return "", filepath.Join(repo, ".dev", "run", "control.json"), nil
}
