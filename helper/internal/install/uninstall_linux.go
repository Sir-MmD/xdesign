package install

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"path"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// The uninstall's Linux steps (docs/plan/07-server-install-update.md section 7): the units,
// the SELinux port labels, the xdesign user, /usr/local/bin/xdesign and /opt/xdesign.

// The words of the uninstall that name Linux things.
const (
	// servicesLabel is the label of the fact that lists the units.
	servicesLabel = "units"
	// removeEverythingWords follows "2  Remove everything: " in the question.
	removeEverythingWords = "the data, the settings, the backups and the xdesign user are deleted for good"
	// reinstallWords and purgeWords end an uninstall that kept the data.
	reinstallWords = "To install xDesign again with this data: sudo ./xdesign --install with the xdesign file."
	purgeWords     = "   To delete the data too: sudo ./xdesign --uninstall --remove-everything with the xdesign file."
)

// finalBackupPrefix starts the folder of the final backup of "Remove everything".
func finalBackupPrefix() string {
	return "/root/xdesign-final-"
}

// backupsFolder is the folder of the backups, which "Keep the data" keeps.
func backupsFolder() string {
	return path.Join(dataDir, backup.FolderName)
}

// programPaths are the files of xDesign that the uninstall looks for.
func programPaths() []string {
	return []string{optDir, etcDir, dataDir, binLink}
}

// systemSteps are the uninstall's steps after the backup's question, in their order.
func (r *uninstallRun) systemSteps() []Step {
	steps := []Step{r.stepBackup(), r.stepStop(), r.stepUnits(), r.stepFirewall(), r.stepSELinux()}
	if r.remove {
		steps = append(steps, r.stepData(), r.stepUser())
	} else {
		steps = append(steps, r.stepRecord())
	}
	return append(steps, r.stepProgramFiles())
}

// checkAdmin refuses an uninstall that does not run as root; a dry run goes on with a
// warning.
func (r *uninstallRun) checkAdmin(env *Env) error {
	if r.u.Sys.Machine.Euid() != 0 {
		if !env.DryRun {
			return errors.New("xdesign --uninstall must run as root. Try: sudo xdesign --uninstall")
		}
		env.Warnf("not running as root: uninstalling needs root, and this dry run may not read every file")
	}
	return nil
}

// findServices lists the units of xDesign.
func (r *uninstallRun) findServices(fsys host.FS) ([]string, error) {
	return installedUnits(fsys)
}

// keepFinal copies the final backup's files into dir, root 0700 with the files 0600.
func (r *uninstallRun) keepFinal(ctx context.Context, env *Env, dir string, files []string) error {
	if err := env.Do("install -d -m 0700 -o root -g root "+dir, func() error {
		if err := r.u.Sys.FS.MkdirAll(dir, 0o700); err != nil {
			return err
		}
		return r.u.Sys.FS.Chmod(dir, 0o700)
	}); err != nil {
		return err
	}
	for _, p := range files {
		dst := path.Join(dir, path.Base(p))
		if _, err := env.Run(ctx, host.Command("install", "-m", "0600", "-o", "root", "-g", "root", p, dst)); err != nil {
			return err
		}
	}
	return nil
}

// uninstallSteps are the uninstall's steps in the order they run.
func uninstallSteps() stepList {
	return stepList{
		step("find", 1, secs(1)),
		step("backup", 6, secs(6)),   // VACUUM INTO and the media
		step("stop", 3, secs(3)),     // the service stops within 30 seconds
		step("units", 1, secs(1)),    // daemon-reload
		step("firewall", 2, secs(2)), // firewall-cmd --reload
		step("selinux", 4, secs(8)),  // semanage is slow
		step("record", 1, secs(1)),   // install.json
		step("data", 2, secs(2)),     // rm -rf of the data folder
		step("user", 1, secs(1)),     // userdel
		step("program-files", 1, secs(1)),
	}
}

// uninstallSections maps the uninstall's steps to the sections of its output.
func uninstallSections() map[string]string {
	m := map[string]string{"find": "Checking what is installed...", "program-files": "Finishing..."}
	for _, id := range []string{"backup", "stop", "units", "firewall", "selinux", "record", "data", "user"} {
		m[id] = "Uninstalling xDesign..."
	}
	return m
}

// installedUnits lists the unit files of xDesign in /etc/systemd/system.
func installedUnits(fsys host.FS) ([]string, error) {
	entries, err := fsys.ReadDir(unitDir)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("list %s: %w", unitDir, err)
	}
	var units []string
	for _, e := range entries {
		name := e.Name()
		if strings.HasPrefix(name, "xdesign") && !e.IsDir() && slices.Contains([]string{".service", ".timer", ".path"}, path.Ext(name)) {
			units = append(units, name)
		}
	}
	return units, nil
}

