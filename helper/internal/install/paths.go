package install

import (
	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// Paths and names on the server (docs/plan/07-server-install-update.md sections 1 and 3).
const (
	optDir      = platform.ProgramDir
	releasesDir = platform.ReleasesDir
	currentLink = platform.CurrentDir
	// binLink puts xdesign on the PATH: sudo xdesign update FILE.
	binLink      = "/usr/local/bin/xdesign"
	etcDir       = platform.ConfigDir
	configPath   = config.DefaultPath
	dataDir      = platform.DataDir
	unitDir      = "/etc/systemd/system"
	sysusersPath = "/etc/sysusers.d/xdesign.conf"
	serviceUser  = "xdesign"
	serviceUnit  = "xdesign.service"
)
