//go:build !linux && !windows

package cli

import (
	"errors"
	"os"
)

// isTerminalFile reports false outside Linux, the only platform xDesign supports
// (docs/plan/07-server-install-update.md section 1); it exists so the code compiles
// elsewhere.
func isTerminalFile(*os.File) bool {
	return false
}

// terminalOutput reports false outside Linux and Windows.
func terminalOutput(*os.File) bool {
	return false
}

// echoOff is not available outside Linux.
func echoOff(*os.File) (func(), error) {
	return nil, errors.New("hiding what is typed needs Linux")
}
