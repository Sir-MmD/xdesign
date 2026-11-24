package cli

import (
	"context"
	"strings"
)

const installUsage = `Usage: sudo ./xdesign --install [flags]

Installs xDesign on this server from this file alone (docs/plan/07-server-install-update.md
section 3). Where xDesign was installed before, it continues an installation that
stopped, installs with the data an uninstall kept, repairs the same version, stops with
the command that updates an older one (sudo xdesign update FILE) and refuses to replace a
newer one; --yes answers each of these questions with yes. Running it again is always
safe: finished steps are skipped.
` + installFlagsUsage

// installRerun is the command that runs the installer again: this file with --install, or
// the installed xdesign on the PATH.
func installRerun(program string) string {
	if strings.HasPrefix(program, "/opt/xdesign/") {
		return "sudo xdesign --install"
	}
	return "sudo ./xdesign --install"
}

// holdWindow does nothing on Linux: a terminal runs the installer.
func holdWindow(*Env) {}

// RunDoubleClicked reports false on Linux: xdesign started with no arguments shows its
// usage.
func RunDoubleClicked(context.Context, *Env) (code int, ok bool) {
	return 0, false
}
