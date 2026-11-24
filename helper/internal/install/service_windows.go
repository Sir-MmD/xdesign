package install

import (
	"context"
	"fmt"

	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// The words of the end and of the failure block that name the service, its log and the
// permissions of install.json (docs/plan/18-third-owner-list-2026-11-23.md section 8.3
// step 8).
const (
	serviceWords   = "the service " + serviceName
	endServiceLine = "   Service:  Get-Service " + serviceName + "     Logs: xdesign logs -f"
	stateFileWords = "the folder's permissions"
)

// stepConfig is C:\ProgramData\xDesign\config.toml with the answers, written once; an
// existing file is checked but never overwritten. It takes the folder's permissions
// (stepDirectories): SYSTEM and Administrators change it, the service's account reads it.
func (r *run) stepConfig() Step {
	return Step{
		ID: "config", Title: "Settings",
		Check: func(context.Context, *Env) (string, error) {
			if !exists(r.sys.FS, configPath) {
				return "", nil
			}
			if _, err := r.readConfig(); err != nil {
				return "", err
			}
			return "present and valid", nil
		},
		Act: func(_ context.Context, env *Env) error {
			data, err := config.Render(*r.cfg)
			if err != nil {
				return err
			}
			if _, err := config.Parse(data, configPath); err != nil {
				return fmt.Errorf("the settings of the answers are not valid: %w", err)
			}
			return env.Do(fmt.Sprintf("write %s (the folder's permissions: the service reads it): domain %s, listen %s",
				configPath, r.cfg.Domain, r.cfg.Listen), func() error {
				return r.sys.FS.WriteFile(configPath, data, 0o640, host.Owner{})
			})
		},
	}
}

// appCmd runs a command of the app, `node.exe app\cli.mjs <args>`, with the data folder
// (section 8.3 step 7), as the Administrator who runs it: Windows has no other user to
// switch to, and what the app makes in the data folder takes the folder's permissions,
// which let the service's account change it.
func appCmd(args ...string) host.Cmd {
	return host.Cmd{
		Name:    currentNode,
		Args:    append([]string{currentCLI}, args...),
		Env:     []string{"XD_DATA_DIR=" + dataDir, "NODE_ENV=production"},
		Timeout: appTimeout,
	}
}

// AppCommand is `node.exe app\cli.mjs <args>` for the admin commands (section 8.7), which
// run as Administrator, as appCmd does.
func AppCommand(_ bool, args ...string) host.Cmd {
	return appCmd(args...)
}
