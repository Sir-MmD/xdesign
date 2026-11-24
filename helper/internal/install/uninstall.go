package install

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
)

// The uninstall (docs/plan/07-server-install-update.md section 7: `uninstall`, "Keep the
// data" or "Remove everything", a backup offered first), copied from xWriter's
// install/uninstall.go (its `admin uninstall`, cmd_uninstall.go and deploy/uninstall.sh)
// and cut: no PostgreSQL, no box, command-line AIs or proxy engine. It undoes what the
// installer recorded in install.json: the units, the firewall ports and, when the owner
// asks, the SELinux port labels; each step is skipped when there is nothing of it. "Keep
// the data" leaves /etc/xdesign and /var/lib/xdesign with the xdesign user, so the
// installer picks them up again; "Remove everything" deletes them too, after a final
// backup in /root/xdesign-final-<time>/ when the owner wants one. On Windows
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.7) the same flow removes the two
// services, the firewall rules, the PATH entry, C:\Program Files\xDesign and the entry in
// Windows' list of installed apps, and "Remove everything" C:\ProgramData\xDesign. Each
// system's steps are in uninstall_linux.go and uninstall_windows.go, with the start of the
// uninstall that Maintenance > Uninstall xDesign asks for
// (docs/plan/19-uninstall-2026-11-24.md section 5): PrepareUninstaller and
// StartUninstaller.

// UninstallOptions are the flags of `sudo xdesign --uninstall`.
type UninstallOptions struct {
	// KeepData and RemoveAll choose "Keep the data" or "Remove everything" without the
	// question; one of them is needed with --yes.
	KeepData, RemoveAll bool
	// Backup and NoBackup answer "Make a backup first?"; --yes makes one unless NoBackup.
	Backup, NoBackup bool
	// UndoSELinux also removes the SELinux port labels the installer added; without it
	// --yes leaves them.
	UndoSELinux bool
	Yes         bool
	JSON        bool
	DryRun      bool
	LogPath     string
}

func (o UninstallOptions) logPath() string {
	if o.LogPath == "" {
		return DefaultLogPath
	}
	return o.LogPath
}

// Validate checks the options alone.
func (o UninstallOptions) Validate() error {
	switch {
	case o.KeepData && o.RemoveAll:
		return fmt.Errorf("%w: give --keep-data or --remove-everything, not both", ErrUsage)
	case o.Backup && o.NoBackup:
		return fmt.Errorf("%w: give --backup or --no-backup, not both", ErrUsage)
	case o.JSON && !o.Yes && !o.DryRun:
		return fmt.Errorf("%w: --json needs --yes: questions cannot be asked while the output is JSON", ErrUsage)
	case o.Yes && !o.KeepData && !o.RemoveAll:
		return fmt.Errorf("%w: --yes needs --keep-data or --remove-everything", ErrUsage)
	}
	return nil
}

// UninstallResult is the final object of --json.
type UninstallResult struct {
	// Status is "uninstalled" (the data kept), "removed" (everything deleted), "planned"
	// (dry run) or "failed".
	Status string `json:"status"`
	// Mode is "keep" or "remove".
	Mode string `json:"mode"`
	// Backup is the backup made first.
	Backup string `json:"backup,omitempty"`
	// Remains lists what is left on the server and how to remove it.
	Remains    []string `json:"remains"`
	FailedStep string   `json:"failed_step"`
	Log        string   `json:"log"`
	Error      string   `json:"error,omitempty"`
}

type uninstallRun struct {
	u        *Updater
	o        UninstallOptions
	env      *Env
	engine   *Engine
	out      *printer
	errOut   *printer
	progress *Plan

	state    State
	hasState bool
	// units are the systemd units of xDesign on Linux, its services on Windows.
	units []string
	// version is the installed version, which the backup records.
	version string
	// remove is "Remove everything"; backup that a backup is made first; selinux that the
	// SELinux settings are undone.
	remove, backup, selinux bool
	// backupPath is the backup made first; manual are things the owner must still do by
	// hand.
	backupPath string
	manual     []string
	// moved is where the Windows uninstall moved its own running file out of the program
	// folder (uninstall_windows.go); Windows deletes it at the next restart.
	moved string
}

