package install

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/guard"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// The second stage of an update (section 6.3 steps 3 to 8), copied from xWriter's
// update_stage2.go and cut: it runs in the new file's own code, writes the new release
// folder (release-files), backs the site up, stops xDesign, runs the new app's migrations,
// installs the new units, writes the guard's marker, switches /opt/xdesign/current, starts
// the new release and checks its health for up to two minutes. A step that fails after
// the stop goes back by itself (autoRollback). What differs on Windows (the services in
// place of the units, the current junction, the service manager's stop and start, the
// service's log in place of the journal) is in update_linux.go and update_windows.go
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.6).

const (
	// updateHealthWait is how long the start of an update waits for the new release to
	// answer (section 6.3 step 6).
	updateHealthWait = 120 * time.Second
	// guardWatchMargin is how long past the health check the guard leaves the way back to
	// the second stage: its going back takes a stop, maybe a restore, and a start.
	guardWatchMargin = 5 * time.Minute
	// stopTimeout bounds systemctl stop (and Stop-Service on Windows): the service stops
	// within 30 seconds (TimeoutStopSec).
	stopTimeout = 2 * time.Minute
	// failureJournalLines is how much of the journal (on Windows the service's log) a
	// failed update keeps.
	failureJournalLines = 200
	// keepReleases is how many release folders an update keeps: the current one and the
	// two before it (section 6.3 step 8).
	keepReleases = 3
)

// dataParts are the parts of the pre-update backup that going back puts back: the
// database and the media; the settings and the certificates stay as they are.
func dataParts() backup.Parts {
	return backup.Parts{Database: true, Media: true}
}

func (r *updateRun) stage2(ctx context.Context) int {
	// An update must not stop halfway: from here on no signal or cancelled context
	// interrupts it.
	ctx = context.WithoutCancel(ctx)
	signal.Ignore(syscall.SIGINT, syscall.SIGHUP, syscall.SIGTERM, syscall.SIGPIPE)
	r.env.Log().Printf("==== xdesign update (stage 2, file %s, from %s) ====", r.u.Build.Version, r.o.From)
	if err := r.prepareStage2(); err != nil {
		return r.fail(err)
	}
	if pr, ok := r.engine.Reporter.(*PacmanReporter); ok {
		pr.sections = r.sections() // the new version is known now
	}
	steps := []Step{
		r.stepProgramFiles(), r.stepBackup(), r.stepStop(), r.stepMigrate(), r.stepUnits(), r.stepSwitch(), r.stepStartNew(),
	}
	if _, err := r.engine.Run(ctx, steps); err != nil {
		if !r.stopped {
			r.removeStagingFolder()
			r.recordFailure() // before the stop: xDesign runs as before
			return r.fail(err)
		}
		return r.autoRollback(ctx, err)
	}
	return r.finish(ctx)
}

// prepareStage2 reads what the first stage found: install.json, the running release, the
// settings, and the build of this file.
func (r *updateRun) prepareStage2() error {
	st, found, err := ReadState(r.u.Sys.FS)
	if err != nil {
		return err
	}
	if !found {
		return fmt.Errorf("%s is missing", StatePath)
	}
	cur, err := currentRelease(r.u.Sys.FS)
	if err != nil {
		return err
	}
	if cur.Version != r.o.From {
		return fmt.Errorf("the update was started for xDesign %s, but %s runs now; run the update again", r.o.From, cur.Version)
	}
	cfg, err := readSiteConfig(r.u.Sys.FS)
	if err != nil {
		return err
	}
	next, err := inspectFile(r.u.Sys.FS, selfFile())
	if err != nil {
		return err
	}
	r.state, r.cur, r.cfg, r.next = st, cur, cfg, next
	if r.fileSum, err = fileSHA256(r.u.Sys.FS, selfFile()); err != nil {
		return fmt.Errorf("read the running file: %w", err)
	}
	return nil
}

// newDir is the new release's folder.
func (r *updateRun) newDir() string {
	return releaseDir(r.next.Version)
}