// stepStop stops every unit of xDesign and disables those that are enabled.
func (r *uninstallRun) stepStop() Step {
	return Step{ID: "stop", Title: "Stop and disable the services",
		Check: func(context.Context, *Env) (string, error) {
			if len(r.units) == 0 {
				return "no units of xDesign are installed", nil
			}
			return "", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			// The path and the timer first, so neither starts its service again.
			stop := []string{"stop"}
			for _, ext := range []string{".path", ".timer", ".service"} {
				for _, u := range r.units {
					if path.Ext(u) == ext {
						stop = append(stop, u)
					}
				}
			}
			if _, err := env.Run(ctx, host.Cmd{Name: "systemctl", Args: stop, Timeout: stopTimeout}); err != nil {
				return err
			}
			var enabled []string
			for _, u := range r.units {
				res, err := env.Query(ctx, host.Command("systemctl", "is-enabled", u))
				if err != nil {
					return err
				}
				switch res.Out() {
				case "enabled", "enabled-runtime", "linked", "linked-runtime", "alias":
					enabled = append(enabled, u)
				}
			}
			if len(enabled) > 0 {
				if _, err := env.Run(ctx, host.Command("systemctl", append([]string{"disable"}, enabled...)...)); err != nil {
					return err
				}
			}
			return nil
		},
		Verify: func(ctx context.Context, env *Env) error {
			if active, state, err := unitActive(ctx, env, serviceUnit); err == nil && active {
				return fmt.Errorf("%s is still %s", serviceUnit, state)
			}
			return nil
		},
	}
}

// stepUnits deletes the unit files and reloads systemd.
func (r *uninstallRun) stepUnits() Step {
	return Step{ID: "units", Title: "Remove the unit files",
		Check: func(context.Context, *Env) (string, error) {
			if len(r.units) == 0 {
				return "no unit files of xDesign", nil
			}
			return "", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			for _, name := range r.units {
				p := path.Join(unitDir, name)
				if err := env.Do("rm -f "+p, func() error { return r.u.Sys.FS.Remove(p) }); err != nil {
					return err
				}
			}
			if _, err := env.Run(ctx, host.Command("systemctl", "daemon-reload")); err != nil {
				return err
			}
			// Forget failed states; units that are not loaded any more make it fail, which
			// does not matter.
			_, _ = env.Run(ctx, host.Command("systemctl", append([]string{"reset-failed"}, r.units...)...))
			return nil
		},
		Verify: func(context.Context, *Env) error { return nil },
	}
}

// stepSELinux removes the port labels the installer added (selinux.go), when the owner
// asked for it.
func (r *uninstallRun) stepSELinux() Step {
	return Step{ID: "selinux", Title: "SELinux settings",
		Check: func(context.Context, *Env) (string, error) {
			switch {
			case len(r.selinuxChanges()) == 0:
				return "the installer changed no SELinux settings", nil
			case !r.selinux:
				return "kept, as other programs may need them", nil
			}
			return "", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			se := &r.state.SELinux
			for _, p := range slices.Clone(se.PortsAdded) {
				if _, err := env.Run(ctx, host.Cmd{Name: "semanage", Args: []string{"port", "-d", "-t", "http_port_t", "-p", "tcp",
					strconv.Itoa(p)}, Timeout: semanageTimeout}); err != nil {
					return err
				}
				se.PortsAdded = slices.DeleteFunc(se.PortsAdded, func(q int) bool { return q == p })
			}
			return r.saveState(env)
		},
		Verify: func(context.Context, *Env) error { return nil },
	}
}

// stepData deletes the data folder and /etc/xdesign with install.json ("Remove
// everything").
func (r *uninstallRun) stepData() Step {
	return Step{ID: "data", Title: "Delete the data and the settings",
		Check: func(context.Context, *Env) (string, error) {
			if !lexists(r.u.Sys.FS, dataDir) && !lexists(r.u.Sys.FS, etcDir) {
				return "already deleted", nil
			}
			return "", nil
		},
		Act: func(_ context.Context, env *Env) error {
			fsys := r.u.Sys.FS
			if link, err := fsys.Readlink(dataDir); err == nil {
				r.manual = append(r.manual, link+": the data folder "+dataDir+" pointed to; delete it yourself")
				env.Warnf("%s is a link to %s: the link is removed, the folder it points to is left alone", dataDir, link)
			}
			for _, p := range []string{dataDir, etcDir} {
				if lexists(fsys, p) {
					if err := env.Do("rm -rf "+p, func() error { return fsys.RemoveAll(p) }); err != nil {
						return err
					}
				}
			}
			r.hasState = false
			return nil
		},
	}
}

// stepUser deletes the xdesign user and group and the sysusers file ("Remove everything").
func (r *uninstallRun) stepUser() Step {
	userExists := func() bool { _, _, err := r.u.Sys.Users.LookupUser(serviceUser); return err == nil }
	groupExists := func() bool { _, err := r.u.Sys.Users.LookupGroup(serviceUser); return err == nil }
	return Step{ID: "user", Title: "Delete the xdesign system user",
		Check: func(context.Context, *Env) (string, error) {
			if !userExists() && !groupExists() && !lexists(r.u.Sys.FS, sysusersPath) {
				return "already deleted", nil
			}
			return "", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			if userExists() {
				if _, err := env.Run(ctx, host.Command("userdel", serviceUser)); err != nil {
					return fmt.Errorf("%w (a process of the xdesign user may still run: check with ps -u xdesign)", err)
				}
			}
			if groupExists() {
				if _, err := env.Run(ctx, host.Command("groupdel", serviceUser)); err != nil {
					return err
				}
			}
			if lexists(r.u.Sys.FS, sysusersPath) {
				return env.Do("rm "+sysusersPath, func() error { return r.u.Sys.FS.Remove(sysusersPath) })
			}
			return nil
		},
	}
}