// Uninstall is `sudo xdesign --uninstall`, with the Updater's system and streams. It
// returns the exit status: 0 when done (or the dry run passed), 1 when a step failed, 2 for
// invalid options.
func (u *Updater) Uninstall(ctx context.Context, o UninstallOptions) int {
	if err := o.Validate(); err != nil {
		fmt.Fprintf(u.Stderr, "xdesign --uninstall: %v\n", strings.TrimPrefix(err.Error(), ErrUsage.Error()+": "))
		return exitUsage
	}
	r := &uninstallRun{u: u, o: o, remove: o.RemoveAll}
	r.out = newPrinter(u.Stdout, u.Color, u.Terminal)
	r.errOut = newPrinter(u.Stderr, u.Color, false)
	masker := &Masker{}
	if o.DryRun {
		r.env = NewEnv(u.Sys, nil, masker, true)
	} else {
		log, closer, err := OpenLog(u.Sys.FS, o.logPath(), masker)
		if err != nil {
			fmt.Fprintf(u.Stderr, "xdesign --uninstall: %v\n", err)
			return exitFailed
		}
		defer func() { _ = closer.Close() }() // the log; a failed close cannot be reported anywhere useful
		r.env = NewEnv(u.Sys, log, masker, false)
	}
	var out *printer
	if !o.JSON {
		out = r.out
	}
	var reporter Reporter
	reporter, r.progress = newReporter(reporterSpec{
		Stdout: u.Stdout, Stderr: u.Stderr, Terminal: u.Terminal, JSON: o.JSON, DryRun: o.DryRun,
		Steps: uninstallSteps(), Family: systemFamily(u.Sys.FS), Out: out, Sections: uninstallSections(),
	})
	r.engine = &Engine{Env: r.env, Reporter: reporter}
	code := r.main(ctx)
	r.removeCopy()
	return code
}

// uninstallerTimeLayout is the time in the name of the uninstall that Maintenance >
// Uninstall xDesign starts: its transient unit on Linux, its copy's folder on Windows.
const uninstallerTimeLayout = "20060102T150405Z"

// UninstallArgs are the arguments of the uninstall that Maintenance > Uninstall xDesign
// starts (docs/plan/19-uninstall-2026-11-24.md section 5): no questions, the owner's
// choice, no backup (the panel offered one) and, with "Remove everything" on Linux, the
// SELinux settings undone too.
func UninstallArgs(keepData bool) []string {
	args := []string{"--uninstall", "--yes"}
	if keepData {
		return append(args, "--keep-data", "--no-backup")
	}
	return append(append(args, "--remove-everything", "--no-backup"), removeEverythingFlags()...)
}

func (r *uninstallRun) mode() string {
	if r.remove {
		return "remove"
	}
	return "keep"
}

func (r *uninstallRun) main(ctx context.Context) int {
	r.env.Log().Printf("==== xdesign --uninstall (keep %t, remove %t, dry run %t) ====", r.o.KeepData, r.o.RemoveAll, r.o.DryRun)
	if _, err := r.engine.Run(ctx, []Step{r.stepFind()}); err != nil {
		return r.fail(err)
	}
	r.backup = !r.o.NoBackup && (r.o.Yes || r.o.Backup || r.o.DryRun)
	r.selinux = r.o.UndoSELinux
	if !r.o.Yes && !r.o.DryRun {
		ok, err := r.ask()
		if err != nil {
			return r.fail(err)
		}
		if !ok {
			return r.fail(errAborted)
		}
	}
	r.progress.Restart() // the time the owner took to answer is not the uninstall's
	// Once things are removed, finish: Ctrl+C does not stop the uninstall halfway (running
	// it again continues anyway).
	ctx = context.WithoutCancel(ctx)
	steps := r.systemSteps()
	for i := range steps {
		steps[i].Num = strconv.Itoa(i + 2)
	}
	if _, err := r.engine.Run(ctx, steps); err != nil {
		r.recordFailure()
		return r.fail(err)
	}
	return r.succeed()
}

