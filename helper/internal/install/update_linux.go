package install

import (
	"context"
	"errors"
	"fmt"
	"path"
	"strings"
	"time"

	"github.com/Sir-MmD/xdesign/helper/deploy"
	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/guard"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// The Linux parts of an update (docs/plan/07-server-install-update.md section 6.3): root,
// the systemd units, xdesign.service's stop and start, and the journal of a failed update.
// update_windows.go has the same names for Windows.

// The words of the update's messages that name Linux things.
const (
	// updateExample and copyExample show the file an update takes, and how it gets to the
	// server.
	updateExample = "sudo xdesign update /root/xdesign-1.1.0-linux-amd64"
	copyExample   = "scp xdesign-1.1.0-linux-amd64 SHA256SUMS root@SERVER:/root/"
	// notElevatedWarning starts a dry run that is not root.
	notElevatedWarning = "not running as root: an update needs root, and this dry run may not read every file"
	// programWords names where the releases are, for the free space.
	programWords = "/opt"
	// unitsWords names what the update installs besides the release, for a dry run's plan.
	unitsWords = "the units"
	// guardWords describes the guard's marker for the plan and the log.
	guardWords = "xdesign 0600"
)

// failureDir keeps the journal of failed updates (section 6.3 step 7).
const failureDir = dataDir + "/update-failures"

// elevated reports whether this process may change the installation: root.
func elevated(m host.Machine) bool {
	return m.Euid() == 0
}

// notElevated refuses an update that does not run as root.
func notElevated(file string) error {
	return errors.New("xdesign update must run as root. Try: sudo xdesign update " + file)
}

// notAdmin refuses what (a rollback, an address or a domain change) when it does not run
// as root; try is the command to run with sudo, "" for none.
func notAdmin(what, try string) error {
	if try == "" {
		return errors.New(what + " must run as root")
	}
	return errors.New(what + " must run as root. Try: sudo " + try)
}

// guardOwner is the owner of the guard's marker: the xdesign user, so serve counts its
// starts in it.
func guardOwner(sys host.System) (guard.Owner, error) {
	uid, gid, err := sys.Users.LookupUser(serviceUser)
	if err != nil {
		return guard.Owner{}, fmt.Errorf("the user %s: %w", serviceUser, err)
	}
	return guard.Owner{UID: uid, GID: gid}, nil
}

// releaseInUse reports false: Linux removes the files of a running program, which keeps
// its own open.
func releaseInUse(string) bool {
	return false
}

// appCmdIn is appCmd with the app of the release folder dir.
func appCmdIn(dir string, args ...string) host.Cmd {
	return host.Cmd{
		Name: "runuser",
		Args: append([]string{"-u", serviceUser, "--", "env", "-C", dir, "XD_DATA_DIR=" + dataDir, "NODE_ENV=production",
			path.Join(dir, releaseNode), path.Join(dir, releaseCLI)}, args...),
		Timeout: appTimeout,
	}
}

// stepUnits installs the new release's units where they differ (section 6.3 step 4):
// xdesign.service for this site, the backup units and the maintenance units, then a
// daemon-reload, and turns the maintenance path on.
func (r *updateRun) stepUnits() Step {
	return Step{Num: "10", ID: "units", Title: "systemd units", Act: func(ctx context.Context, env *Env) error {
		units, names, err := siteUnits(r.cfg, r.state.HTTPS.Port80)
		if err != nil {
			return err
		}
		changed := 0
		for _, name := range names {
			dst := path.Join(unitDir, name)
			same, err := sameFile(r.u.Sys.FS, dst, units[name])
			if err != nil {
				return err
			}
			if same {
				continue
			}
			if err := installFile(env, "systemd/"+name, dst, units[name]); err != nil {
				return err
			}
			changed++
		}
		if changed > 0 {
			if _, err := env.Run(ctx, host.Command("systemctl", "daemon-reload")); err != nil {
				return err
			}
		}
		enableMaintenancePath(ctx, env, r.u.Sys.FS)
		return nil
	}}
}

// siteUnits are the units of this file for the site of cfg (port80 as in needsLowPort), by
// name, and their names in the order they are installed.
func siteUnits(cfg *config.Config, port80 bool) (map[string][]byte, []string, error) {
	units, err := backupUnits()
	if err != nil {
		return nil, nil, err
	}
	main, err := deploy.Unit(serviceUnit)
	if err != nil {
		return nil, nil, err
	}
	units[serviceUnit] = renderUnit(main, needsLowPort(cfg, port80))
	for _, name := range maintenanceUnitNames() {
		if units[name], err = deploy.Unit(name); err != nil {
			return nil, nil, err
		}
	}
	return units, append([]string{serviceUnit, backupService, backupTimer}, maintenanceUnitNames()...), nil
}

// startAndCheck starts xdesign.service and waits until the release of version answers:
// the front answers, /api/health reports version, and the live server answers a WebSocket
// upgrade; up to updateHealthWait.
func startAndCheck(ctx context.Context, env *Env, u *Updater, cfg *config.Config, version string) error {
	w := env.waiting(ctx, "starting xDesign "+version)
	defer w.stop()
	_, _ = env.Run(ctx, host.Command("systemctl", "reset-failed", serviceUnit)) // fails for a unit that did not fail
	cmd := host.Command("systemctl", "start", serviceUnit)
	cmd.Timeout = stopTimeout
	if _, err := env.Run(ctx, cmd); err != nil {
		return err
	}
	if env.DryRun {
		return nil
	}
	if u.Get == nil {
		env.Warnf("the health check is left out: this build cannot ask the website")
		return nil
	}
	w.say("waiting for xDesign " + version + " to answer")
	url := healthURL(cfg)
	start := time.Now()
	var last error
	for {
		active, state, err := unitActive(ctx, env, serviceUnit)
		switch {
		case err != nil:
			last = err
		case state == "failed":
			last = fmt.Errorf("%s failed; its journal says why: journalctl -u xdesign -n 50 --no-pager", serviceUnit)
		case !active:
			last = fmt.Errorf("%s is %s", serviceUnit, state)
		default:
			last = healthOf(ctx, u, cfg, url, version)
			if last == nil {
				env.Factf("health", "xDesign %s answered after %s", version, formatElapsed(time.Since(start)))
				return nil
			}
		}
		if time.Since(start) >= updateHealthWait {
			return fmt.Errorf("xDesign %s did not answer within %s (last: %w)", version, formatElapsed(updateHealthWait), last)
		}
		time.Sleep(healthPoll)
	}
}

// stopService stops xdesign.service gracefully and checks that it stopped.
func stopService(ctx context.Context, env *Env) error {
	cmd := host.Command("systemctl", "stop", serviceUnit)
	cmd.Timeout = stopTimeout
	if _, err := env.Run(ctx, cmd); err != nil {
		return err
	}
	if env.DryRun {
		return nil
	}
	active, state, err := unitActive(ctx, env, serviceUnit)
	if err != nil {
		return err
	}
	if active {
		return fmt.Errorf("%s is still %s after systemctl stop", serviceUnit, state)
	}
	return nil
}

// saveFailureLog keeps the end of the journal of every xDesign unit, with header on top,
// in /var/lib/xdesign/update-failures/<UTC time>.log (section 6.3 step 7), root only. It
// returns the file.
func saveFailureLog(ctx context.Context, env *Env, at time.Time, header string) (string, error) {
	cmd := host.Command("journalctl", "-u", "xdesign*", "-n", fmt.Sprint(failureJournalLines), "--no-pager", "-o", "short-iso")
	journal := "(the journal could not be read)"
	if res, err := env.Query(ctx, cmd); err == nil && res.OK() {
		journal = strings.TrimRight(string(res.Stdout), "\n")
	}
	name := path.Join(failureDir, at.UTC().Format("20060102T150405Z")+".log")
	text := header + "\n\nThe last " + fmt.Sprint(failureJournalLines) + " lines of the journal (journalctl -u 'xdesign*'):\n" + journal + "\n"
	err := env.Do(cmd.String()+" > "+name, func() error {
		if err := privateRootDir(env.Sys.FS, failureDir); err != nil {
			return err
		}
		return env.Sys.FS.WriteFile(name, []byte(env.Masker().Mask(text)), 0o600, host.Root())
	})
	return name, err
}

// privateRootDir makes dir, inside a folder of the xdesign user (/var/lib/xdesign), a
// folder of root's with mode 0700. Whatever else is at dir is removed first without
// following it: a link the xdesign user put there would make root write, chmod and chown
// somewhere else, with text (the journal) that user can influence.
func privateRootDir(fsys host.FS, dir string) error {
	if fi, err := fsys.Lstat(dir); err == nil {
		owner, oerr := fsys.Owner(dir)
		if !fi.IsDir() || oerr != nil || owner != host.Root() {
			if err := fsys.RemoveAll(dir); err != nil {
				return fmt.Errorf("remove %s, which is not a folder of root's: %w", dir, err)
			}
		}
	}
	if err := fsys.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	return fsys.Chmod(dir, 0o700)
}

// leaveStopped stops xdesign.service when going back failed too, and leaves it stopped.
func leaveStopped(ctx context.Context, env *Env) {
	stop := host.Command("systemctl", "stop", serviceUnit)
	stop.Timeout = stopTimeout
	_, _ = env.Run(ctx, stop) // the failure is reported by the caller
}
