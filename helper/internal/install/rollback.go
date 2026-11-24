package install

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
	"github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// The rollback (docs/plan/07-server-install-update.md section 6.3: `sudo xdesign rollback
// [--to <version>] [--restore-db]`), copied from xWriter's rollback.go and cut: it goes back
// to a release this server keeps, with the data of the backup made before the update from
// it when the database changed in a way that release cannot read (or when the owner asks).
// The root helper runs it for "Roll back to <version>" and for the start-count guard of a
// new release that did not serve. On Windows it runs in a terminal opened as Administrator
// or in the maintenance service, and the switch moves the current junction (pointCurrent,
// docs/plan/18-third-owner-list-2026-11-23.md section 8.6).

// RollbackOptions are the flags of `xdesign rollback`.
type RollbackOptions struct {
	// To is the version to go back to; empty means the release before the running one.
	To string
	// RestoreDB also puts back the database and the media of the backup made before the
	// update from To; it is needed when the running release's schema floor is above To.
	RestoreDB bool
	// Guard reports a rollback the start-count guard asked for: the words say that the
	// update went back by itself.
	Guard   bool
	Yes     bool
	JSON    bool
	LogPath string
}

func (o RollbackOptions) logPath() string {
	if o.LogPath == "" {
		return DefaultLogPath
	}
	return o.LogPath
}

// Validate checks the options alone.
func (o RollbackOptions) Validate() error {
	if o.JSON && !o.Yes {
		return fmt.Errorf("%w: --json needs --yes: questions cannot be asked while the output is JSON", ErrUsage)
	}
	if o.To != "" {
		if _, err := buildinfo.ParseVersion(o.To); err != nil {
			return fmt.Errorf("%w: --to %q is not a version such as 1.0.0", ErrUsage, o.To)
		}
	}
	return nil
}

// RollbackResult is the final object of --json.
type RollbackResult struct {
	// Status is "rolled_back" or "failed".
	Status string `json:"status"`
	From   string `json:"from"`
	To     string `json:"to"`
	// RestoredData is the backup whose database and media were put back.
	RestoredData string `json:"restored_data,omitempty"`
	// SafetyBackup is the backup made before the data was replaced.
	SafetyBackup string `json:"safety_backup,omitempty"`
	FailedStep   string `json:"failed_step"`
	Log          string `json:"log"`
	Error        string `json:"error,omitempty"`
}

// rollbackRun is one run of the rollback.
type rollbackRun struct {
	u        *Updater
	o        RollbackOptions
	env      *Env
	engine   *Engine
	out      *printer
	errOut   *printer
	progress *Plan

	state  State
	cur    Release
	target Release
	cfg    *config.Config
	// data is the pre-update backup of the target whose data a --restore-db puts back,
	// safety the backup made before; replaced reports that the data was put back.
	data, safety string
	stopped      bool
	replaced     bool
}

// rollbackSteps are the rollback's steps in the order they run.
func rollbackSteps() stepList {
	return stepList{
		step("target", 2, secs(2)),  // the kept release and its build information
		step("data", 1, secs(1)),    // the schema floor and the backups
		step("safety", 6, secs(6)),  // a backup of the site, with --restore-db
		step("stop", 3, secs(3)),    // the service stops within 30 seconds
		step("switch", 1, secs(1)),  // the links
		step("restore", 6, secs(6)), // the database and the media, with --restore-db
		step("start", 10, secs(10)), // the start and the health check
		step("finish", 1, secs(1)),  // install.json
	}
}

