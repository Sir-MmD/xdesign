package install

import (
	"context"
	"fmt"
	"slices"

	"golang.org/x/sys/windows/svc"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// The Windows parts of set-port and set-path (address.go) and of the domain change
// (domain.go), with the names of address_linux.go
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.6): config.toml with the folder's
// permissions, no unit to change, the rule of Windows Firewall, no SELinux, and the
// maintenance service.

// maintenanceWords names the maintenance helper in the refusal while it runs.
const maintenanceWords = "the service " + maintenanceServiceName

// writeConfig writes config.toml, which takes the folder's permissions (SYSTEM and
// Administrators change it, the service's account reads it), as the installer writes it;
// what says what it holds, for the log.
func writeConfig(env *Env, sys host.System, data []byte, what string) error {
	return env.Do(fmt.Sprintf("write %s (the folder's permissions: the service reads it): %s", configPath, what), func() error {
		return sys.FS.WriteFile(configPath, data, 0o640, host.Owner{})
	})
}

// maintenanceBusy reports whether the service xdesign-maintenance runs (or starts or
// stops): it carries out a request of the website.
func maintenanceBusy(context.Context, *Env) (bool, error) {
	state, _, err := serviceState(maintenanceServiceName)
	if err != nil {
		return false, err
	}
	return state != svc.Stopped, nil
}

// planUnit changes nothing on Windows: the service's account may listen on any port, below
// 1024 too, so the service stays as it is.
func (r *addressRun) planUnit() error {
	return nil
}

// firewallRule is the command that adds the rule Open adds for port in Windows Firewall.
func firewallRule(_ string, port int) string {
	return fmt.Sprintf("netsh advfirewall firewall add rule name=%q dir=in action=allow protocol=TCP localport=%d profile=any",
		ruleName(port), port)
}

// noFirewallNote is the note of set-port when Windows Defender Firewall is off.
func noFirewallNote(port int) string {
	return fmt.Sprintf("Windows Defender Firewall is off: if another firewall guards this server (your provider's), allow TCP port "+
		"%d in it", port)
}

// moveFirewall is the firewall whose rules set-port changes: the active one, or Windows
// Firewall while it is off when install.json records the old port's rule (made). Windows
// keeps the rules of a firewall that is off, so that rule moves to the new port too, and
// the site answers when the firewall is turned on again.
func moveFirewall(fw Firewall, made StateFirewall, oldPort int) Firewall {
	if fw.Tool == "" && made.Tool == ToolWindows && slices.Contains(made.Ports, oldPort) {
		return Firewall{Tool: ToolWindows}
	}
	return fw
}

// planSELinux does nothing: Windows has no SELinux.
func (r *addressRun) planSELinux(context.Context, *Env) {}

// moveSteps are set-port's steps before the settings: the new port's rule in Windows
// Firewall.
func (r *addressRun) moveSteps() []Step {
	return []Step{r.stepOpenPort()}
}

// unlabel does nothing: Windows has no SELinux, so no label was changed.
func (r *addressRun) unlabel(context.Context, *Env) {}
