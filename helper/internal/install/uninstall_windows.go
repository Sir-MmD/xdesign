package install

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// The uninstall's Windows steps (docs/plan/18-third-owner-list-2026-11-23.md section 8.7):
// the two services, the firewall rules install.json records, C:\Program Files\xDesign\current
// on the system PATH, the program folder, the entry in Windows' list of installed apps
// (apps_windows.go) and, with "Remove everything", C:\ProgramData\xDesign. There is no
// system user and no SELinux on Windows. The uninstall that Maintenance > Uninstall xDesign
// starts runs from a copy of xdesign.exe in C:\Windows\Temp\xdesign-uninstall-<time>\
// (docs/plan/19-uninstall-2026-11-24.md section 5), which Windows deletes at the next
// restart once the uninstall ends.

// The words of the uninstall that name Windows things.
const (
	// servicesLabel is the label of the fact that lists the services.
	servicesLabel = "services"
	// removeEverythingWords follows "2  Remove everything: " in the question.
	removeEverythingWords = "the data, the settings and the backups are deleted for good"
	// reinstallWords and purgeWords end an uninstall that kept the data.
	reinstallWords = `To install xDesign again with this data: .\xdesign.exe --install with the xdesign.exe file, in a ` +
		"terminal opened as Administrator."
	purgeWords = `   To delete the data too: .\xdesign.exe --uninstall --remove-everything with the xdesign.exe file.`
)

// uninstallSteps are the uninstall's steps in the order they run.
func uninstallSteps() stepList {
	return stepList{
		step("find", 1, secs(1)),
		step("backup", 6, secs(6)),   // VACUUM INTO and the media
		step("stop", 3, secs(3)),     // the service stops within 30 seconds
		step("services", 1, secs(1)), // the two services deleted
		step("firewall", 2, secs(2)), // netsh, a rule or two
		step("record", 1, secs(1)),   // install.json
		step("data", 2, secs(2)),     // C:\ProgramData\xDesign deleted
		step("path", 1, secs(1)),     // the system PATH and its announcement
		step("program-files", 1, secs(1)),
		step("apps", 1, secs(1)), // Windows' list of installed apps
	}
}

// uninstallSections maps the uninstall's steps to the sections of its output.
func uninstallSections() map[string]string {
	m := map[string]string{"find": "Checking what is installed...", "program-files": "Finishing...", "apps": "Finishing..."}
	for _, id := range []string{"backup", "stop", "services", "firewall", "record", "data", "path"} {
		m[id] = "Uninstalling xDesign..."
	}
	return m
}