// Rollback is `sudo xdesign rollback`, with the Updater's system, streams and health
// check. It returns the exit status: 0 when the release before runs, 1 otherwise, 2 for
// invalid options.
func (u *Updater) Rollback(ctx context.Context, o RollbackOptions) int {
	if err := o.Validate(); err != nil {
		fmt.Fprintf(u.Stderr, "xdesign rollback: %v\n", strings.TrimPrefix(err.Error(), ErrUsage.Error()+": "))
		return exitUsage
	}
	r := &rollbackRun{u: u, o: o}
	r.out = newPrinter(u.Stdout, u.Color, u.Terminal)
	r.errOut = newPrinter(u.Stderr, u.Color, false)
	masker := &Masker{}
	log, closer, err := OpenLog(u.Sys.FS, o.logPath(), masker)
	if err != nil {
		fmt.Fprintf(u.Stderr, "xdesign rollback: %v\n", err)
		return exitFailed
	}
	defer func() { _ = closer.Close() }() // the log; a failed close cannot be reported anywhere useful
	r.env = NewEnv(u.Sys, log, masker, false)
	var out *printer
	if !o.JSON {
		out = r.out
	}
	var reporter Reporter
	reporter, r.progress = newReporter(reporterSpec{
		Stdout: u.Stdout, Stderr: u.Stderr, Terminal: u.Terminal, JSON: o.JSON,
		Steps: rollbackSteps(), Family: systemFamily(u.Sys.FS), Out: out, Sections: r.sections(),
	})
	r.engine = &Engine{Env: r.env, Reporter: reporter}
	return r.main(ctx)
}

// sections maps the rollback's steps to the sections of its output.
func (r *rollbackRun) sections() map[string]string {
	m := map[string]string{}
	add := func(title string, ids ...string) {
		for _, id := range ids {
			m[id] = title
		}
	}
	to, from := r.target.Version, r.cur.Version
	if to == "" {
		to = "the release before"
	}
	add("Checking the rollback...", "target", "data")
	add("Going back to xDesign "+to+"...", "safety", "stop", "switch", "restore", "start")
	add("Finishing...", "finish")
	add("Starting xDesign "+from+" again...", "back-stop", "back-switch", "back-restore", "back-start")
	return m
}

func (r *rollbackRun) main(ctx context.Context) int {
	ctx = context.WithoutCancel(ctx) // a rollback must not stop halfway
	r.env.Log().Printf("==== xdesign rollback (to %q, restore data %t, guard %t) ====", r.o.To, r.o.RestoreDB, r.o.Guard)
	if _, err := r.engine.Run(ctx, []Step{r.stepTarget(), r.stepData()}); err != nil {
		return r.fail(err)
	}
	if pr, ok := r.engine.Reporter.(*PacmanReporter); ok {
		pr.sections = r.sections() // the versions are known now
	}
	if !r.o.Yes {
		ok, err := r.confirm()
		if err != nil {
			return r.fail(err)
		}
		if !ok {
			return r.fail(errAborted)
		}
	}
	steps := []Step{r.stepSafety(), r.stepStop(), r.stepSwitch(), r.stepRestore(), r.stepStart()}
	if _, err := r.engine.Run(ctx, steps); err != nil {
		if !r.stopped {
			return r.fail(err)
		}
		return r.goBack(ctx, err)
	}
	return r.finish(ctx)
}

// stepTarget finds the release to go back to (section 6.3): a kept release older than the
// running one, of this server's CPU.
func (r *rollbackRun) stepTarget() Step {
	return Step{Num: "1", ID: "target", Title: "Release to go back to", ReadOnly: true, Act: func(_ context.Context, env *Env) error {
		fsys := r.u.Sys.FS
		if !elevated(r.u.Sys.Machine) {
			return notAdmin("xdesign rollback", "xdesign rollback")
		}
		st, found, err := ReadState(fsys)
		if err != nil {
			return err
		}
		if !found || st.Status != StateInstalled {
			return fmt.Errorf("xDesign is not installed on this server, or its installation did not finish (%s)", StatePath)
		}
		cur, err := currentRelease(fsys)
		if err != nil {
			return err
		}
		cfg, err := readSiteConfig(fsys)
		if err != nil {
			return err
		}
		r.state, r.cur, r.cfg = st, cur, cfg
		r.progress.LearnTimes(st.History)
		to := r.o.To
		if to == "" {
			if to = previousVersion(fsys, st, cur.Version); to == "" {
				return fmt.Errorf("there is no earlier release to go back to: %s holds only %s", releasesDir, cur.Version)
			}
		}
		if to == cur.Version {
			return fmt.Errorf("xDesign %s runs already", to)
		}
		if c, err := buildinfo.CompareVersions(to, cur.Version); err == nil && c > 0 {
			return fmt.Errorf("xDesign %s is newer than the running %s; going forward is an update: %sxdesign update FILE", to, cur.Version,
				adminPrefix)
		}
		if !lexists(fsys, releaseDir(to)) {
			return fmt.Errorf("xDesign %s is not kept on this server any more (the last %d releases are kept). Install it with its file "+
				"instead", to, keepReleases)
		}
		target, err := readRelease(fsys, releaseDir(to))
		if err != nil {
			return fmt.Errorf("the files of xDesign %s cannot be used (%w); install it with its file instead", to, err)
		}
		machine, err := r.u.Sys.Machine.Arch()
		if err != nil {
			return fmt.Errorf("read the CPU architecture: %w", err)
		}
		if arch := goArch(machine); target.Info.Arch != arch {
			return fmt.Errorf("the folder of xDesign %s holds the %s build, but this server is %s", to, target.Info.Arch, arch)
		}
		r.target = target
		env.Factf("versions", "%s to %s (%s)", cur.Version, to, target.Dir)
		return nil
	}}
}