// stepFind reads what is installed; it changes nothing.
func (r *uninstallRun) stepFind() Step {
	return Step{Num: "1", ID: "find", Title: "What is installed", ReadOnly: true, Act: func(_ context.Context, env *Env) error {
		fsys := r.u.Sys.FS
		if err := r.checkAdmin(env); err != nil {
			return err
		}
		st, found, err := ReadState(fsys)
		if err != nil {
			env.Warnf("%v; the uninstall goes on with what it finds", err)
		}
		r.state, r.hasState = st, found
		r.version = st.CurrentVersion
		if cur, err := currentRelease(fsys); err == nil {
			r.version = cur.Version
		}
		if r.version == "" {
			r.version = r.u.Build.Version
		}
		if r.units, err = r.findServices(fsys); err != nil {
			return err
		}
		switch {
		case found && st.CurrentVersion != "":
			env.Factf("installed", "xDesign %s (%s)", st.CurrentVersion, StatePath)
		case !found:
			env.Notef("%s is missing: the uninstall removes what it finds", StatePath)
		}
		if len(r.units) > 0 {
			env.Factf(servicesLabel, "%s", strings.Join(r.units, ", "))
		}
		var present []string
		for _, p := range programPaths() {
			if lexists(fsys, p) {
				present = append(present, p)
			}
		}
		if len(present) > 0 {
			env.Factf("files", "%s", strings.Join(present, ", "))
		}
		if len(st.Firewall.Ports) > 0 {
			env.Factf("firewall", "TCP ports %s in %s", joinPorts(st.Firewall.Ports), st.Firewall.Tool)
		}
		if len(r.units) == 0 && len(present) == 0 {
			env.Notef("no program files of xDesign were found")
		}
		return nil
	}}
}

// selinuxChanges are the SELinux settings the installer made, in words for the question.
func (r *uninstallRun) selinuxChanges() []string {
	var out []string
	for _, p := range r.state.SELinux.PortsAdded {
		out = append(out, fmt.Sprintf("semanage port -d -t http_port_t -p tcp %d", p))
	}
	return out
}

// ask asks the uninstall's questions: keep the data or remove everything, a backup first,
// the SELinux settings, and the last word.
func (r *uninstallRun) ask() (bool, error) {
	ask := &prompter{in: bufio.NewReader(r.u.Stdin), out: r.out}
	noAnswer := func(err error) error {
		if errors.Is(err, errNoAnswer) {
			return errors.New("no answer: standard input ended. Run " + adminPrefix + "xdesign --uninstall --yes with --keep-data or " +
				"--remove-everything to uninstall without questions")
		}
		return err
	}
	r.out.line("")
	if !r.o.KeepData && !r.o.RemoveAll {
		r.out.line("   1  Keep the data: the database, the media, the backups, the settings and the certificates stay, and the " +
			"installer uses them again")
		r.out.line("   2  Remove everything: " + removeEverythingWords)
		choice, err := ask.ask("Keep the data or remove everything?", "1", func(s string) string {
			if s != "1" && s != "2" {
				return "please answer 1 or 2"
			}
			return ""
		})
		if err != nil {
			return false, noAnswer(err)
		}
		r.remove = choice == "2"
	}
	if !r.o.Backup && !r.o.NoBackup && lexists(r.u.Sys.FS, filepath.Join(dataDir, backup.DatabaseName)) {
		where := "it stays in " + backupsFolder()
		if r.remove {
			where = "it is saved in " + finalBackupPrefix() + "<time>" + string(filepath.Separator) + ", outside the data that is deleted"
		}
		ok, err := ask.confirm("Make a backup first ("+where+")?", true)
		if err != nil {
			return false, noAnswer(err)
		}
		r.backup = ok
	}
	if changes := r.selinuxChanges(); !r.o.UndoSELinux && len(changes) > 0 {
		ok, err := ask.confirm("Undo the SELinux settings xDesign made ("+strings.Join(changes, "; ")+")? Other programs may need them.",
			false)
		if err != nil {
			return false, noAnswer(err)
		}
		r.selinux = ok
	}
	question := "Uninstall xDesign and keep its data?"
	if r.remove {
		question = "Remove xDesign and all its data for good?"
	}
	ok, err := ask.confirm(question, !r.remove)
	return ok, noAnswer(err)
}

