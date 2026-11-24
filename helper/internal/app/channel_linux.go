package app

import (
	"fmt"
	"path/filepath"

	"github.com/Sir-MmD/xdesign/helper/internal/control"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// The app's channel on Linux (docs/plan/07-server-install-update.md section 1): the app's
// Unix socket and the control socket; systemd creates /run/xdesign (RuntimeDirectory).
const (
	appSocket   = platform.RunDir + "/app.sock"
	controlPath = control.SocketPath
	// maxSocketPath is the longest Unix socket path Linux accepts (sun_path holds 108 bytes
	// with the terminating zero).
	maxSocketPath = 107
)

// devChannel returns the app's socket and the control socket of `serve --dev`, in the
// repository's .dev/run.
func devChannel(repo string) (appSock, ctlPath string, err error) {
	appSock = filepath.Join(repo, ".dev", "run", "app.sock")
	ctlPath = filepath.Join(repo, ".dev", "run", "control.sock")
	for _, p := range []string{appSock, ctlPath} {
		if len(p) > maxSocketPath {
			return "", "", fmt.Errorf("the socket path %s is longer than %d bytes: run from a shorter folder", p, maxSocketPath)
		}
	}
	return appSock, ctlPath, nil
}