// previousVersion returns the version the rollback goes back to by default: the newest
// version older than current in the history of install.json whose release folder is kept,
// otherwise the newest kept release older than current; "" when there is none.
func previousVersion(fsys host.FS, st State, current string) string {
	older := func(v string) bool {
		if v == "" || v == current {
			return false
		}
		c, err := buildinfo.CompareVersions(v, current)
		return err == nil && c < 0
	}
	for _, h := range slices.Backward(st.History) {
		for _, v := range []string{h.From, h.Version} {
			if older(v) && exists(fsys, filepath.Join(releaseDir(v), releaseSelf)) {
				return v
			}
		}
	}
	rels, _, err := installedReleases(fsys)
	if err != nil {
		return ""
	}
	for _, rel := range rels {
		if older(rel.Version) {
			return rel.Version
		}
	}
	return ""
}

// stepData compares the target with the schema floor of the running release: below it,
// the target cannot read the database, and going back needs --restore-db, which puts the
// backup made before the update from the target back.
func (r *rollbackRun) stepData() Step {
	return Step{Num: "2", ID: "data", Title: "Database", ReadOnly: true, Act: func(_ context.Context, env *Env) error {
		to, cur := r.target.Version, r.cur.Version
		below, err := belowFloor(to, r.cur.Info.SchemaFloor)
		if err != nil {
			return err
		}
		if below && !r.o.RestoreDB {
			return fmt.Errorf("xDesign %s changed the database in a way %s cannot read (its schema floor is %s). Go back with "+
				"%sxdesign rollback --to %s --restore-db: it puts back the data of the backup made before the update from %s",
				cur, to, r.cur.Info.SchemaFloor, adminPrefix, to, to)
		}
		if !r.o.RestoreDB {
			env.Factf("data", "kept: %s reads the database of %s", to, cur)
			return nil
		}
		e, file, err := PreUpdateBackup(to)
		if err != nil {
			return err
		}
		r.data = file
		env.Factf("data", "back to the backup %s (made %s UTC)", e.Name, e.CreatedAt.UTC().Format("2006-01-02 15:04"))
		return nil
	}}
}

// PreUpdateBackup returns the newest backup made before an update from version, and its
// archive: the data "Also restore the data from before the update" puts back.
func PreUpdateBackup(version string) (backup.Entry, string, error) {
	o := BackupOptions(version)
	l, err := backup.List(o.Dir())
	if err != nil {
		return backup.Entry{}, "", err
	}
	for _, e := range l.Backups {
		if e.Kind == backup.KindPreUpdate && e.Version == version {
			_, file, err := backup.Find(o.Dir(), e.Name)
			return e, file, err
		}
	}
	return backup.Entry{}, "", fmt.Errorf("there is no backup made before an update from xDesign %s in %s, so its data cannot be put back",
		version, o.Dir())
}

