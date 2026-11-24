package install

import (
	"context"
	"fmt"
	"strconv"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// The words of the firewall step, its question and preflight's fact without a firewall on
// Windows (docs/plan/18-third-owner-list-2026-11-23.md section 8.3 step 5).
const (
	firewallTitle    = "Windows Firewall"
	firewallQuestion = "Open port %d in Windows Firewall?"
	noFirewallWords  = "Windows Defender Firewall is off"
)

// ruleName is the name of the rule that opens port: "xDesign (TCP 443)".
func ruleName(port int) string {
	return fmt.Sprintf("xDesign (TCP %d)", port)
}

// DetectFirewall finds whether Windows Defender Firewall is on for any profile, from the
// registry (platform.FirewallOn), which reads the same in every language of Windows.
func DetectFirewall(_ context.Context, env *Env) (Firewall, error) {
	on, err := platform.FirewallOn()
	if err != nil {
		return Firewall{}, err
	}
	env.Log().Printf("Windows Defender Firewall: the profiles that are on: %v", on)
	if len(on) == 0 {
		return Firewall{}, nil
	}
	return Firewall{Tool: ToolWindows, Profiles: on}, nil
}

// uninstallFirewall is the firewall whose rules the uninstall removes: Windows Firewall,
// whose rules stay while it is off too.
func uninstallFirewall(context.Context, *Env) (Firewall, error) {
	return Firewall{Tool: ToolWindows}, nil
}

// Allowed reports whether the rule xDesign makes for port is in Windows Firewall: netsh
// answers by its exit status, as its words are translated. Another firewall (none) allows
// every port.
func (f Firewall) Allowed(ctx context.Context, env *Env, port int) (bool, error) {
	if f.Tool != ToolWindows {
		return true, nil
	}
	res, err := env.Query(ctx, host.Command("netsh", "advfirewall", "firewall", "show", "rule", "name="+ruleName(port)))
	if err != nil {
		return false, err
	}
	return res.OK(), nil
}

// Open adds the rule "xDesign (TCP <port>)": inbound, allow, TCP, all profiles.
func (f Firewall) Open(ctx context.Context, env *Env, port int) error {
	if f.Tool != ToolWindows {
		return nil
	}
	_, err := env.Run(ctx, host.Command("netsh", "advfirewall", "firewall", "add", "rule", "name="+ruleName(port), "dir=in",
		"action=allow", "protocol=TCP", "localport="+strconv.Itoa(port), "profile=any"))
	return err
}

// Close removes the rule Open added (the uninstaller's).
func (f Firewall) Close(ctx context.Context, env *Env, port int) error {
	if f.Tool != ToolWindows {
		return nil
	}
	_, err := env.Run(ctx, host.Command("netsh", "advfirewall", "firewall", "delete", "rule", "name="+ruleName(port), "dir=in",
		"protocol=TCP", "localport="+strconv.Itoa(port)))
	return err
}