// stepBackup makes the backup offered first: with "Keep the data" in the backups' folder,
// with "Remove everything" copied to a folder outside the data (keepFinal).
func (r *uninstallRun) stepBackup() Step {
	return Step{ID: "backup", Title: "Backup first",
		Check: func(context.Context, *Env) (string, error) {
			switch {
			case !r.backup:
				return "not asked for", nil
			case !lexists(r.u.Sys.FS, filepath.Join(dataDir, backup.DatabaseName)):
				return "there is no database to back up", nil
			}
			return "", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			w := env.waiting(ctx, "backing up the database and the media")
			defer w.stop()
			var res backup.Result
			err := env.Do("xdesign backup (manual, xDesign "+r.version+")", func() error {
				var err error
				res, err = backup.Make(ctx, BackupOptions(r.version), backup.KindManual)
				if res.Path != "" {
					return nil // a failure of the retention leaves the backup made
				}
				return err
			})
			if err != nil || env.DryRun {
				return err
			}
			r.backupPath = res.Path
			if !r.remove {
				env.Factf("backup", "%s (%s)", res.Path, backup.FormatBytes(res.Backup.Size))
				return nil
			}
			dir := finalBackupPrefix() + time.Now().UTC().Format("20060102T150405Z")
			if err := r.keepFinal(ctx, env, dir, []string{res.Path, strings.TrimSuffix(res.Path, backup.Ext) + backup.MetaExt}); err != nil {
				return err
			}
			r.backupPath = filepath.Join(dir, filepath.Base(res.Path))
			env.Factf("backup", "%s (%s): copy it off the server", r.backupPath, backup.FormatBytes(res.Backup.Size))
			return nil
		},
		Verify: func(context.Context, *Env) error { return nil },
	}
}

// stepFirewall removes the firewall rules the installer added (install.json).
func (r *uninstallRun) stepFirewall() Step {
	return Step{ID: "firewall", Title: "Firewall rules",
		Check: func(context.Context, *Env) (string, error) {
			if !r.hasState || len(r.state.Firewall.Ports) == 0 {
				return "the installer opened no firewall ports", nil
			}
			return "", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			fw, err := uninstallFirewall(ctx, env)
			if err != nil {
				return err
			}
			tool := r.state.Firewall.Tool
			for _, port := range slices.Clone(r.state.Firewall.Ports) {
				switch {
				case fw.Tool == "":
					env.Notef("TCP port %d: no firewall is active any more, so there is no rule to remove", port)
				case fw.Tool != tool:
					msg := fmt.Sprintf("the installer opened TCP port %d in %s, but the active firewall is %s: remove that rule by hand "+
						"if it is still there", port, tool, fw.Tool)
					r.manual = append(r.manual, msg)
					env.Warnf("%s", msg)
				default:
					allowed, err := fw.Allowed(ctx, env, port)
					if err != nil {
						return err
					}
					if allowed {
						if err := fw.Close(ctx, env, port); err != nil {
							return err
						}
						env.Notef("TCP port %d closed in %s", port, fw.name())
					}
				}
				r.state.Firewall.Ports = slices.DeleteFunc(r.state.Firewall.Ports, func(p int) bool { return p == port })
			}
			if len(r.state.Firewall.Ports) == 0 {
				r.state.Firewall.Tool = ""
			}
			return r.saveState(env)
		},
		Verify: func(context.Context, *Env) error { return nil },
	}
}

// stepRecord marks the installation as uninstalled in install.json, which stays with the
// kept data, so the installer treats the data as existing.
func (r *uninstallRun) stepRecord() Step {
	return Step{ID: "record", Title: "Record the uninstall",
		Check: func(context.Context, *Env) (string, error) {
			if !r.hasState {
				return StatePath + " does not exist", nil
			}
			return "", nil
		},
		Act: func(_ context.Context, env *Env) error {
			r.state.Status = StateUninstalled
			r.state.History = append(r.state.History, HistoryEntry{
				At: time.Now().UTC().Format(time.RFC3339), Action: ActionUninstall, Version: r.state.CurrentVersion,
				Backup: r.backupPath,
			}.withTimes(r.progress))
			return env.Do("write "+StatePath+` with "status": "uninstalled"`, func() error { return WriteState(r.u.Sys.FS, r.state) })
		},
		Verify: func(context.Context, *Env) error { return nil },
	}
}