// confirm asks the question of the rollback.
func (r *rollbackRun) confirm() (bool, error) {
	r.out.line("")
	ask := &prompter{in: bufio.NewReader(r.u.Stdin), out: r.out}
	question := fmt.Sprintf("Go back from xDesign %s to %s?", r.cur.Version, r.target.Version)
	if r.o.RestoreDB {
		question = fmt.Sprintf("Go back from xDesign %s to %s, with the data from before the update?", r.cur.Version, r.target.Version)
	}
	ok, err := ask.confirm(question, true)
	if errors.Is(err, errNoAnswer) {
		return false, errors.New("no answer: standard input ended. Run " + adminPrefix + "xdesign rollback --yes to go back without the " +
			"question")
	}
	return ok, err
}

// stepSafety backs the site up before its data is replaced.
func (r *rollbackRun) stepSafety() Step {
	return Step{Num: "3", ID: "safety", Title: "Backup of the site now",
		Check: func(context.Context, *Env) (string, error) {
			if !r.o.RestoreDB {
				return "the data is kept", nil
			}
			return "", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			w := env.waiting(ctx, "backing up the database and the media")
			defer w.stop()
			return env.Do("xdesign backup (pre-update, xDesign "+r.cur.Version+")", func() error {
				res, err := backup.Make(ctx, BackupOptions(r.cur.Version), backup.KindPreUpdate)
				if res.Path != "" {
					r.safety = res.Path
					return nil
				}
				return err
			})
		},
		Verify: func(context.Context, *Env) error { return nil },
	}
}

func (r *rollbackRun) stepStop() Step {
	return Step{Num: "4", ID: "stop", Title: "Stop xDesign " + r.cur.Version, Act: func(ctx context.Context, env *Env) error {
		r.stopped = true
		return stopService(ctx, env)
	}}
}

func (r *rollbackRun) stepSwitch() Step {
	return Step{Num: "5", ID: "switch", Title: "Switch to " + r.target.Version, Act: func(ctx context.Context, env *Env) error {
		disarmGuard(env)
		return pointCurrent(ctx, env, r.target.Version)
	}}
}

func (r *rollbackRun) stepRestore() Step {
	return Step{Num: "6", ID: "restore", Title: "Restore the data",
		Check: func(context.Context, *Env) (string, error) {
			if !r.o.RestoreDB {
				return "the data is kept", nil
			}
			return "", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			r.replaced = true
			return putBackData(ctx, env, r.target.Version, r.data)
		},
		Verify: func(context.Context, *Env) error { return nil },
	}
}

func (r *rollbackRun) stepStart() Step {
	return Step{Num: "7", ID: "start", Title: "Start and health check", Act: func(ctx context.Context, env *Env) error {
		return startAndCheck(ctx, env, r.u, r.cfg, r.target.Version)
	}}
}

// finish records the rollback and gives Windows' list of installed apps the version it went
// back to (apps_windows.go).
func (r *rollbackRun) finish(ctx context.Context) int {
	step := Step{Num: "8", ID: "finish", Title: "Finish", Act: func(_ context.Context, env *Env) error {
		r.state.CurrentVersion = r.target.Version
		r.state.History = append(r.state.History, HistoryEntry{
			At: time.Now().UTC().Format(time.RFC3339), Action: ActionRollback, From: r.cur.Version, Version: r.target.Version,
			Backup: r.data,
		}.withTimes(r.progress))
		if err := env.Do("write "+StatePath, func() error { return WriteState(r.u.Sys.FS, r.state) }); err != nil {
			env.Warnf("%s could not be written: %v", StatePath, err)
		}
		refreshAppsEntry(env, r.u.Sys.FS, r.target.Version)
		return nil
	}}
	_, _ = r.engine.Run(ctx, []Step{step})
	if r.o.JSON {
		r.writeResult(RollbackResult{Status: "rolled_back", From: r.cur.Version, To: r.target.Version, RestoredData: r.data,
			SafetyBackup: r.safety, Log: r.o.logPath()})
		return exitOK
	}
	o := r.out
	o.line("")
	o.section(fmt.Sprintf("xDesign %s runs now.", r.target.Version))
	o.fact("from", r.cur.Version)
	if r.data != "" {
		o.fact("data", "from "+r.data)
		o.fact("before", r.safety+" (the site as it was before the rollback)")
	}
	return exitOK
}