// stepProgramFiles writes the new release folder: this file writes itself and unpacks its
// payload into a staging folder (release-files), which is renamed into place (section 6.3
// step 4), and SELinux labels it where the installer found SELinux.
func (r *updateRun) stepProgramFiles() Step {
	return Step{Num: "6", ID: "program-files", Title: "Program files", Act: func(ctx context.Context, env *Env) error {
		fsys := r.u.Sys.FS
		target := r.newDir()
		if lexists(fsys, target) {
			ok, err := releaseComplete(fsys, target, r.fileSum)
			if err != nil {
				return err
			}
			if !ok {
				// A damaged copy of this version an earlier run left; program files only.
				if err := env.Do("rm -rf "+target, func() error { return fsys.RemoveAll(target) }); err != nil {
					return err
				}
			}
		}
		if !lexists(fsys, target) {
			suffix, err := randomString(r.u.Rand, basePathChars, 8)
			if err != nil {
				return err
			}
			r.staging = filepath.Join(releasesDir, stagingPrefix+suffix)
			cmd := host.Command(selfFile(), releaseFilesCommand, r.staging)
			if _, err := env.runWaiting(ctx, "unpacking Node.js and the website", cmd); err != nil {
				return err
			}
			if ok, err := releaseComplete(fsys, r.staging, r.fileSum); err != nil || !ok {
				return errors.Join(err, fmt.Errorf("%s is not complete after %s", r.staging, releaseFilesCommand))
			}
			staging := r.staging
			if err := env.Do(fmt.Sprintf("mv -T %s %s", staging, target), func() error { return fsys.Rename(staging, target) }); err != nil {
				return err
			}
			r.staging = ""
		}
		if r.state.SELinux.Enabled {
			if err := labelRelease(ctx, env, target); err != nil {
				return err
			}
		}
		env.Factf("release", "%s", target)
		return nil
	}}
}

// releaseComplete reports whether dir holds the release whose xdesign file has the
// SHA-256 sum, with Node.js and the app.
func releaseComplete(fsys host.FS, dir, sum string) (bool, error) {
	for _, name := range []string{releaseNode, releaseServer, releaseCLI} {
		if !exists(fsys, filepath.Join(dir, name)) {
			return false, nil
		}
	}
	have, err := fileSHA256(fsys, filepath.Join(dir, releaseSelf))
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return have == sum, nil
}

// labelRelease gives the release folder dir its SELinux labels, and its xdesign file the
// type bin_t when the policy does not (the installer's step 5).
func labelRelease(ctx context.Context, env *Env, dir string) error {
	if _, err := env.runWaiting(ctx, "labeling the files for SELinux", host.Command("restorecon", "-R", "-F", dir)); err != nil {
		return err
	}
	bin := filepath.Join(dir, releaseSelf)
	res, err := env.Query(ctx, host.Command("stat", "-c", "%C", bin))
	if err != nil || strings.Contains(res.Out(), selinuxBinType) {
		return err
	}
	_, err = env.Run(ctx, host.Command("chcon", "-t", "bin_t", bin))
	return err
}

// removeStagingFolder removes the staging folder of a release-files that did not finish.
func (r *updateRun) removeStagingFolder() {
	if r.staging == "" {
		return
	}
	dir := r.staging
	if err := r.env.Do("rm -rf "+dir, func() error { return r.u.Sys.FS.RemoveAll(dir) }); err != nil {
		r.env.Log().Printf("could not remove %s: %v", dir, err)
	}
}

// stepBackup is the pre-update backup (section 5.2): the database, the media, the settings
// and the certificates as the running release left them.
func (r *updateRun) stepBackup() Step {
	return Step{Num: "7", ID: "backup", Title: "Backup before the update", Act: func(ctx context.Context, env *Env) error {
		w := env.waiting(ctx, "backing up the database and the media")
		defer w.stop()
		var res backup.Result
		err := env.Do("xdesign backup (pre-update, xDesign "+r.cur.Version+")", func() error {
			var err error
			res, err = backup.Make(ctx, BackupOptions(r.cur.Version), backup.KindPreUpdate)
			if res.Path != "" {
				r.backup = res.Path
				return nil // a failure of the retention leaves the new backup made
			}
			return err
		})
		if err != nil {
			return err
		}
		env.Factf("backup", "%s (%s)", r.backup, backup.FormatBytes(res.Backup.Size))
		return nil
	}}
}

// stepStop stops the running release.
func (r *updateRun) stepStop() Step {
	return Step{Num: "8", ID: "stop", Title: "Stop xDesign " + r.cur.Version, Act: func(ctx context.Context, env *Env) error {
		r.stopped = true // from here on a failure goes back
		return stopService(ctx, env)
	}}
}

