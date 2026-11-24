package install

import (
	"context"
	"fmt"
	"slices"
	"strconv"
)

// The firewall (docs/plan/07-server-install-update.md section 3 step 5): "Open port <n> in
// the firewall? [Y/n]" for each port the site needs that an active ufw or firewalld does
// not allow ("Open port <n> in Windows Firewall? [Y/n]" on Windows,
// docs/plan/18-third-owner-list-2026-11-23.md section 8.3 step 5), and the step that opens
// them after the health check. Copied from xWriter's firewall.go and fwcommand.go and cut
// to ufw and firewalld; xWriter's `admin firewall` command and its nftables instructions
// are not copied. Each system's tools (DetectFirewall, Allowed, Open and Close) are in
// firewall_linux.go and firewall_windows.go.

// portsText names ports for the owner: "TCP port 8443", "TCP ports 443 and 80".
func portsText(ports []int) string {
	words := make([]string, len(ports))
	for i, p := range ports {
		words[i] = strconv.Itoa(p)
	}
	if len(words) == 1 {
		return "TCP port " + words[0]
	}
	return "TCP ports " + joinAnd(words)
}

// recordPort adds port to the ports xDesign opened with tool.
func (st *State) recordPort(tool string, port int) {
	st.Firewall.Tool = tool
	if !slices.Contains(st.Firewall.Ports, port) {
		st.Firewall.Ports = append(st.Firewall.Ports, port)
		slices.Sort(st.Firewall.Ports)
	}
}

// sitePorts are the TCP ports the site needs from outside: its port, and port 80 when
// xDesign answers Let's Encrypt on it.
func (r *run) sitePorts() []int {
	n, _ := strconv.Atoi(listenPort(r.cfg.Listen))
	if r.state.HTTPS.Port80 && n != httpPort {
		return []int{n, httpPort}
	}
	return []int{n}
}

// askFirewall asks "Open port <n> in the firewall? [Y/n]" (firewallQuestion) for each port
// of the site that the active firewall does not allow; without questions (--yes, dry runs)
// every one is opened.
func (r *run) askFirewall(ctx context.Context, ask bool) error {
	r.openPorts = nil
	if r.firewall.Tool == "" {
		return nil
	}
	for _, port := range r.sitePorts() {
		allowed, err := r.firewall.Allowed(ctx, r.env, port)
		if err != nil {
			return err
		}
		if allowed {
			continue
		}
		ok := true
		if ask {
			if ok, err = r.ask.confirm(fmt.Sprintf(firewallQuestion, port), true); err != nil {
				return err
			}
		}
		if ok {
			r.openPorts = append(r.openPorts, port)
		}
	}
	return nil
}

// stepFirewall is step 15 (Linux; step 11 on Windows): open the ports the owner allowed in
// ufw, firewalld or Windows Firewall. It runs after the health check, so nothing faces the
// internet before the site is healthy. A repair leaves the firewall alone.
func (r *run) stepFirewall() Step {
	return Step{
		Num: "15", ID: "firewall", Title: firewallTitle,
		Check: func(ctx context.Context, env *Env) (string, error) {
			switch {
			case r.mode == ModeRepair:
				return "a repair leaves the firewall alone", nil
			case r.firewall.Tool == "":
				return "no active firewall", nil
			case len(r.openPorts) == 0:
				return "no port to open", nil
			}
			for _, port := range r.openPorts {
				allowed, err := r.firewall.Allowed(ctx, env, port)
				if err != nil || !allowed {
					return "", err
				}
			}
			return "the ports are allowed in " + r.firewall.name(), nil
		},
		Act: func(ctx context.Context, env *Env) error {
			for _, port := range r.openPorts {
				allowed, err := r.firewall.Allowed(ctx, env, port)
				if err != nil {
					return err
				}
				if allowed {
					continue
				}
				if err := r.firewall.Open(ctx, env, port); err != nil {
					return err
				}
				if env.DryRun {
					continue
				}
				env.Factf("firewall", "TCP port %d opened in %s", port, r.firewall.name())
				r.state.recordPort(r.firewall.Tool, port)
				if err := r.saveState(env); err != nil {
					return err
				}
			}
			return nil
		},
	}
}
