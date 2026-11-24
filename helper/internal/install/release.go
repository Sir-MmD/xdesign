package install

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// An xDesign release is the single xdesign file (docs/plan/07-server-install-update.md
// section 2): its version and CPU are stamped into it (internal/buildinfo), and it carries
// Node.js and the app as its payload, which `xdesign release-files` writes into a release
// folder. xWriter's release folders with VERSION and MANIFEST.sha256 have no counterpart,
// so the installer compares the xdesign file of a folder with the running one
// (files.go).

// fileSHA256 returns the SHA-256 of the file name in hex.
func fileSHA256(fsys host.FS, name string) (string, error) {
	f, err := fsys.Open(name)
	if err != nil {
		return "", err
	}
	defer func() { _ = f.Close() }() // read-only: closing cannot lose data
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", fmt.Errorf("read %s: %w", name, err)
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