// stepMigrate runs the new app's migrations as the xdesign user, from the new release
// folder (section 6.3 step 4).
func (r *updateRun) stepMigrate() Step {
	return Step{Num: "9", ID: "migrations", Title: "Database migrations", Act: func(ctx context.Context, env *Env) error {
		r.migrated = true // a migration that failed may have changed part of the database
		_, err := env.runWaiting(ctx, "running the migrations of "+r.next.Version, appCmdIn(r.newDir(), "migrate"))
		return err
	}}
}

// stepSwitch writes the guard's marker and switches /opt/xdesign/current to the new
// release atomically (section 6.3 step 5; on Windows the current junction, pointCurrent).
func (r *updateRun) stepSwitch() Step {
	return Step{Num: "11", ID: "switch", Title: "Switch to " + r.next.Version, Act: func(ctx context.Context, env *Env) error {
		if err := r.armGuard(env); err != nil {
			return err
		}
		return pointCurrent(ctx, env, r.next.Version)
	}}
}

// armGuard writes the marker of the start-count guard (internal/guard): the old and the
// new file's SHA-256, the deadline, the time the second stage watches the start itself,
// and whether going back needs the pre-update backup.
func (r *updateRun) armGuard(env *Env) error {
	oldSum, err := fileSHA256(r.u.Sys.FS, filepath.Join(r.cur.Dir, releaseSelf))
	if err != nil {
		return err
	}
	owner, err := guardOwner(r.u.Sys)
	if err != nil {
		return err
	}
	restore, _ := r.restoreNeeded()
	now := r.now()
	m := guard.Marker{
		From: r.cur.Version, To: r.next.Version, SHA256: r.fileSum, OldSHA256: oldSum, Deadline: now.Add(guard.Grace),
		WatchedUntil: now.Add(updateHealthWait + guardWatchMargin), RestoreDB: restore,
	}
	return env.Do("write "+guard.Path(dataDir)+" (the update guard, "+guardWords+")", func() error {
		return guard.Arm(dataDir, m, owner)
	})
}

// disarmGuard removes the guard's marker.
func disarmGuard(env *Env) {
	err := env.Do("rm -f "+guard.Path(dataDir), func() error { return guard.Disarm(dataDir) })
	if err != nil {
		env.Log().Printf("could not remove the update guard's marker: %v", err)
	}
}

// stepStartNew starts the new release and checks its health (section 6.3 step 6).
func (r *updateRun) stepStartNew() Step {
	return Step{Num: "12", ID: "start", Title: "Start and health check", Act: func(ctx context.Context, env *Env) error {
		if err := startAndCheck(ctx, env, r.u, r.cfg, r.next.Version); err != nil {
			return err
		}
		disarmGuard(env) // the update stands
		return nil
	}}
}

// healthOf asks the front once, under the web base path (url is healthURL's): /api/health
// must report version, and the live server must answer a WebSocket upgrade of /live (101,
// or 401 without a session).
func healthOf(ctx context.Context, u *Updater, cfg *config.Config, url, version string) error {
	gctx, cancel := context.WithTimeout(ctx, healthTimeout)
	defer cancel()
	status, body, err := u.Get(gctx, url, cfg.Domain)
	if err != nil {
		return err
	}
	if status != 200 {
		return fmt.Errorf("GET %s: HTTP %d", url, status)
	}
	var health struct {
		OK      bool   `json:"ok"`
		Version string `json:"version"`
	}
	if err := json.Unmarshal(body, &health); err != nil || !health.OK {
		return fmt.Errorf("GET %s answered %q", url, strings.TrimSpace(string(body)))
	}
	if health.Version != version {
		return fmt.Errorf("GET %s reports xDesign %s, not %s", url, health.Version, version)
	}
	if u.Upgrade == nil {
		return nil
	}
	live := strings.TrimSuffix(url, "api/health") + "live"
	lctx, lcancel := context.WithTimeout(ctx, healthTimeout)
	defer lcancel()
	status, err = u.Upgrade(lctx, live, cfg.Domain, cfg.Origin())
	if err != nil {
		return err
	}
	if status != 101 && status != 401 {
		return fmt.Errorf("the live server did not answer a WebSocket upgrade of %s (HTTP %d)", live, status)
	}
	return nil
}

