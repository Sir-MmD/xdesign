package app

import (
	"fmt"
	"os"
)

// releaseSelf is the copy of this file in a release folder on Windows
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.2).
const releaseSelf = "xdesign.exe"

// selfPath returns the running file (os.Executable): Windows keeps the file of a running
// program from being overwritten or removed, so its path still names it.
func selfPath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("find the running file: %w", err)
	}
	return exe, nil
}