// goBack starts the release that ran again after a step failed once it was stopped: the
// data it had is put back from the safety backup when it was replaced.
func (r *rollbackRun) goBack(ctx context.Context, cause error) int {
	from, to := r.cur.Version, r.target.Version
	failed := failedStep(cause)
	if r.text() {
		r.out.write("")
		r.errOut.line("")
		r.errOut.errorf("going back to %s failed at step %q: %s", to, failed.Title, stepErrText(cause))
	}
	steps := []Step{
		{Num: "B1", ID: "back-stop", Title: "Stop xDesign", Act: func(ctx context.Context, env *Env) error {
			return stopService(ctx, env)
		}},
		{Num: "B2", ID: "back-switch", Title: "Switch back to " + from, Act: func(ctx context.Context, env *Env) error {
			return pointCurrent(ctx, env, from)
		}},
		{Num: "B3", ID: "back-restore", Title: "Put back the data from before the rollback",
			Check: func(context.Context, *Env) (string, error) {
				if !r.replaced {
					return "the data was not replaced", nil
				}
				return "", nil
			},
			Act: func(ctx context.Context, env *Env) error {
				if r.safety == "" {
					return errors.New("there is no backup from before the rollback")
				}
				return putBackData(ctx, env, from, r.safety)
			},
			Verify: func(context.Context, *Env) error { return nil },
		},
		{Num: "B4", ID: "back-start", Title: "Start xDesign " + from + " and check its health", Act: func(ctx context.Context, env *Env) error {
			return startAndCheck(ctx, env, r.u, r.cfg, from)
		}},
	}
	_, rbErr := r.engine.Run(ctx, steps)
	res := RollbackResult{Status: "failed", From: from, To: to, SafetyBackup: r.safety, FailedStep: failed.ID, Log: r.o.logPath(),
		Error: stepErrText(cause)}
	if rbErr != nil {
		res.Error = fmt.Sprintf("%s; starting %s again failed too: %s", res.Error, from, stepErrText(rbErr))
	}
	if r.o.JSON {
		r.writeResult(res)
		return exitFailed
	}
	o := r.errOut
	o.line("")
	if rbErr != nil {
		o.errorf("starting xDesign %s again failed too at step %q: %s", from, failedStep(rbErr).Title, stepErrText(rbErr))
		o.fact("log", r.o.logPath())
		o.section("xDesign is stopped. Send the log to the developer.")
		return exitFailed
	}
	o.section(fmt.Sprintf("The rollback failed, and xDesign %s runs as before.", from))
	o.fact("log", r.o.logPath())
	return exitFailed
}

func (r *rollbackRun) text() bool { return !r.o.JSON }

// fail prints the failure block of a rollback that changed nothing (or the --json result).
func (r *rollbackRun) fail(err error) int {
	var stepErr *StepError
	step := ""
	if errors.As(err, &stepErr) {
		step = stepErr.Step.ID
		err = stepErr.Err
	}
	r.env.Log().Printf("rollback failed: %v", err)
	if r.o.JSON {
		r.writeResult(RollbackResult{Status: "failed", From: r.cur.Version, To: r.target.Version, FailedStep: step, Log: r.o.logPath(),
			Error: err.Error()})
		return exitFailed
	}
	r.out.write("")
	if errors.Is(err, errAborted) {
		r.out.line("")
		r.out.section(upperFirst(err.Error()))
		return exitFailed
	}
	o := r.errOut
	o.line("")
	o.errorf("the rollback failed: %v", err)
	o.fact("log", r.o.logPath())
	o.section("Nothing was changed.")
	return exitFailed
}

// writeResult prints the --json result.
func (r *rollbackRun) writeResult(res RollbackResult) {
	b, err := json.MarshalIndent(res, "", "  ")
	if err != nil {
		return
	}
	fmt.Fprintf(r.u.Stdout, "%s\n", b)
}