// finish records the update, gives Windows' list of installed apps the new version
// (apps_windows.go) and removes the old releases (section 6.3 step 8). It never fails the
// update: the new release runs.
func (r *updateRun) finish(ctx context.Context) int {
	var removed []string
	step := Step{Num: "13", ID: "finish", Title: "Finish", Act: func(_ context.Context, env *Env) error {
		r.state.CurrentVersion = r.next.Version
		r.state.History = append(r.state.History, HistoryEntry{
			At: r.now().Format(time.RFC3339), Action: ActionUpdate, From: r.cur.Version, Version: r.next.Version, Backup: r.backup,
		}.withTimes(r.progress))
		if err := env.Do("write "+StatePath, func() error { return WriteState(r.u.Sys.FS, r.state) }); err != nil {
			env.Warnf("%s could not be written: %v", StatePath, err)
		}
		var err error
		if removed, err = pruneReleases(env, r.next.Version, r.cur.Version); err != nil {
			env.Warnf("the old releases could not all be removed: %v", err)
		}
		if len(removed) > 0 {
			env.Factf("removed", "%s (the last %d releases are kept)", strings.Join(removed, ", "), keepReleases)
		}
		refreshAppsEntry(env, r.u.Sys.FS, r.next.Version)
		return nil
	}}
	_, _ = r.engine.Run(ctx, []Step{step})
	if r.o.JSON {
		r.writeResult(UpdateResult{Status: "updated", From: r.cur.Version, To: r.next.Version, Backup: r.backup, Log: r.o.logPath()})
		return exitOK
	}
	o := r.out
	o.line("")
	o.section(fmt.Sprintf("xDesign %s runs now.", r.next.Version))
	o.fact("from", r.cur.Version)
	o.fact("backup", r.backup)
	o.fact("go back", adminPrefix+"xdesign rollback --to "+r.cur.Version)
	return exitOK
}

// restoreNeeded decides section 6.3 step 7: the pre-update backup is put back when the
// migrations ran and the new release's schema floor is above the version before.
func (r *updateRun) restoreNeeded() (bool, string) {
	from, floor := r.cur.Version, r.next.SchemaFloor
	if !r.migrated {
		return false, "the database was not changed"
	}
	below, err := belowFloor(from, floor)
	switch {
	case err != nil:
		return true, err.Error()
	case below:
		return true, fmt.Sprintf("the changed database needs %s or newer (the schema floor of %s), and %s is older", floor, r.next.Version, from)
	}
	return false, fmt.Sprintf("%s reads the changed database (the schema floor of %s is %s)", from, r.next.Version, floor)
}

// autoRollback goes back to the release before after a step failed once xDesign was
// stopped (section 6.3 step 7): the journal saved, the guard's marker removed, current
// back, the pre-update backup put back when the database changed below what the old
// release reads, and the old release started and checked.
func (r *updateRun) autoRollback(ctx context.Context, cause error) int {
	from, to := r.cur.Version, r.next.Version
	failed := failedStep(cause)
	header := fmt.Sprintf("The update from %s to %s failed at step %q at %s: %v", from, to, failed.Title, r.now().Format(time.RFC3339),
		stepErrText(cause))
	r.env.Log().Printf("%s", header)
	failureLog, ferr := saveFailureLog(ctx, r.env, r.now(), header)
	if ferr != nil {
		r.env.Log().Printf("could not save the journal: %v", ferr)
		failureLog = ""
	}
	if r.text() {
		r.out.write("")
		r.errOut.line("")
		r.errOut.errorf("the update failed at step %q: %s", failed.Title, stepErrText(cause))
	}
	restore, why := r.restoreNeeded()
	steps := []Step{
		{Num: "R1", ID: "back-stop", Title: "Stop xDesign " + to, Act: func(ctx context.Context, env *Env) error {
			return stopService(ctx, env)
		}},
		{Num: "R2", ID: "back-switch", Title: "Switch back to " + from, Act: func(ctx context.Context, env *Env) error {
			disarmGuard(env)
			return pointCurrent(ctx, env, from)
		}},
		{Num: "R3", ID: "back-restore", Title: "Restore the data from the backup",
			Check: func(context.Context, *Env) (string, error) {
				if !restore {
					return "not needed: " + why, nil
				}
				return "", nil
			},
			Act: func(ctx context.Context, env *Env) error {
				env.Notef("needed: %s", why)
				if r.backup == "" {
					return errors.New("there is no backup from before the update, so the data cannot be put back")
				}
				return putBackData(ctx, env, from, r.backup)
			},
			Verify: func(context.Context, *Env) error { return nil },
		},
		{Num: "R4", ID: "back-start", Title: "Start xDesign " + from + " and check its health", Act: func(ctx context.Context, env *Env) error {
			return startAndCheck(ctx, env, r.u, r.cfg, from)
		}},
	}
	_, rbErr := r.engine.Run(ctx, steps)
	res := UpdateResult{From: from, To: to, Backup: r.backup, FailedStep: failed.ID, Log: r.o.logPath(), FailureLog: failureLog,
		Error: stepErrText(cause)}
	entry := HistoryEntry{At: r.now().Format(time.RFC3339), Action: ActionUpdate, From: from, Version: to, Backup: r.backup}.withTimes(r.progress)
	if rbErr != nil {
		leaveStopped(ctx, r.env) // the result is reported below
		entry.Result = ResultFailed
		r.recordHistory(entry, false)
		res.Status = "failed"
		res.Error = fmt.Sprintf("%s; going back to %s failed too: %s", res.Error, from, stepErrText(rbErr))
		if r.o.JSON {
			r.writeResult(res)
		} else {
			r.printRollbackFailed(failed, rbErr, restore, failureLog)
		}
		return exitFailed
	}
	entry.Result = ResultRolledBack
	r.recordHistory(entry, true)
	res.Status, res.RolledBack = "rolled_back", true
	if r.o.JSON {
		r.writeResult(res)
		return exitFailed
	}
	o := r.errOut
	o.line("")
	o.section(WentBackText(from, failureLog))
	o.fact("failed", fmt.Sprintf("step %s %s: %s", failed.Num, failed.Title, stepErrText(cause)))
	o.fact("log", r.o.logPath())
	return exitFailed
}

