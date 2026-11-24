package install

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// The words of the firewall step, its question and preflight's fact without a firewall on
// Linux.
const (
	firewallTitle    = "Firewall"
	firewallQuestion = "Open port %d in the firewall?"
	noFirewallWords  = "none active"
)

// ufwComment marks the ufw rules xDesign adds.
const ufwComment = "xDesign"

// DetectFirewall finds the active firewall: firewalld (Fedora), then ufw (Ubuntu and
// Debian).
func DetectFirewall(ctx context.Context, env *Env) (Firewall, error) {
	res, err := env.Query(ctx, host.Command("firewall-cmd", "--state"))
	if err != nil && !errors.Is(err, host.ErrCommandNotFound) {
		return Firewall{}, err
	}
	if err == nil && res.OK() && res.Out() == "running" {
		return Firewall{Tool: ToolFirewalld}, nil
	}
	res, err = env.Query(ctx, host.Command("ufw", "status"))
	if err != nil && !errors.Is(err, host.ErrCommandNotFound) {
		return Firewall{}, err
	}
	if err == nil && res.OK() && strings.Contains(string(res.Stdout), "Status: active") {
		return Firewall{Tool: ToolUFW}, nil
	}
	return Firewall{}, nil
}

// uninstallFirewall is the firewall whose rules the uninstall removes: the active one.
func uninstallFirewall(ctx context.Context, env *Env) (Firewall, error) {
	return DetectFirewall(ctx, env)
}

// Allowed reports whether the firewall lets TCP connections to port in. Without an
// active firewall every port is allowed.
func (f Firewall) Allowed(ctx context.Context, env *Env, port int) (bool, error) {
	switch f.Tool {
	case ToolFirewalld:
		for _, args := range [][]string{{"--permanent", "--query-port=" + portSpec(port)}, {"--query-port=" + portSpec(port)}} {
			res, err := env.Query(ctx, host.Command("firewall-cmd", args...))
			if err != nil {
				return false, err
			}
			if res.Out() != "yes" {
				return false, nil
			}
		}
		return true, nil
	case ToolUFW:
		res, err := env.Query(ctx, host.Command("ufw", "status"))
		if err != nil {
			return false, err
		}
		return ufwAllows(string(res.Stdout), port), nil
	}
	return true, nil
}

// ufwAllows reports whether `ufw status` lists an ALLOW rule for port/tcp (or the port
// for every protocol).
func ufwAllows(status string, port int) bool {
	for line := range strings.SplitSeq(status, "\n") {
		f := strings.Fields(line)
		if len(f) < 2 || (f[0] != portSpec(port) && f[0] != strconv.Itoa(port)) {
			continue
		}
		action := f[1]
		if action == "(v6)" && len(f) > 2 {
			action = f[2]
		}
		if action == "ALLOW" {
			return true
		}
	}
	return false
}

// Open allows TCP port with firewalld or ufw.
func (f Firewall) Open(ctx context.Context, env *Env, port int) error {
	switch f.Tool {
	case ToolFirewalld:
		if _, err := env.Run(ctx, host.Command("firewall-cmd", "--permanent", "--add-port="+portSpec(port))); err != nil {
			return err
		}
		_, err := env.Run(ctx, host.Command("firewall-cmd", "--reload"))
		return err
	case ToolUFW:
		_, err := env.Run(ctx, host.Command("ufw", "allow", portSpec(port), "comment", ufwComment))
		return err
	}
	return nil
}

// Close removes the rule Open added (the uninstaller's).
func (f Firewall) Close(ctx context.Context, env *Env, port int) error {
	switch f.Tool {
	case ToolFirewalld:
		if _, err := env.Run(ctx, host.Command("firewall-cmd", "--permanent", "--remove-port="+portSpec(port))); err != nil {
			return err
		}
		_, err := env.Run(ctx, host.Command("firewall-cmd", "--reload"))
		return err
	case ToolUFW:
		_, err := env.Run(ctx, host.Command("ufw", "delete", "allow", portSpec(port)))
		return err
	}
	return nil
}

// portSpec names TCP port as ufw and firewalld do: "443/tcp".
func portSpec(port int) string {
	return strconv.Itoa(port) + "/tcp"
}
