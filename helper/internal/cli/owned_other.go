//go:build !linux && !windows

package cli

import (
	"errors"
	"os"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// errOwnedLinux: the root helper opens the maintenance folder with Linux or Windows calls,
// and xDesign installs on those two only; this file exists so the code compiles
// elsewhere.
var errOwnedLinux = errors.New("the maintenance helper needs Linux or Windows")

// ownedDir is the folder type of owned_linux.go.
type ownedDir struct{}

func openOwnedDir(string, int) (*ownedDir, error) { return nil, errOwnedLinux }

func (*ownedDir) openDir(string) (*ownedDir, error) { return nil, errOwnedLinux }

func (*ownedDir) openFile(string, int64) (*os.File, error) { return nil, errOwnedLinux }

func (*ownedDir) remove(string) error { return errOwnedLinux }

func (*ownedDir) writeFile(string, []byte, host.Owner) error { return errOwnedLinux }

// Close does nothing.
func (*ownedDir) Close() error { return nil }