// WentBackText is the message of an update that went back by itself (section 6.2 step 5).
func WentBackText(from, failureLog string) string {
	text := fmt.Sprintf("The update went back by itself. xDesign %s runs.", from)
	if failureLog != "" {
		text += " The log is in " + failureLog
	}
	return text
}

// putBackData puts the data of the pre-update backup file back while xDesign is stopped,
// and runs the migrations of the release that runs now (current).
func putBackData(ctx context.Context, env *Env, version, file string) error {
	w := env.waiting(ctx, "putting the database and the media back")
	defer w.stop()
	err := env.Do("xdesign restore "+file+" (the database and the media)", func() error {
		return backup.PutBack(ctx, BackupOptions(version), file, dataParts())
	})
	if err != nil {
		return err
	}
	_, err = env.Run(ctx, appCmd("migrate"))
	return err
}

// recordHistory writes the outcome of a failed update into install.json; the current
// version is the version before again when rolledBack.
func (r *updateRun) recordHistory(e HistoryEntry, rolledBack bool) {
	if rolledBack {
		r.state.CurrentVersion = r.cur.Version
	}
	r.state.History = append(r.state.History, e)
	err := r.env.Do("write "+StatePath+" (failed update)", func() error { return WriteState(r.u.Sys.FS, r.state) })
	if err != nil {
		r.env.Log().Printf("could not write %s: %v", StatePath, err)
	}
}

// printRollbackFailed lists what the owner does when going back failed too: xDesign stays
// stopped.
func (r *updateRun) printRollbackFailed(failed Step, rbErr error, restore bool, failureLog string) {
	from, to := r.cur.Version, r.next.Version
	o := r.errOut
	rbStep := failedStep(rbErr)
	o.line("")
	o.errorf("the update to %s failed at step %q, and going back to %s failed too at step %q: %s", to, failed.Title, from, rbStep.Title,
		stepErrText(rbErr))
	if failureLog != "" {
		o.fact("details", failureLog)
	}
	o.fact("log", r.o.logPath())
	switch {
	case restore && r.backup != "":
		o.fact("bring back", fmt.Sprintf("%sxdesign rollback --to %s --restore-db", adminPrefix, from))
	default:
		o.fact("bring back", adminPrefix+"xdesign rollback --to "+from)
	}
	o.section("xDesign is stopped. If going back fails again, send the details file and the log to the developer.")
}

// failedStep returns the step a run failed at.
func failedStep(err error) Step {
	var stepErr *StepError
	if errors.As(err, &stepErr) {
		return stepErr.Step
	}
	return Step{ID: "unknown", Title: "unknown"}
}

// stepErrText returns the error of a failed step without the step's name.
func stepErrText(err error) string {
	var stepErr *StepError
	if errors.As(err, &stepErr) {
		return stepErr.Err.Error()
	}
	return err.Error()
}