// recordFailure adds the failed uninstall to the history of install.json, when it is still
// there.
func (r *uninstallRun) recordFailure() {
	if r.o.DryRun || !r.hasState {
		return
	}
	e := HistoryEntry{At: time.Now().UTC().Format(time.RFC3339), Action: ActionUninstall, Version: r.state.CurrentVersion,
		Result: ResultFailed}.withTimes(r.progress)
	if err := appendHistory(r.u.Sys.FS, e); err != nil {
		r.env.Log().Printf("could not write %s: %v", StatePath, err)
	}
}

// saveState writes install.json during the run; "Remove everything" deletes it later.
func (r *uninstallRun) saveState(env *Env) error {
	if !r.hasState || env.DryRun {
		return nil
	}
	return env.Do("write "+StatePath, func() error { return WriteState(r.u.Sys.FS, r.state) })
}

func (r *uninstallRun) succeed() int {
	remains := r.remains()
	status := "uninstalled"
	if r.remove {
		status = "removed"
	}
	if r.o.DryRun {
		status = "planned"
	}
	if r.o.JSON {
		r.writeResult(UninstallResult{Status: status, Mode: r.mode(), Backup: r.backupPath, Remains: remains, Log: r.o.logPath()})
		return exitOK
	}
	o := r.out
	o.write("")
	if r.o.DryRun {
		o.line("")
		o.section("Dry run finished: nothing was changed. Run the same command without --dry-run to uninstall.")
		return exitOK
	}
	o.line("")
	if r.remove {
		o.section("xDesign and its data were removed from this server.")
	} else {
		o.section("xDesign was uninstalled. Its data was kept.")
	}
	if r.backupPath != "" {
		o.fact("backup", r.backupPath)
	}
	if took := r.progress.Took(); took != "" {
		o.fact("took", took)
	}
	o.line("")
	o.section("What remains:")
	for _, line := range remains {
		o.line("   - " + line)
	}
	if !r.remove {
		o.line("")
		o.section(reinstallWords)
		o.line(purgeWords)
	}
	return exitOK
}

func (r *uninstallRun) fail(err error) int {
	var stepErr *StepError
	step := ""
	if errors.As(err, &stepErr) {
		step = stepErr.Step.ID
	}
	r.env.Log().Printf("uninstall failed: %v", err)
	if r.o.JSON {
		r.writeResult(UninstallResult{Status: "failed", Mode: r.mode(), Backup: r.backupPath, Remains: []string{}, FailedStep: step,
			Log: r.o.logPath(), Error: stepErrText(err)})
		return exitFailed
	}
	r.out.write("")
	if errors.Is(err, errAborted) {
		r.out.line("")
		r.out.section(upperFirst(err.Error()) + ".")
		return exitFailed
	}
	o := r.errOut
	o.line("")
	o.errorf("the uninstall failed: %s", stepErrText(err))
	if stepErr != nil {
		o.fact("step", fmt.Sprintf("%s %s", stepErr.Step.Num, stepErr.Step.Title))
	}
	if !r.o.DryRun {
		o.fact("log", r.o.logPath())
	}
	if r.backupPath != "" {
		o.fact("backup", r.backupPath)
	}
	if r.moved != "" {
		o.fact("uninstaller", r.moved+" (run it again from there; Windows deletes it when it restarts)")
	}
	o.section("Fix the problem and run the same command again: the steps that are done are skipped.")
	return exitFailed
}

func (r *uninstallRun) writeResult(res UninstallResult) {
	b, err := json.MarshalIndent(res, "", "  ")
	if err != nil {
		return
	}
	fmt.Fprintf(r.u.Stdout, "%s\n", b)
}

// joinPorts writes ports as "443 and 80".
func joinPorts(ports []int) string {
	words := make([]string, len(ports))
	for i, p := range ports {
		words[i] = strconv.Itoa(p)
	}
	return joinAnd(words)
}