// finalBackupPrefix starts the folder of the final backup of "Remove everything": in the
// profile folder of the Administrator who runs the uninstall, which only that account,
// SYSTEM and Administrators open.
func finalBackupPrefix() string {
	home, err := os.UserHomeDir()
	if err != nil {
		home = `C:\`
	}
	return filepath.Join(home, "xdesign-final-")
}

// backupsFolder is the folder of the backups, which "Keep the data" keeps.
func backupsFolder() string {
	return platform.BackupsDir
}

// programPaths are the folders of xDesign that the uninstall looks for.
func programPaths() []string {
	return []string{optDir, etcDir}
}

// systemSteps are the uninstall's steps after the backup's question, in their order.
func (r *uninstallRun) systemSteps() []Step {
	steps := []Step{r.stepBackup(), r.stepStop(), r.stepServices(), r.stepFirewall()}
	if r.remove {
		steps = append(steps, r.stepData())
	} else {
		steps = append(steps, r.stepRecord())
	}
	return append(steps, r.stepPath(), r.stepProgramFiles(), r.stepApps())
}

// checkAdmin refuses an uninstall that does not run elevated, in a terminal opened as
// Administrator; a dry run goes on with a warning.
func (r *uninstallRun) checkAdmin(env *Env) error {
	if platform.Elevated() {
		return nil
	}
	if !env.DryRun {
		return errors.New("xdesign --uninstall must run as Administrator: run this in a terminal opened as Administrator")
	}
	env.Warnf("not running as Administrator: uninstalling needs it, and this dry run may not read every file")
	return nil
}

// findServices lists the services of xDesign that exist: the two the installer makes and
// any other install.json records.
func (r *uninstallRun) findServices(host.FS) ([]string, error) {
	names := serviceNames()
	for _, name := range r.state.Services {
		if !slices.Contains(names, name) {
			names = append(names, name)
		}
	}
	var found []string
	for _, name := range names {
		s, err := openService(name, windows.SERVICE_QUERY_STATUS)
		if err != nil {
			return nil, err
		}
		if s != nil {
			closeService(s)
			found = append(found, name)
		}
	}
	return found, nil
}

// keepFinal copies the final backup's files into dir, which takes the permissions of the
// profile folder it is in.
func (r *uninstallRun) keepFinal(_ context.Context, env *Env, dir string, files []string) error {
	if err := env.Do("mkdir "+dir, func() error { return r.u.Sys.FS.MkdirAll(dir, 0o700) }); err != nil {
		return err
	}
	for _, p := range files {
		dst := filepath.Join(dir, filepath.Base(p))
		if err := env.Do("copy "+p+" "+dst, func() error { return copyFile(r.u.Sys.FS, p, dst) }); err != nil {
			return err
		}
	}
	return nil
}

// copyFile copies the file src to the new file dst, which takes the permissions of its
// folder.
func copyFile(fsys host.FS, src, dst string) error {
	in, err := fsys.Open(src)
	if err != nil {
		return err
	}
	defer func() { _ = in.Close() }() // only read
	out, err := os.OpenFile(filepath.Clean(dst), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return fmt.Errorf("copy %s: %w", src, err)
	}
	if _, err := io.Copy(out, in); err != nil {
		_ = out.Close() // the copy failed already
		return fmt.Errorf("copy %s to %s: %w", src, dst, err)
	}
	if err := out.Sync(); err != nil {
		_ = out.Close() // the copy failed already
		return fmt.Errorf("copy %s to %s: %w", src, dst, err)
	}
	if err := out.Close(); err != nil {
		return fmt.Errorf("copy %s to %s: %w", src, dst, err)
	}
	return nil
}

// stepStop stops the services: xdesign first, so it starts no maintenance, then
// xdesign-maintenance.
func (r *uninstallRun) stepStop() Step {
	return Step{ID: "stop", Title: "Stop the services",
		Check: func(context.Context, *Env) (string, error) {
			if len(r.units) == 0 {
				return "no services of xDesign are installed", nil
			}
			for _, name := range r.units {
				if state, found, err := serviceState(name); err != nil || (found && state != svc.Stopped) {
					return "", err
				}
			}
			return "the services are stopped", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			for _, name := range r.units {
				if err := env.Do("Stop-Service "+name, func() error { return stopWindowsService(ctx, name) }); err != nil {
					return err
				}
			}
			return nil
		},
		Verify: func(context.Context, *Env) error {
			if state, found, err := serviceState(serviceName); err == nil && found && state != svc.Stopped {
				return fmt.Errorf("the service %s is still %s", serviceName, stateWords(state))
			}
			return nil
		},
	}
}

// stepServices deletes the services and forgets them in install.json. Windows removes a
// service once nothing holds it open (the Services window, for one).
func (r *uninstallRun) stepServices() Step {
	return Step{ID: "services", Title: "Remove the services",
		Check: func(context.Context, *Env) (string, error) {
			if len(r.units) == 0 {
				return "no services of xDesign", nil
			}
			return "", nil
		},
		Act: func(_ context.Context, env *Env) error {
			for _, name := range r.units {
				if err := env.Do("sc.exe delete "+name, func() error { return deleteService(name) }); err != nil {
					return err
				}
			}
			r.state.Services = nil
			return r.saveState(env)
		},
		Verify: func(context.Context, *Env) error { return nil },
	}
}

// deleteService deletes the service name; a missing one, or one Windows deletes already,
// is no error.
func deleteService(name string) error {
	s, err := openService(name, windows.DELETE)
	if err != nil || s == nil {
		return err
	}
	defer closeService(s)
	if err := s.Delete(); err != nil && !errors.Is(err, windows.ERROR_SERVICE_MARKED_FOR_DELETE) {
		return fmt.Errorf("remove the service %s: %w", name, err)
	}
	return nil
}

// stepData deletes C:\ProgramData\xDesign ("Remove everything"): the settings,
// install.json, the data, the backups and the logs, but for the log this uninstall writes,
// which stays with its folders as the Linux one stays in /var/log.
func (r *uninstallRun) stepData() Step {
	keep := filepath.Clean(r.o.logPath())
	return Step{ID: "data", Title: "Delete the data and the settings",
		Check: func(context.Context, *Env) (string, error) {
			left, err := leftBesides(r.u.Sys.FS, etcDir, keep)
			if err != nil || left {
				return "", err
			}
			return "already deleted", nil
		},
		Act: func(_ context.Context, env *Env) error {
			fsys := r.u.Sys.FS
			if link, err := fsys.Readlink(dataDir); err == nil {
				link = linkTarget(link)
				r.manual = append(r.manual, link+": the data folder "+dataDir+" pointed to; delete it yourself")
				env.Warnf("%s is a link to %s: the link is removed, the folder it points to is left alone", dataDir, link)
				if err := env.Do("rmdir "+dataDir, func() error { return fsys.Remove(dataDir) }); err != nil {
					return err
				}
			}
			if err := env.Do("delete "+etcDir+", but for "+keep, func() error { return removeBesides(fsys, etcDir, keep) }); err != nil {
				return err
			}
			r.hasState = false
			return nil
		},
	}
}

// within reports whether p is dir or inside it, ignoring case.
func within(p, dir string) bool {
	p, dir = strings.ToLower(filepath.Clean(p)), strings.ToLower(filepath.Clean(dir))
	return p == dir || strings.HasPrefix(p, strings.TrimSuffix(dir, `\`)+`\`)
}

// leftBesides reports whether the folder dir holds anything but keep and the folders on
// its way.
func leftBesides(fsys host.FS, dir, keep string) (bool, error) {
	if !lexists(fsys, dir) {
		return false, nil
	}
	if !within(keep, dir) || strings.EqualFold(filepath.Clean(keep), filepath.Clean(dir)) {
		return true, nil
	}
	entries, err := fsys.ReadDir(dir)
	if err != nil {
		return false, fmt.Errorf("list %s: %w", dir, err)
	}
	for _, e := range entries {
		p := filepath.Join(dir, e.Name())
		switch {
		case strings.EqualFold(p, keep):
		case within(keep, p) && e.IsDir():
			if left, err := leftBesides(fsys, p, keep); err != nil || left {
				return left, err
			}
		default:
			return true, nil
		}
	}
	return false, nil
}

// removeBesides removes dir and everything in it but keep and the folders on its way; a
// keep outside dir removes it all.
func removeBesides(fsys host.FS, dir, keep string) error {
	if !within(keep, dir) {
		return fsys.RemoveAll(dir)
	}
	entries, err := fsys.ReadDir(dir)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("list %s: %w", dir, err)
	}
	for _, e := range entries {
		p := filepath.Join(dir, e.Name())
		switch {
		case strings.EqualFold(p, keep):
		case within(keep, p) && e.IsDir():
			if err := removeBesides(fsys, p, keep); err != nil {
				return err
			}
		default:
			if err := fsys.RemoveAll(p); err != nil {
				return err
			}
		}
	}
	return nil
}

// stepPath removes C:\Program Files\xDesign\current from the system PATH.
func (r *uninstallRun) stepPath() Step {
	return Step{ID: "path", Title: "The system PATH",
		Check: func(context.Context, *Env) (string, error) {
			on, err := platform.OnSystemPath(currentLink)
			if err != nil || on {
				return "", err
			}
			return currentLink + " is not on it", nil
		},
		Act: func(_ context.Context, env *Env) error {
			return env.Do(fmt.Sprintf(`remove %s from the system PATH (HKLM\%s, Path) and tell the running programs`, currentLink,
				`SYSTEM\CurrentControlSet\Control\Session Manager\Environment`), func() error {
				return platform.RemoveFromSystemPath(currentLink)
			})
		},
	}
}

// stepProgramFiles deletes C:\Program Files\xDesign: the current junction first (the link
// only), then the folder. It runs last, so a run that failed earlier can be repeated with
// the installed file. Windows does not delete a running program's file, but lets it be
// moved: an uninstall that runs from the folder (xdesign --uninstall from the PATH) moves
// its own file to Windows' Temp folder first, where Windows deletes it at the next restart
// (MoveFileEx with MOVEFILE_DELAY_UNTIL_REBOOT). What another program still holds is
// deleted at the next restart the same way.
func (r *uninstallRun) stepProgramFiles() Step {
	return Step{ID: "program-files", Title: "Remove the program",
		Check: func(context.Context, *Env) (string, error) {
			if !lexists(r.u.Sys.FS, optDir) {
				return "already removed", nil
			}
			return "", nil
		},
		Act: func(_ context.Context, env *Env) error {
			fsys := r.u.Sys.FS
			running, err := runningFile()
			if err != nil {
				return err
			}
			if _, err := fsys.Readlink(currentLink); err == nil {
				if err := env.Do("rmdir "+currentLink, func() error { return fsys.Remove(currentLink) }); err != nil {
					return err
				}
			}
			if within(running, optDir) {
				if err := r.moveAside(env, running); err != nil {
					return err
				}
			}
			return env.Do("rmdir /s /q "+optDir, func() error {
				err := fsys.RemoveAll(optDir)
				if err == nil {
					return nil
				}
				if lerr := deleteAtRestart(optDir); lerr != nil {
					return errors.Join(err, lerr)
				}
				env.Warnf("a program still holds a file of %s (%v): Windows deletes what is left when it restarts", optDir, err)
				r.manual = append(r.manual, optDir+": what a program still held; Windows deletes it when it restarts")
				return nil
			})
		},
		Verify: func(context.Context, *Env) error { return nil },
	}
}

// runningFile is the file this process runs from, with the junctions on its way resolved
// (C:\Program Files\xDesign\releases\<version>\xdesign.exe when it was started through
// current).
func runningFile() (string, error) {
	f, err := os.Open(selfFile())
	if err != nil {
		return "", fmt.Errorf("open the running file: %w", err)
	}
	defer func() { _ = f.Close() }() // only read
	var buf [windows.MAX_LONG_PATH]uint16
	n, err := windows.GetFinalPathNameByHandle(windows.Handle(f.Fd()), &buf[0], windows.MAX_LONG_PATH, 0)
	if err != nil {
		return "", fmt.Errorf("the path of the running file: %w", err)
	}
	return linkTarget(windows.UTF16ToString(buf[:n])), nil
}

// uninstallerPrefix starts the names in Windows' Temp folder of the copy's folder that
// Maintenance > Uninstall xDesign runs and of the running file that moveAside moves there.
const uninstallerPrefix = "xdesign-uninstall-"

// windowsTemp is Windows' Temp folder, C:\Windows\Temp, on the drive of the program folder.
func windowsTemp() (string, error) {
	winDir, err := windows.GetSystemWindowsDirectory()
	if err != nil {
		return "", fmt.Errorf("the Windows folder: %w", err)
	}
	return filepath.Join(winDir, "Temp"), nil
}

// PrepareUninstaller copies the running file exe into the new folder
// C:\Windows\Temp\xdesign-uninstall-<time>\ for the uninstall that Maintenance > Uninstall
// xDesign asks for (docs/plan/19-uninstall-2026-11-24.md section 5): Windows deletes no
// running program's file, so the uninstall must not run from the program folder it
// deletes. The folder is made with the run folder's permissions (only SYSTEM and
// Administrators open it), never taken over when it exists, so no other user can put
// another file in its place. It returns the copy and the function that removes the folder
// when the copy does not start.
func PrepareUninstaller(sys host.System, exe string, at time.Time) (file string, remove func(), err error) {
	temp, err := windowsTemp()
	if err != nil {
		return "", nil, err
	}
	dir := filepath.Join(temp, uninstallerPrefix+at.UTC().Format(uninstallerTimeLayout))
	if err := platform.MakeFolder(dir, runDirSecurity()); err != nil {
		return "", nil, fmt.Errorf("create the uninstaller's folder: %w", err)
	}
	remove = func() { _ = sys.FS.RemoveAll(dir) } // best effort: Windows' Temp folder
	file = filepath.Join(dir, releaseSelf)
	if err := copyFile(sys.FS, exe, file); err != nil {
		remove()
		return "", nil, err
	}
	return file, remove, nil
}

// StartUninstaller starts the copy file with args as a process of its own, outside the
// maintenance service's console and job (platform.StartDetached), so stopping and deleting
// the services does not end it. The uninstall writes its log as on the command line.
func StartUninstaller(ctx context.Context, _ host.System, file string, args []string, _ time.Time) error {
	return platform.StartDetached(ctx, file, args, filepath.Dir(file))
}

// removeEverythingFlags are the flags Maintenance > Uninstall xDesign adds for "Remove
// everything": none on Windows, which has no SELinux.
func removeEverythingFlags() []string {
	return nil
}

// uninstallerDir is the folder of the copy of xdesign.exe this process runs from when
// Maintenance > Uninstall xDesign started it (C:\Windows\Temp\xdesign-uninstall-<time>),
// "" otherwise.
func uninstallerDir() string {
	running, err := runningFile()
	if err != nil {
		return ""
	}
	temp, err := windowsTemp()
	if err != nil {
		return ""
	}
	dir := filepath.Dir(running)
	if !strings.EqualFold(filepath.Dir(dir), temp) || !strings.HasPrefix(strings.ToLower(filepath.Base(dir)), uninstallerPrefix) {
		return ""
	}
	return dir
}

// removeCopy has Windows delete the folder of the copy this uninstall ran from at the next
// restart, when Maintenance > Uninstall xDesign started it: the running file cannot be
// deleted before it ends.
func (r *uninstallRun) removeCopy() {
	dir := uninstallerDir()
	if dir == "" || r.o.DryRun {
		return
	}
	if err := deleteAtRestart(dir); err != nil {
		r.env.Log().Printf("could not have %s deleted at the next restart: %v", dir, err)
		return
	}
	r.env.Log().Printf("Windows deletes %s when it restarts", dir)
}

// moveAside moves the running file out of the program folder into Windows' Temp folder,
// on the same drive, and asks Windows to delete it at the next restart.
func (r *uninstallRun) moveAside(env *Env, running string) error {
	temp, err := windowsTemp()
	if err != nil {
		return err
	}
	suffix, err := randomString(r.u.Rand, basePathChars, 8)
	if err != nil {
		return err
	}
	moved := filepath.Join(temp, uninstallerPrefix+suffix+".exe")
	return env.Do("move "+running+" "+moved+" (the running uninstaller; Windows deletes it when it restarts)", func() error {
		if err := r.u.Sys.FS.Rename(running, moved); err != nil {
			return err
		}
		r.moved = moved
		return deleteAtRestart(moved)
	})
}

// deleteAtRestart asks Windows to delete p at the next restart: a folder after everything
// in it, as Windows works through the list in its order.
func deleteAtRestart(p string) error {
	var paths []string
	err := filepath.WalkDir(p, func(q string, _ fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		paths = append(paths, q)
		return nil
	})
	if err != nil {
		return fmt.Errorf("list %s: %w", p, err)
	}
	slices.Reverse(paths) // what is inside a folder before the folder
	for _, q := range paths {
		name, err := windows.UTF16PtrFromString(q)
		if err != nil {
			return fmt.Errorf("delete %s at the next restart: %w", q, err)
		}
		if err := windows.MoveFileEx(name, nil, windows.MOVEFILE_DELAY_UNTIL_REBOOT); err != nil {
			return fmt.Errorf("delete %s at the next restart: %w", q, err)
		}
	}
	return nil
}

// remains lists what stays on the server and how to remove it.
func (r *uninstallRun) remains() []string {
	var out []string
	if !r.remove {
		out = append(out, etcDir+": the settings, install.json, the database, the media, the backups, the certificates and the logs")
	}
	if r.remove && r.backupPath != "" {
		dir := filepath.Dir(r.backupPath)
		out = append(out, dir+`: the final backup. Copy it off the server, then delete it here: Remove-Item -Recurse "`+dir+`"`)
	}
	if r.moved != "" {
		out = append(out, r.moved+": this uninstaller, which ran from "+optDir+"; Windows deletes it when it restarts")
	}
	if dir := uninstallerDir(); dir != "" {
		out = append(out, dir+": this uninstaller, which Maintenance > Uninstall xDesign started; Windows deletes it when it restarts")
	}
	out = append(out, r.manual...)
	if r.remove {
		out = append(out, DefaultLogPath+": the log of the installer and the uninstall (no secrets); remove it with Remove-Item -Recurse "+
			etcDir)
	} else {
		out = append(out, DefaultLogPath+": the log of the installer and the uninstall (no secrets); remove it with Remove-Item "+
			DefaultLogPath)
	}
	return out
}
