package maintenance

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/Sir-MmD/xdesign/helper/internal/maintreq"
)

// programWords names where the releases are, for the free space of an update's checks.
const programWords = "/opt"

// State tells whether the helper can carry out requests. The unit files tell: serve
// cannot ask systemd, but it can read /etc/systemd/system, where xdesign-maintenance.path
// is installed, masked (a link to /dev/null) or enabled (its link in
// multi-user.target.wants).
func (h *helper) State() HelperState {
	if h.dev {
		return HelperState{State: HelperDevelopment, Message: "Works on a server: xdesign serve --dev has no maintenance helper."}
	}
	unit := filepath.Join(maintreq.UnitDir, maintreq.PathUnit)
	if _, err := os.Lstat(unit); err != nil {
		return HelperState{State: HelperMissing, Message: "This installation has no maintenance helper (" + maintreq.PathUnit +
			"). Run the installer again on the server to repair it: sudo xdesign --install"}
	}
	if target, err := os.Readlink(unit); err == nil && target == os.DevNull {
		return HelperState{State: HelperOff, Message: "The maintenance helper is turned off. Turn it on on the server with: " +
			"sudo systemctl unmask " + maintreq.PathUnit + " && sudo systemctl enable --now " + maintreq.PathUnit}
	}
	if _, err := os.Lstat(filepath.Join(maintreq.WantsDir, maintreq.PathUnit)); err != nil {
		return HelperState{State: HelperOff, Message: "The maintenance helper is not turned on. Turn it on on the server with: " +
			"sudo systemctl enable --now " + maintreq.PathUnit}
	}
	return HelperState{State: HelperReady}
}

// start does nothing on Linux: xdesign-maintenance.path starts the helper when the request
// file appears.
func (*helper) start(context.Context) error {
	return nil
}

// syncDir flushes the folder dir, so a rename in it survives a crash.
func syncDir(dir string) error {
	d, err := os.Open(dir) //nolint:gosec // G304: the maintenance folder
	if err != nil {
		return fmt.Errorf("sync %s: %w", dir, err)
	}
	err = d.Sync()
	if cerr := d.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return fmt.Errorf("sync %s: %w", dir, err)
	}
	return nil
}
