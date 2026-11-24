package install

import (
	"context"
	"fmt"
	"io/fs"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/Sir-MmD/xdesign/helper/deploy"
	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// The words of the end and of the failure block that name the service, its log and the
// permissions of install.json (docs/plan/07-server-install-update.md section 3 step 8).
const (
	serviceWords   = serviceUnit
	endServiceLine = "   Service:  systemctl status xdesign     Logs: journalctl -u xdesign -f"
	stateFileWords = "root:root 0644"
)

// xdesignGroup returns the owner root:xdesign.
func (r *run) xdesignGroup() (host.Owner, error) {
	gid, err := r.sys.Users.LookupGroup(serviceUser)
	if err != nil {
		return host.Owner{}, fmt.Errorf("the group %s: %w", serviceUser, err)
	}
	return host.Owner{UID: 0, GID: gid}, nil
}

// stepConfig is step 6: /etc/xdesign/config.toml (root:xdesign 0640) with the answers,
// written once; an existing file is checked but never overwritten.
func (r *run) stepConfig() Step {
	return Step{
		Num: "6", ID: "config", Title: "Settings",
		Check: func(context.Context, *Env) (string, error) {
			owner, err := r.xdesignGroup()
			if err != nil {
				return "", err
			}
			exists, right, err := fileState(r.sys.FS, configPath, 0o640, owner)
			if err != nil || !exists {
				return "", err
			}
			if _, err := r.readConfig(); err != nil {
				return "", err
			}
			if !right {
				return "", nil
			}
			return "present and valid", nil
		},
		Act: func(_ context.Context, env *Env) error {
			owner, err := r.xdesignGroup()
			if err != nil && !env.DryRun {
				return err
			}
			if exists(r.sys.FS, configPath) {
				return fixFile(env, configPath, 0o640, owner, "root:xdesign")
			}
			data, err := config.Render(*r.cfg)
			if err != nil {
				return err
			}
			if _, err := config.Parse(data, configPath); err != nil {
				return fmt.Errorf("the settings of the answers are not valid: %w", err)
			}
			return env.Do(fmt.Sprintf("write %s (root:xdesign 0640): domain %s, listen %s", configPath,
				r.cfg.Domain, r.cfg.Listen), func() error {
				return r.sys.FS.WriteFile(configPath, data, 0o640, owner)
			})
		},
	}
}

// lowPorts reports whether the front opens a port below 1024 (see needsLowPort).
func (r *run) lowPorts() bool { return needsLowPort(r.cfg, r.state.HTTPS.Port80) }

// unitContent is xdesign.service as this site needs it (deploy/systemd/xdesign.service).
func (r *run) unitContent() ([]byte, error) {
	data, err := deploy.Unit(serviceUnit)
	if err != nil {
		return nil, err
	}
	return renderUnit(data, r.lowPorts()), nil
}

// stepUnits is step 7: xdesign.service, and xdesign-backup.service and .timer (section
// 5.1), in /etc/systemd/system and a daemon-reload (section 1).
func (r *run) stepUnits() Step {
	units := func() (map[string][]byte, error) {
		m, err := backupUnits()
		if err != nil {
			return nil, err
		}
		if m[serviceUnit], err = r.unitContent(); err != nil {
			return nil, err
		}
		for _, name := range maintenanceUnitNames() { // the root helper (section 6)
			if m[name], err = deploy.Unit(name); err != nil {
				return nil, err
			}
		}
		return m, nil
	}
	names := append([]string{serviceUnit, backupService, backupTimer}, maintenanceUnitNames()...)
	return Step{
		Num: "7", ID: "units", Title: "systemd units",
		Check: func(context.Context, *Env) (string, error) {
			want, err := units()
			if err != nil {
				return "", err
			}
			for _, name := range names {
				same, err := sameFile(r.sys.FS, path.Join(unitDir, name), want[name])
				if err != nil || !same {
					return "", err
				}
			}
			return "the installed units match", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			want, err := units()
			if err != nil {
				return err
			}
			for _, name := range names {
				if err := installFile(env, "systemd/"+name, path.Join(unitDir, name), want[name]); err != nil {
					return err
				}
			}
			_, err = env.Run(ctx, host.Command("systemctl", "daemon-reload"))
			return err
		},
	}
}

// stepEnable is step 8: start at boot, and the daily backup's timer, enabled and started.
func (r *run) stepEnable() Step {
	return Step{
		Num: "8", ID: "enable", Title: "Enable at boot",
		Check: func(ctx context.Context, env *Env) (string, error) {
			res, err := env.Query(ctx, host.Command("systemctl", "is-enabled", serviceUnit))
			if err != nil || res.Out() != "enabled" {
				return "", err
			}
			r.enabledAtBoot = true
			if res, err = env.Query(ctx, host.Command("systemctl", "is-enabled", backupTimer)); err != nil || res.Out() != "enabled" {
				return "", err
			}
			if active, _, err := unitActive(ctx, env, backupTimer); err != nil || !active {
				return "", err
			}
			if res, err = env.Query(ctx, host.Command("systemctl", "is-enabled", maintenancePath)); err != nil || res.Out() != "enabled" {
				return "", err
			}
			return "xDesign starts at boot, and backs up daily at 03:30", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			if _, err := env.Run(ctx, host.Command("systemctl", "enable", serviceUnit)); err != nil {
				return err
			}
			if _, err := env.Run(ctx, host.Command("systemctl", "enable", "--now", backupTimer)); err != nil {
				return err
			}
			enableMaintenancePath(ctx, env, r.sys.FS) // updates and rollbacks from the website (section 6.2)
			return nil
		},
	}
}

// appCmd runs a command of the app, `node app/cli.mjs <args>`, as the xdesign user with
// the data folder (section 3 step 7), in the release folder as the service runs it.
func appCmd(args ...string) host.Cmd {
	return host.Cmd{
		Name: "runuser",
		Args: append([]string{"-u", serviceUser, "--", "env", "-C", currentLink, "XD_DATA_DIR=" + dataDir, "NODE_ENV=production",
			currentNode, currentCLI}, args...),
		Timeout: appTimeout,
	}
}

// AppCommand is `node app/cli.mjs <args>` for the admin commands (section 7): as root it
// runs as the xdesign user, as appCmd does; the xdesign user runs it itself.
func AppCommand(asRoot bool, args ...string) host.Cmd {
	cmd := appCmd(args...)
	if !asRoot {
		cmd.Name, cmd.Args = cmd.Args[3], cmd.Args[4:] // without "runuser -u xdesign --"
	}
	return cmd
}

// waitReady waits until the service is active and the website answers /api/health, up to
// healthWait (xmtp-panel's waitReady). w is the waiter of the step, which says what it
// waits for.
func (r *run) waitReady(ctx context.Context, env *Env, w *waiter) error {
	url := healthURL(r.cfg)
	if env.DryRun {
		env.Plan(fmt.Sprintf("wait up to %s until %s answers", formatElapsed(healthWait), url))
		return nil
	}
	if r.in.Get == nil {
		env.Warnf("the health check is left out: this build cannot ask the website")
		return nil
	}
	w.say("waiting for the website to answer")
	start := time.Now()
	var last error
	for {
		active, state, err := unitActive(ctx, env, serviceUnit)
		switch {
		case err != nil:
			last = err
		case state == "failed":
			return fmt.Errorf("%s failed to start; its journal says why: journalctl -u xdesign -n 50 --no-pager", serviceUnit)
		case !active:
			last = fmt.Errorf("%s is %s", serviceUnit, state)
		default:
			err := r.healthy(ctx, url)
			if err == nil {
				env.Factf("health", "the website answered after %s", formatElapsed(time.Since(start)))
				return nil
			}
			last = err
		}
		if time.Since(start) >= healthWait {
			return fmt.Errorf("the website did not answer within %s (last: %v); see systemctl status xdesign and "+
				"journalctl -u xdesign -n 50 --no-pager", formatElapsed(healthWait), last)
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("interrupted while waiting for the website to answer; %s keeps running (systemctl status xdesign)",
				serviceUnit)
		case <-time.After(healthPoll):
		}
	}
}

// stepStart is step 14: start the service, or restart it in a repair or when it runs
// already, and wait until the website answers (section 3 step 7).
func (r *run) stepStart() Step {
	return Step{
		Num: "14", ID: "start", Title: "Start and health check",
		Check: func(ctx context.Context, env *Env) (string, error) {
			if r.mode == ModeRepair {
				return "", nil
			}
			active, _, err := unitActive(ctx, env, serviceUnit)
			if err != nil || !active || r.healthy(ctx, healthURL(r.cfg)) != nil {
				return "", err
			}
			return "running and healthy", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			active, _, err := unitActive(ctx, env, serviceUnit)
			if err != nil {
				return err
			}
			verb, detail := "start", "starting xDesign"
			if r.mode == ModeRepair || active {
				verb, detail = "restart", "restarting xDesign"
			}
			w := env.waiting(ctx, detail)
			defer w.stop()
			// A service that kept failing may have hit systemd's start limit, which refuses a
			// new start for a while; clearing its failed state resets that. It fails harmlessly
			// for a unit that did not fail, and the log keeps its answer (xmtp-panel's installer).
			_, _ = env.Run(ctx, host.Command("systemctl", "reset-failed", serviceUnit))
			if _, err := env.Run(ctx, host.Command("systemctl", verb, serviceUnit)); err != nil {
				return err
			}
			return r.waitReady(ctx, env, w)
		},
		Verify: func(context.Context, *Env) error { return nil }, // Act ran the health check
	}
}

// fixFile sets perm and owner of an existing file.
func fixFile(env *Env, p string, perm fs.FileMode, owner host.Owner, ownerName string) error {
	return env.Do(fmt.Sprintf("chown %s %s && chmod %04o %s", ownerName, p, perm, p), func() error {
		if err := env.Sys.FS.Chown(p, owner); err != nil {
			return err
		}
		return env.Sys.FS.Chmod(p, perm)
	})
}

// needsLowPort reports whether the front opens a port below 1024, which needs
// CAP_NET_BIND_SERVICE: its port when it is one (443), or port 80 when xDesign answers
// Let's Encrypt there (install.json's https.port_80, given as port80).
func needsLowPort(cfg *config.Config, port80 bool) bool {
	if port80 {
		return true
	}
	n, err := strconv.Atoi(listenPort(cfg.Listen))
	return err == nil && n < 1024
}

// renderUnit returns the unit with its capability lines fitted to the site: without
// AmbientCapabilities, and with an empty bounding set, when the front needs no low port.
func renderUnit(data []byte, lowPort bool) []byte {
	if lowPort {
		return data
	}
	var b strings.Builder
	for _, line := range strings.SplitAfter(string(data), "\n") {
		switch {
		case strings.HasPrefix(line, "AmbientCapabilities="):
			continue
		case strings.HasPrefix(line, "CapabilityBoundingSet="):
			line = "CapabilityBoundingSet=\n"
		}
		b.WriteString(line)
	}
	return []byte(b.String())
}
