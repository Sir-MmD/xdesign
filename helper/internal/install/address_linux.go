package install

import (
	"context"
	"errors"
	"fmt"
	"path"
	"slices"
	"strconv"

	"github.com/Sir-MmD/xdesign/helper/deploy"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// The Linux parts of set-port and set-path (address.go) and of the domain change
// (domain.go): config.toml as root:xdesign 0640, xdesign.service's capability for a port
// below 1024, the rule to add by hand in ufw, firewalld or nftables, the SELinux label of
// the new port, and the maintenance helper's unit. address_windows.go has the same names
// for Windows.

// maintenanceWords names the maintenance helper in the refusal while it runs.
const maintenanceWords = maintenanceService

// writeConfig writes config.toml, root:xdesign 0640; what says what it holds, for the log.
func writeConfig(env *Env, sys host.System, data []byte, what string) error {
	gid, err := sys.Users.LookupGroup(serviceUser)
	if err != nil {
		return fmt.Errorf("the group %s: %w", serviceUser, err)
	}
	return env.Do(fmt.Sprintf("write %s (root:xdesign 0640): %s", configPath, what), func() error {
		return sys.FS.WriteFile(configPath, data, 0o640, host.Owner{UID: 0, GID: gid})
	})
}

// maintenanceBusy reports whether xdesign-maintenance.service is active (or starting or
// stopping): it carries out a request of the website.
func maintenanceBusy(ctx context.Context, env *Env) (bool, error) {
	active, _, err := unitActive(ctx, env, maintenanceService)
	return active, err
}

// planUnit finds whether xdesign.service changes: a port below 1024 needs
// CAP_NET_BIND_SERVICE (needsLowPort), so a move across 1024 rewrites the unit.
func (r *addressRun) planUnit() error {
	port80 := r.site.state.HTTPS.Port80
	low := needsLowPort(r.cfg, port80)
	if low == needsLowPort(r.site.cfg, port80) {
		return nil
	}
	data, err := deploy.Unit(serviceUnit)
	if err != nil {
		return err
	}
	file := path.Join(unitDir, serviceUnit)
	if r.oldUnit, err = r.u.Sys.FS.ReadFile(file); err != nil {
		return fmt.Errorf("read %s: %w", file, err)
	}
	r.unit = renderUnit(data, low)
	return nil
}

// firewallRule is the command that allows TCP port in tool, or in nftables without one.
func firewallRule(tool string, port int) string {
	switch tool {
	case ToolUFW:
		return "ufw allow " + portSpec(port)
	case ToolFirewalld:
		return "firewall-cmd --permanent --add-port=" + portSpec(port) + " && firewall-cmd --reload"
	}
	return fmt.Sprintf("nft add rule inet filter input tcp dport %d accept", port)
}

// noFirewallNote is the note of set-port when no firewall xDesign opens ports in is
// active, with the rule to add in nftables.
func noFirewallNote(port int) string {
	return fmt.Sprintf("no active ufw or firewalld was found: if another firewall guards this server (nftables, or your "+
		"provider's), allow TCP port %d in it, for example: %s", port, firewallRule("", port))
}

// moveFirewall is the firewall whose rules set-port changes: the active one.
func moveFirewall(fw Firewall, _ StateFirewall, _ int) Firewall {
	return fw
}

// planSELinux finds whether the new port gets its SELinux label while SELinux is
// enforcing, as the installer's askSELinux does: a missing semanage is a warning with the
// command to run later.
func (r *addressRun) planSELinux(ctx context.Context, env *Env) {
	if selinuxMode(ctx, env) != "enforcing" {
		return
	}
	label, err := portLabel(ctx, env, r.port)
	switch {
	case errors.Is(err, host.ErrCommandNotFound):
		r.warnf(env, "%s, so port %d is not labeled %s; run semanage port -a -t %s -p tcp %d once it is", semanageHint, r.port,
			selinuxPortType, selinuxPortType, r.port)
		return
	case err != nil:
		r.warnf(env, "the SELinux port labels cannot be read (%v)", err)
		return
	case label == selinuxPortType:
		return
	}
	r.labelFrom, r.label = label, true
}

// moveSteps are set-port's steps before the settings: the new port opened in the firewall
// and labeled under SELinux.
func (r *addressRun) moveSteps() []Step {
	return []Step{r.stepOpenPort(), r.stepLabelPort()}
}

// stepLabelPort labels the new port http_port_t when the owner allowed it, and records it
// in install.json as the installer's step does.
func (r *addressRun) stepLabelPort() Step {
	return Step{
		Num: "3", ID: "label-port", Title: "SELinux network",
		Check: func(ctx context.Context, env *Env) (string, error) {
			if !r.label {
				return "nothing to change", nil
			}
			if label, err := portLabel(ctx, env, r.port); err != nil || label != selinuxPortType {
				return "", err
			}
			return "set", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			flag := semanageFlag(r.labelFrom)
			r.labeled = true
			cmd := host.Command("semanage", "port", flag, "-t", selinuxPortType, "-p", "tcp", strconv.Itoa(r.port))
			cmd.Timeout = semanageTimeout
			if _, err := env.runWaiting(ctx, fmt.Sprintf("labeling port %d for SELinux", r.port), cmd); err != nil {
				return err
			}
			list := &r.site.state.SELinux.PortsAdded
			if flag == "-m" {
				list = &r.site.state.SELinux.PortsModified
			}
			if !slices.Contains(*list, r.port) {
				*list = append(*list, r.port)
			}
			return r.saveState(env)
		},
	}
}

// unlabel puts the new port's SELinux type from before back (semanage port -d, or -m back
// to the type it had), unless the port still has it because labeling failed.
func (r *addressRun) unlabel(ctx context.Context, env *Env) {
	if label, err := portLabel(ctx, env, r.port); err == nil && label == r.labelFrom {
		r.site.state.SELinux = r.seBefore
		return
	}
	args := []string{"port", "-d", "-t", selinuxPortType, "-p", "tcp", strconv.Itoa(r.port)}
	if r.labelFrom != "" {
		args = []string{"port", "-m", "-t", r.labelFrom, "-p", "tcp", strconv.Itoa(r.port)}
	}
	cmd := host.Cmd{Name: "semanage", Args: args, Timeout: semanageTimeout}
	if _, err := env.runWaiting(ctx, fmt.Sprintf("putting back the SELinux label of port %d", r.port), cmd); err != nil {
		r.warnf(env, "the SELinux label of port %d could not be put back (%v): run %s", r.port, err, cmd.String())
		return
	}
	r.site.state.SELinux = r.seBefore
}
