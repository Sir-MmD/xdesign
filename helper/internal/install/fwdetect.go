package install

import "context"

// Firewall tools the installer opens ports in (docs/plan/07-server-install-update.md
// section 3 step 5, docs/plan/18-third-owner-list-2026-11-23.md section 8.3 step 5).
// Copied from xWriter's fwdetect.go and cut to ufw and firewalld: xDesign does not read
// nftables rulesets. Windows has Windows Defender Firewall. DetectFirewall is in
// firewall_linux.go and firewall_windows.go.
const (
	ToolFirewalld = "firewalld"
	ToolUFW       = "ufw"
	ToolWindows   = "windows-firewall"
)

// Firewall is the active firewall of the server. The installer never turns on a
// firewall that is off; it only adds rules to an active one.
type Firewall struct {
	// Tool is ToolFirewalld, ToolUFW, ToolWindows, or "" when none is active.
	Tool string
	// Profiles are the profiles of Windows Defender Firewall that are on ("Domain",
	// "Private", "Public").
	Profiles []string
}

// describe returns the firewall fact of `:: Checking this server...`.
func (f Firewall) describe() string {
	switch f.Tool {
	case ToolFirewalld:
		return "firewalld is active"
	case ToolUFW:
		return "ufw is active"
	case ToolWindows:
		profiles := "profile"
		if len(f.Profiles) > 1 {
			profiles += "s"
		}
		return "Windows Defender Firewall is on for the " + joinAnd(f.Profiles) + " " + profiles
	default:
		return noFirewallWords
	}
}

// name is the firewall in the messages: "ufw", "firewalld" or "Windows Firewall".
func (f Firewall) name() string {
	if f.Tool == ToolWindows {
		return "Windows Firewall"
	}
	return f.Tool
}

// detectFirewall is preflight's firewall fact; a firewall that cannot be read counts as
// none, with a note.
func (r *run) detectFirewall(ctx context.Context, env *Env) {
	fw, err := DetectFirewall(ctx, env)
	if err != nil {
		env.Notef("the firewall cannot be read (%v); no port is opened in it", err)
	}
	r.firewall = fw
	env.Factf("firewall", "%s", fw.describe())
}
