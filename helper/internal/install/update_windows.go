package install

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc"

	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/guard"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// The Windows parts of an update (docs/plan/18-third-owner-list-2026-11-23.md section 8.6),
// with the names of update_linux.go: an Administrator (or LocalSystem, the maintenance
// service) in place of root, the two services in place of the units, the service
// manager's stop and start, and the service's log in place of the journal.

// The words of the update's messages that name Windows things.
const (
	// updateExample and copyExample show the file an update takes, and how it gets to the
	// server.
	updateExample = `xdesign update C:\Users\Administrator\Downloads\xdesign-1.1.0-windows-amd64.exe`
	copyExample   = `copy xdesign-1.1.0-windows-amd64.exe and SHA256SUMS to C:\Users\Administrator\Downloads on the server`
	// notElevatedWarning starts a dry run that is not elevated.
	notElevatedWarning = "not running as Administrator: an update needs a terminal opened as Administrator, and this dry run may " +
		"not read every file"
	// programWords names where the releases are, for the free space.
	programWords = `C:\Program Files`
	// unitsWords names what the update sets up besides the release, for a dry run's plan.
	unitsWords = "the services"
	// guardWords describes the guard's marker for the plan and the log.
	guardWords = `NT SERVICE\` + serviceName + " may change it"
)

// failureDir keeps the end of the service's log of failed updates (section 8.6, as 07
// section 6.3 step 7).
const failureDir = platform.UpdateFailuresDir

// restartWindow is how long stopSite waits for Windows to restart a service that a
// failure stopped (its failure actions restart it after 5 seconds, later after 60).
const restartWindow = 65 * time.Second

// elevated reports whether this process may change the installation: in a terminal opened
// as Administrator, or as LocalSystem (the maintenance service).
func elevated(host.Machine) bool {
	return platform.Elevated()
}

// notElevated refuses an update that does not run elevated.
func notElevated(string) error {
	return errors.New("xdesign update must run as Administrator: run this in a terminal opened as Administrator")
}

// notAdmin refuses what (a rollback, an address or a domain change) when it does not run
// elevated; the command needs no prefix on Windows.
func notAdmin(what, _ string) error {
	return errors.New(what + " must run as Administrator: run this in a terminal opened as Administrator")
}

// guardOwner is no owner: Windows has no numeric owners, and the guard gives the marker to
// the service's account by its permissions.
func guardOwner(host.System) (guard.Owner, error) {
	return guard.Owner{}, nil
}

// releaseInUse reports whether a running program uses the release folder dir: its
// xdesign.exe or node.exe cannot be opened for writing (the maintenance service runs the
// release before an update, and Windows cannot delete a running program's file).
func releaseInUse(dir string) bool {
	for _, name := range []string{releaseSelf, releaseNode} {
		p, err := windows.UTF16PtrFromString(filepath.Join(dir, name))
		if err != nil {
			continue
		}
		h, err := windows.CreateFile(p, windows.GENERIC_WRITE, windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE,
			nil, windows.OPEN_EXISTING, windows.FILE_ATTRIBUTE_NORMAL, 0)
		if errors.Is(err, windows.ERROR_SHARING_VIOLATION) {
			return true
		}
		if err == nil {
			_ = windows.CloseHandle(h) // opened to ask, nothing written
		}
	}
	return false
}

// appCmdIn runs a command of the app of the release folder dir, `node.exe app\cli.mjs
// <args>`, with the data folder, as appCmd does with current's.
func appCmdIn(dir string, args ...string) host.Cmd {
	return host.Cmd{
		Name:    filepath.Join(dir, releaseNode),
		Args:    append([]string{filepath.Join(dir, releaseCLI)}, args...),
		Env:     []string{"XD_DATA_DIR=" + dataDir, "NODE_ENV=production"},
		Timeout: appTimeout,
	}
}

// stepUnits gives the two services the new release's settings where they differ, as the
// installer's services step does (the units of section 6.3 step 4). Both run through the
// current junction, so the switch changes neither; the maintenance service that runs this
// update keeps running, and Windows takes its settings at its next start.
func (r *updateRun) stepUnits() Step {
	return Step{Num: "10", ID: "units", Title: "Windows services", Act: func(_ context.Context, env *Env) error {
		for _, s := range windowsServices() {
			diff, err := s.differs()
			if err != nil {
				return err
			}
			if diff == "" {
				continue
			}
			if err := env.Do(fmt.Sprintf("set up the service %s (%s): %s", s.name, s.words, s.commandLine()), s.apply); err != nil {
				return err
			}
		}
		return nil
	}}
}

// startAndCheck starts the service xdesign and waits until the release of version
// answers: the service runs, /api/health reports version, and the live server answers a
// WebSocket upgrade; up to updateHealthWait. A service that stops on the way is waited
// for, as Windows restarts it (its failure actions, as systemd's Restart=on-failure).
func startAndCheck(ctx context.Context, env *Env, u *Updater, cfg *config.Config, version string) error {
	w := env.waiting(ctx, "starting xDesign "+version)
	defer w.stop()
	if err := env.Do("Start-Service "+serviceName, func() error { return startWindowsService(serviceName) }); err != nil {
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
		state, _, err := serviceState(serviceName)
		switch {
		case err != nil:
			last = err
		case state != svc.Running:
			last = fmt.Errorf("the service %s is %s; its log says why: xdesign logs --lines 50", serviceName, stateWords(state))
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

// stopService stops the service xdesign and checks that it stays stopped (stopSite).
func stopService(ctx context.Context, env *Env) error {
	return env.Do("Stop-Service "+serviceName, func() error { return stopSite(ctx) })
}

// stopSite stops the service xdesign and waits until it stopped. systemctl stop also
// cancels a restart systemd has planned; Windows restarts a service that a failure stopped
// by its failure actions whatever happens meanwhile. So when the service is found stopped
// by a failure (an exit code that is not 0), stopSite waits up to restartWindow for that
// restart and stops it again; a stop that Windows asked for ends with 0, and a service not
// started since the boot says so.
func stopSite(ctx context.Context) error {
	for {
		if err := stopWindowsService(ctx, serviceName); err != nil {
			return err
		}
		st, err := siteStatus()
		if err != nil || st.Win32ExitCode == 0 || st.Win32ExitCode == uint32(windows.ERROR_SERVICE_NEVER_STARTED) {
			return err
		}
		deadline := time.Now().Add(restartWindow)
		for st.State == svc.Stopped && time.Now().Before(deadline) {
			select {
			case <-ctx.Done():
				return fmt.Errorf("interrupted while the service %s stopped: %w", serviceName, ctx.Err())
			case <-time.After(servicePoll):
			}
			if st, err = siteStatus(); err != nil {
				return err
			}
		}
		if st.State == svc.Stopped {
			return nil // no restart came
		}
	}
}

// siteStatus is the status of the service xdesign, with the exit code of its last stop.
func siteStatus() (svc.Status, error) {
	s, err := openService(serviceName, windows.SERVICE_QUERY_STATUS)
	if err != nil {
		return svc.Status{}, err
	}
	if s == nil {
		return svc.Status{}, fmt.Errorf("the service %s does not exist", serviceName)
	}
	defer closeService(s)
	st, err := s.Query()
	if err != nil {
		return svc.Status{}, fmt.Errorf("ask the state of the service %s: %w", serviceName, err)
	}
	return st, nil
}

// leaveStopped stops the service xdesign when going back failed too, and leaves it
// stopped.
func leaveStopped(ctx context.Context, env *Env) {
	_ = env.Do("Stop-Service "+serviceName, func() error { return stopSite(ctx) }) // the failure is reported by the caller
}

// saveFailureLog keeps the end of the service's log (logs\xdesign.log: serve's lines and
// the app's output, Windows' journal of xDesign), with header on top, in
// C:\ProgramData\xDesign\update-failures\<UTC time>.log (section 6.3 step 7). It returns
// the file.
func saveFailureLog(_ context.Context, env *Env, at time.Time, header string) (string, error) {
	log := "(the service's log could not be read)"
	if data, err := env.Sys.FS.ReadFile(platform.ServiceLog); err == nil {
		lines := strings.Split(strings.ReplaceAll(strings.TrimRight(string(data), "\r\n"), "\r", ""), "\n")
		log = strings.Join(lines[max(0, len(lines)-failureJournalLines):], "\n")
	}
	name := filepath.Join(failureDir, at.UTC().Format("20060102T150405Z")+".log")
	text := header + "\n\nThe last " + fmt.Sprint(failureJournalLines) + " lines of the service's log (" + platform.ServiceLog + "):\n" +
		log + "\n"
	err := env.Do("write the end of "+platform.ServiceLog+" to "+name, func() error {
		if err := env.Sys.FS.MkdirAll(failureDir, 0o700); err != nil {
			return err
		}
		return env.Sys.FS.WriteFile(name, []byte(env.Masker().Mask(text)), 0o600, host.Owner{})
	})
	return name, err
}