// stepProgramFiles deletes /usr/local/bin/xdesign and /opt/xdesign. It runs last, so a run
// that failed earlier can be repeated with the installed file.
func (r *uninstallRun) stepProgramFiles() Step {
	return Step{ID: "program-files", Title: "Remove the program",
		Check: func(context.Context, *Env) (string, error) {
			if !lexists(r.u.Sys.FS, binLink) && !lexists(r.u.Sys.FS, optDir) {
				return "already removed", nil
			}
			return "", nil
		},
		Act: func(_ context.Context, env *Env) error {
			fsys := r.u.Sys.FS
			if fi, err := fsys.Lstat(binLink); err == nil {
				link, lerr := fsys.Readlink(binLink)
				if fi.Mode()&fs.ModeSymlink != 0 && lerr == nil && (link == currentBin || strings.HasPrefix(link, optDir+"/")) {
					if err := env.Do("rm "+binLink, func() error { return fsys.Remove(binLink) }); err != nil {
						return err
					}
				} else {
					env.Warnf("%s is not the link the installer made, so it was left alone", binLink)
				}
			}
			if lexists(fsys, optDir) {
				return env.Do("rm -rf "+optDir, func() error { return fsys.RemoveAll(optDir) })
			}
			return nil
		},
		Verify: func(context.Context, *Env) error { return nil },
	}
}

// removeEverythingFlags are the flags Maintenance > Uninstall xDesign adds for "Remove
// everything": the SELinux settings the installer made are undone too.
func removeEverythingFlags() []string {
	return []string{"--undo-selinux"}
}

// uninstallerTimeout bounds systemd-run, which waits until the uninstall's program runs.
const uninstallerTimeout = time.Minute

// PrepareUninstaller returns the file the uninstall that Maintenance > Uninstall xDesign
// asks for runs from (docs/plan/19-uninstall-2026-11-24.md section 5): on Linux the running
// file exe itself, which the uninstall may delete as it runs, as sudo xdesign --uninstall
// from the PATH does. A copy in /var/tmp would not run: xdesign-maintenance.service has a
// /var/tmp of its own (PrivateTmp=yes), which a transient unit does not see and which
// systemd deletes when the unit stops, and SELinux keeps systemd from starting a file
// there. There is nothing to remove.
func PrepareUninstaller(_ host.System, exe string, _ time.Time) (file string, remove func(), err error) {
	return exe, func() {}, nil
}

// StartUninstaller starts file with args as the transient unit
// xdesign-uninstall-<time>.service (systemd-run --collect), a process of its own that
// stopping and removing the maintenance units does not end. systemd-run returns once the
// program runs (--service-type=exec), so a file systemd cannot start is an error here.
// Its lines go to the journal, and the uninstall writes its log as on the command line.
func StartUninstaller(ctx context.Context, sys host.System, file string, args []string, at time.Time) error {
	unit := "xdesign-uninstall-" + at.UTC().Format(uninstallerTimeLayout)
	cmd := host.Cmd{Name: "systemd-run", Args: append([]string{"--quiet", "--collect", "--service-type=exec", "--unit=" + unit,
		"--description=Uninstall xDesign", "--", file}, args...), Timeout: uninstallerTimeout}
	res, err := sys.Runner.Run(ctx, cmd)
	if err != nil {
		return err
	}
	return res.Err(cmd)
}

// removeCopy does nothing on Linux: the uninstall runs from the program's own file.
func (r *uninstallRun) removeCopy() {}

// remains lists what stays on the server and how to remove it.
func (r *uninstallRun) remains() []string {
	var out []string
	if !r.remove {
		out = append(out,
			etcDir+": the settings and install.json",
			dataDir+": the database, the media, the backups and the certificates",
			"the xdesign system user, which owns the kept files")
	}
	if r.remove && r.backupPath != "" {
		dir := path.Dir(r.backupPath)
		out = append(out, dir+": the final backup. Copy it off the server (scp -r root@SERVER:"+dir+" .), then delete it here: rm -rf "+
			dir)
	}
	if changes := r.selinuxChanges(); len(changes) > 0 {
		out = append(out, "the SELinux settings the installer made, which other programs may need. To undo them: "+
			strings.Join(changes, "; "))
	}
	for _, p := range r.state.SELinux.PortsModified {
		out = append(out, fmt.Sprintf("the SELinux label http_port_t of TCP port %d, which the installer moved from another type: "+
			"semanage port -l | grep -w %d shows it", p, p))
	}
	out = append(out, r.manual...)
	out = append(out, DefaultLogPath+": the log of the installer and the uninstall (no secrets); remove it with rm "+DefaultLogPath)
	return out
}
