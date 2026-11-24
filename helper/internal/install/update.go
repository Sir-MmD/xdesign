package install

import (
	"bufio"
	"cmp"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
	"github.com/Sir-MmD/xdesign/helper/internal/release"
	"github.com/Sir-MmD/xdesign/helper/internal/unpack"
)

// The update (docs/plan/07-server-install-update.md section 6, xWriter's two stages),
// copied from xWriter's internal/cli/install/update.go and cut to the single xdesign file:
// no release archives, database server, keys, packages or proxies.
//
// The first stage runs in the xdesign file that was started (the installed one for
// `sudo xdesign update FILE`, the new one for `sudo ./xdesign --install` over an older
// installation): it checks root and what is installed, copies the new file into a
// private folder where programs may run (MakeExecDir), opening a packed file on the way
// (internal/unpack), checks it against SHA256SUMS or --sha256 and the signature, reads its
// build information from its symbol table (internal/release), applies the version rules
// and checks the free space. After the question it hands over to the copy: `<copy>
// update --stage 2`, the new file's own code, does the rest (update_stage2.go) and goes
// back by itself when a step fails after xDesign stopped.

const (
	// stage2Timeout bounds the second stage of an update: the backup of a large site may
	// take hours, and stopping it halfway would be worse than waiting.
	stage2Timeout = 24 * time.Hour
	// optMargin is the free space the update leaves under /opt besides the new release.
	optMargin = 100 * mib
	// releaseFactor estimates the release folder from the size of the xdesign file: the
	// file itself and its payload unpacked (Node.js and the app), about three times the
	// packed payload.
	releaseFactor = 4
	// maxUpdateFile bounds the xdesign file an update takes, and the packed file that
	// holds it.
	maxUpdateFile = 512 << 20
	// scratchMargin is the room besides the file (and its unpacked copy) that the scratch
	// folder needs.
	scratchMargin = 200 * mib
	// updateScratchPrefix starts the name of the scratch folder under /var/tmp.
	updateScratchPrefix = "xdesign-update-"
	// backupMargin is the free space the pre-update backup leaves in the data folder.
	backupMargin = 64 * mib
)

// EnvUpdateSteps hands the times of the first stage's steps to the second stage of an
// update, as JSON of [StepTime]: the second stage's bar goes on with them, and its entry in
// install.json records them. A second stage that does not know the variable ignores it.
const EnvUpdateSteps = "XD_UPDATE_STEPS"

// UpdateOptions are the flags of `xdesign update` (section 6.1).
type UpdateOptions struct {
	// File is the new xdesign file, an absolute path on this server, or a tar.gz, zip,
	// tar.xz or tar.zst file that holds it.
	File string
	// SHA256 is the checksum given with --sha256: that of the file, or of the file inside
	// it when it is a packed file.
	SHA256 string
	Yes    bool
	JSON   bool
	// DryRun checks the file and prints the plan without changing anything.
	DryRun  bool
	LogPath string
	NoColor bool

	// Stage is 2 in the process of the new file that the first stage starts; the fields
	// below are set only then: --stage 2 --from VERSION --checksum TEXT --signature TEXT
	// [--json] [--log FILE] FILE, with XD_UPDATE_STEPS in the environment.
	Stage int
	// From is the version that runs when the update starts.
	From string
	// Checksum and Signature say how the first stage checked the file, for the summary
	// and the result.
	Checksum, Signature string
	// StageSteps is what the first stage put in EnvUpdateSteps.
	StageSteps string
}

func (o UpdateOptions) logPath() string {
	if o.LogPath == "" {
		return DefaultLogPath
	}
	return o.LogPath
}

// Validate checks the options alone.
func (o UpdateOptions) Validate() error {
	switch {
	case o.File == "":
		return fmt.Errorf("%w: name the new xdesign file, for example %s", ErrUsage, updateExample)
	case strings.Contains(o.File, "://"):
		return fmt.Errorf("%w: the new xdesign file must be a file on this server, not a web address. "+
			"Copy it (and SHA256SUMS) to the server first, for example: %s", ErrUsage, copyExample)
	case o.JSON && !o.Yes && !o.DryRun && o.Stage != 2:
		return fmt.Errorf("%w: --json needs --yes: questions cannot be asked while the output is JSON", ErrUsage)
	case o.SHA256 != "" && !release.ValidSHA256(o.SHA256):
		return fmt.Errorf("%w: --sha256 must be the 64 hexadecimal digits sha256sum prints", ErrUsage)
	case o.Stage != 0 && o.Stage != 1 && o.Stage != 2:
		return fmt.Errorf("%w: --stage must be 1 or 2", ErrUsage)
	case o.Stage == 2 && o.From == "":
		return fmt.Errorf("%w: --stage 2 needs --from; it is started by xdesign update itself", ErrUsage)
	case o.Stage == 2 && o.DryRun:
		return fmt.Errorf("%w: --dry-run is for the first stage", ErrUsage)
	}
	return nil
}

// Updater is `sudo xdesign update FILE` (section 6). The first stage runs in the file that
// was started: it checks the new file and copies it; the second stage runs in the copy,
// does the update itself and goes back to the release before by itself when a step fails.
type Updater struct {
	Sys host.System
	// Build is the build information of the running file.
	Build buildinfo.Info
	Rand  io.Reader
	// Stdin is read for the answer to the question; Stdout gets the step lines and the
	// summary, or the final JSON object with --json; Stderr gets errors, or the JSON
	// progress lines.
	Stdin          io.Reader
	Stdout, Stderr io.Writer
	Terminal       bool
	// Color turns on the colors of pacman's style.
	Color bool
	// Get asks the website on this server for a URL (the installer's health check); Upgrade
	// asks it for a WebSocket upgrade and returns the status of its answer. nil leaves
	// them out of the health check.
	Get     func(ctx context.Context, url, host string) (status int, body []byte, err error)
	Upgrade func(ctx context.Context, url, host, origin string) (status int, err error)
}

// UpdateResult is the final object of --json.
type UpdateResult struct {
	// Status is "updated", "rolled_back" (the update failed and xDesign went back),
	// "failed" or "planned" (dry run).
	Status     string `json:"status"`
	From       string `json:"from"`
	To         string `json:"to"`
	RolledBack bool   `json:"rolled_back"`
	Backup     string `json:"backup"`
	FailedStep string `json:"failed_step"`
	Log        string `json:"log"`
	// FailureLog is the saved journal of a failed update (section 6.3 step 7).
	FailureLog string `json:"failure_log,omitempty"`
	Error      string `json:"error,omitempty"`
}

// updateRun is one run of either stage.
type updateRun struct {
	u      *Updater
	o      UpdateOptions
	env    *Env
	engine *Engine
	out    *printer
	errOut *printer
	// progress is the plan of the update, whose weights give every bar its percent; nil in
	// a dry run.
	progress *Plan

	state        State
	notInstalled bool // dry run on a server without xDesign
	cur          Release
	cfg          *config.Config
	// next is the new file's build information.
	next release.Binary

	// The first stage: scratch is the private folder of the copy, file the copy the
	// checks read and the second stage runs, fileSum its SHA-256, size its size.
	scratch, file, fileSum string
	size                   int64
	packed                 *unpack.Found
	checksum, signature    string

	// The second stage.
	staging  string
	backup   string
	stopped  bool
	migrated bool
}

// Run runs the stage of o and returns the exit status: 0 when xDesign was updated (or
// the dry run passed), 1 otherwise, 2 for invalid options.
func (u *Updater) Run(ctx context.Context, o UpdateOptions) int {
	if err := o.Validate(); err != nil {
		fmt.Fprintf(u.Stderr, "xdesign update: %v\n", strings.TrimPrefix(err.Error(), ErrUsage.Error()+": "))
		return exitUsage
	}
	r := &updateRun{u: u, o: o, checksum: o.Checksum, signature: o.Signature}
	r.out = newPrinter(u.Stdout, u.Color, u.Terminal)
	r.errOut = newPrinter(u.Stderr, u.Color, false)
	masker := &Masker{}
	var closer io.Closer
	if o.DryRun {
		r.env = NewEnv(u.Sys, NewLog(nil, masker), masker, true)
	} else {
		log, c, err := OpenLog(u.Sys.FS, o.logPath(), masker)
		if err != nil {
			fmt.Fprintf(u.Stderr, "xdesign update: %v\n", err)
			return exitFailed
		}
		closer = c
		r.env = NewEnv(u.Sys, log, masker, false)
	}
	defer func() {
		if closer != nil {
			_ = closer.Close() // the log; a failed close cannot be reported anywhere useful
		}
	}()
	// Both stages list the whole update, so the percent is that of the update: the second
	// stage, a program of its own that the first one starts, goes on from the steps the
	// first one finished. A dry run changes nothing and shows no percent.
	var out *printer
	if !o.JSON {
		out = r.out
	}
	var reporter Reporter
	reporter, r.progress = newReporter(reporterSpec{
		Stdout: u.Stdout, Stderr: u.Stderr, Terminal: u.Terminal, JSON: o.JSON, DryRun: o.DryRun,
		Steps: updateSteps(), Family: systemFamily(u.Sys.FS), Out: out, Sections: r.sections(),
	})
	r.engine = &Engine{Env: r.env, Reporter: reporter}
	if o.Stage == 2 {
		if r.progress != nil {
			r.progress.DoneBefore("program-files", stageSteps(o.StageSteps))
		}
		return r.stage2(ctx)
	}
	return r.stage1(ctx)
}

// updateSteps are the update's steps in the order they run: the first stage's checks,
// then the second stage's work. The going back of a failed update has steps of its own,
// outside the bar.
func updateSteps() stepList {
	return stepList{
		step("installed", 1, secs(1)),     // install.json and the current link
		step("file", 3, secs(3)),          // the copy, an unpacking, the checksum
		step("build", 1, secs(1)),         // the build information of the symbol table
		step("version-rules", 1, secs(1)), // the versions and the CPU
		step("space", 1, secs(1)),         // statfs and the size of the data
		step("program-files", 8, secs(8)), // the payload unpacked: Node.js and the app
		step("backup", 6, secs(6)),        // VACUUM INTO and the media
		step("stop", 3, secs(3)),          // the service stops within 30 seconds
		step("migrations", 3, secs(3)),    // the new app's migrations
		step("units", 2, secs(2)),         // the units and a daemon-reload
		step("switch", 1, secs(1)),        // the marker and the links
		step("start", 10, secs(10)),       // the start and the health check
		step("finish", 1, secs(1)),        // install.json and the old releases
	}
}

// sections maps the update's steps to the sections of its output.
func (r *updateRun) sections() map[string]string {
	m := map[string]string{}
	add := func(title string, ids ...string) {
		for _, id := range ids {
			m[id] = title
		}
	}
	next := r.next.Version
	if next == "" {
		next = "the new release"
	}
	add("Checking the update...", "installed", "file", "build", "version-rules", "space")
	add("Installing xDesign "+next+"...", "program-files", "backup", "stop", "migrations", "units")
	add("Starting xDesign "+next+"...", "switch", "start")
	add("Finishing...", "finish")
	from := cmp.Or(r.cur.Version, r.o.From)
	add("Going back to xDesign "+from+"...", "back-stop", "back-switch", "back-restore", "back-start")
	return m
}

// stageTimes is the value of EnvUpdateSteps for the second stage: the times of this
// stage's steps; empty without a plan.
func (r *updateRun) stageTimes() string {
	if r.progress == nil {
		return ""
	}
	_, times := r.progress.Times()
	b, err := json.Marshal(times)
	if len(times) == 0 || err != nil {
		return ""
	}
	return string(b)
}

// stageSteps reads the first stage's times from the value of EnvUpdateSteps; nothing when
// it is empty or not what a release writes there.
func stageSteps(raw string) []StepTime {
	var times []StepTime
	if raw == "" || json.Unmarshal([]byte(raw), &times) != nil {
		return nil
	}
	return times
}

func (r *updateRun) text() bool { return !r.o.JSON }

func (r *updateRun) now() time.Time { return time.Now().UTC() }

// ---- Stage 1: the running file checks and copies the new one ----

func (r *updateRun) stage1(ctx context.Context) int {
	r.env.Log().Printf("==== xdesign update %s (stage 1, file %s, dry run %t) ====", r.o.File, r.u.Build.Version, r.o.DryRun)
	// The copy is the second stage's program: it runs before this returns.
	defer r.removeScratch()
	if r.text() && r.o.DryRun {
		r.out.section("Dry run of the update: nothing is changed, every command is shown")
	}
	steps := []Step{r.stepInstalled(), r.stepFile(), r.stepBuild(), r.stepVersionRules(), r.stepSpace()}
	if _, err := r.engine.Run(ctx, steps); err != nil {
		return r.fail(err)
	}
	if r.o.DryRun {
		return r.planned()
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
	return r.handOver(ctx)
}

// recordFailure adds the update to the history of install.json as failed, when it failed
// before it stopped xDesign: xDesign runs as before then, and only the history changes.
func (r *updateRun) recordFailure() {
	e := HistoryEntry{
		At: r.now().Format(time.RFC3339), Action: ActionUpdate, From: cmp.Or(r.cur.Version, r.o.From), Version: r.next.Version,
		Backup: r.backup, Result: ResultFailed,
	}.withTimes(r.progress)
	err := r.env.Do("write "+StatePath+" (failed update)", func() error { return appendHistory(r.u.Sys.FS, e) })
	if err != nil {
		r.env.Log().Printf("could not write %s: %v", StatePath, err)
	}
}

// stepInstalled checks root and reads what is installed.
func (r *updateRun) stepInstalled() Step {
	return Step{Num: "1", ID: "installed", Title: "Installed version", ReadOnly: true, Act: func(_ context.Context, env *Env) error {
		if !elevated(r.u.Sys.Machine) {
			if !env.DryRun {
				return notElevated(r.o.File)
			}
			env.Warnf("%s", notElevatedWarning)
		}
		st, found, err := ReadState(r.u.Sys.FS)
		if err != nil {
			return err
		}
		if !found {
			if env.DryRun {
				r.notInstalled = true
				env.Notef("xDesign is not installed on this server, so only the file is checked")
				return nil
			}
			return fmt.Errorf("xDesign is not installed on this server (%s is missing). Install it with %s./xdesign --install", StatePath,
				adminPrefix)
		}
		switch st.Status {
		case StateInstalled:
		case StateInstalling:
			return errors.New("an installation of xDesign did not finish. Finish it first: run the installer again (" + adminPrefix +
				"./xdesign --install)")
		case StateUninstalled:
			return errors.New("xDesign was uninstalled and its data kept. Install it again with the new file (" + adminPrefix +
				"./xdesign --install); " +
				"it picks the data up")
		default:
			return fmt.Errorf("%s has the status %q, so this is not a finished installation. Repair it with %sxdesign --install",
				StatePath, st.Status, adminPrefix)
		}
		cur, err := currentRelease(r.u.Sys.FS)
		if err != nil {
			return err
		}
		if st.CurrentVersion != "" && st.CurrentVersion != cur.Version {
			env.Warnf("%s names %s, but %s points to %s; %s is taken as the running version", StatePath, st.CurrentVersion, currentLink,
				cur.Version, cur.Version)
		}
		cfg, err := readSiteConfig(r.u.Sys.FS)
		if err != nil {
			return err
		}
		r.state, r.cur, r.cfg = st, cur, cfg
		env.Factf("installed", "xDesign %s in %s", cur.Version, cur.Dir)
		return nil
	}}
}

// readSiteConfig reads /etc/xdesign/config.toml (C:\ProgramData\xDesign\config.toml).
func readSiteConfig(fsys host.FS) (*config.Config, error) {
	data, err := fsys.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", configPath, err)
	}
	return config.Parse(data, configPath)
}

// stepFile copies the new file into a folder only root can open that lets programs run
// (MakeExecDir), opening a packed file on the way, and checks it against SHA256SUMS next
// to it (or inside the packed file) or --sha256, and the signature of SHA256SUMS (section
// 6.3 step 1). The checks are those of the xdesign file; --sha256 may also be the checksum
// of the packed file.
func (r *updateRun) stepFile() Step {
	return Step{Num: "2", ID: "file", Title: "Checksum and signature", ReadOnly: true, Act: func(ctx context.Context, env *Env) error {
		if err := r.copyFile(ctx, env); err != nil {
			return err
		}
		sums, sig, sumsFrom, err := r.findSums()
		if err != nil {
			return err
		}
		name := filepath.Base(r.o.File)
		if r.packed != nil {
			name = r.packed.Name
		}
		var checked []string
		if sums != nil {
			parsed, err := release.ParseSums(sums)
			if err != nil {
				return fmt.Errorf("%s: %w", sumsFrom, err)
			}
			line, listed := release.MatchSum(parsed, name, r.fileSum)
			switch {
			case line == "" && listed:
				return checksumMismatch("the file does not match its line in " + sumsFrom)
			case line == "":
				env.Warnf("%s does not list %s", sumsFrom, name)
			default:
				checked = append(checked, sumsFrom)
			}
		}
		if s := r.o.SHA256; s != "" {
			switch {
			case strings.EqualFold(s, r.fileSum):
				checked = append(checked, "--sha256")
			case r.packed != nil && r.outerSum(env) == strings.ToLower(s):
				checked = append(checked, "--sha256 of the packed file")
			default:
				return checksumMismatch("the file does not match --sha256")
			}
		}
		r.checksum = "not given"
		if len(checked) > 0 {
			r.checksum = "matches (" + strings.Join(checked, " and ") + ")"
		} else {
			env.Warnf("the file was not checked against a checksum: put SHA256SUMS next to it, or give --sha256")
		}
		env.Factf("checksum", "%s", r.checksum)
		s, err := release.CheckSignature(sums, sig)
		if err != nil {
			return fmt.Errorf("%s does not verify (%w): the files were changed after the developer signed them, or they come "+
				"from someone else. Do not install them", release.SigName, err)
		}
		if s == release.SignatureValid && (len(checked) == 0 || checked[0] != sumsFrom) {
			return fmt.Errorf("the signed %s does not list %s, so its signature does not cover it. Copy the file of the same release",
				release.SumsName, name)
		}
		r.signature = s.String()
		env.Factf("signature", "%s", r.signature)
		return nil
	}}
}

// checksumMismatch refuses a file that does not match its checksum.
func checksumMismatch(what string) error {
	return errors.New(what + ": it is damaged, or not the file the developer built. Copy it again")
}

// outerSum returns the SHA-256 of the packed file itself; "" when it cannot be read.
func (r *updateRun) outerSum(env *Env) string {
	sum, err := fileSHA256(r.u.Sys.FS, r.o.File)
	if err != nil {
		env.Log().Printf("hash %s: %v", r.o.File, err)
		return ""
	}
	return sum
}

// copyFile copies the new file into a private folder (scratch) in the first place that
// lets programs run and has room: the checks, the second stage and the release folder all
// come from that copy, so the file cannot change between the checks and the update, and a
// file that lost its execute bit runs too. A packed file is opened (internal/unpack) and
// the xdesign file inside put there the same way. Nothing else changes, so dry runs do
// this as well; the first stage removes the folder at its end.
func (r *updateRun) copyFile(ctx context.Context, env *Env) error {
	fsys := r.u.Sys.FS
	fi, err := fsys.Stat(r.o.File)
	if err != nil {
		return fmt.Errorf("the update file: %w", err)
	}
	if !fi.Mode().IsRegular() {
		return fmt.Errorf("%s is not a file", r.o.File)
	}
	if fi.Size() > maxUpdateFile {
		return fmt.Errorf("%s is larger than %d MB, more than an xdesign file has", r.o.File, maxUpdateFile/mib)
	}
	f, err := fsys.Open(r.o.File)
	if err != nil {
		return fmt.Errorf("read the update file: %w", err)
	}
	defer func() { _ = f.Close() }() // read-only: closing cannot lose data
	at, ok := f.(io.ReaderAt)
	if !ok {
		return errors.New("this system cannot read the update file at an offset")
	}
	head := make([]byte, release.KindHeadLen)
	n, _ := at.ReadAt(head, 0) // a shorter file shows all it has
	kind := release.DetectKind(head[:n])
	if kind != release.KindBinary && kind != release.KindPacked {
		return fmt.Errorf("%s is not an xdesign file, nor a tar.gz, zip, tar.xz or tar.zst file that holds one", r.o.File)
	}
	r.scratch, err = MakeExecDir(r.u.Sys, r.u.Rand, updateScratchPrefix, uint64(fi.Size())*2+scratchMargin) //nolint:gosec // G115: a size checked above
	if err != nil {
		return err
	}
	r.file = filepath.Join(r.scratch, releaseSelf)
	if kind == release.KindPacked {
		return r.openPacked(ctx, env, at, fi.Size())
	}
	// The scratch folder is this run's own, so a dry run copies too.
	env.Log().Printf("copy: install -m 0700 %s %s", r.o.File, r.file)
	if err := copyInto(fsys, at, fi.Size(), r.file); err != nil {
		return err
	}
	if r.fileSum, err = fileSHA256(fsys, r.file); err != nil {
		return err
	}
	r.size = fi.Size()
	env.Notef("an xdesign file of %s, SHA-256 %s", formatMB(r.size), r.fileSum)
	return nil
}

// copyInto copies size bytes of src into the new file dst (mode 0700, root's).
func copyInto(fsys host.FS, src io.ReaderAt, size int64, dst string) error {
	w, err := fsys.OpenAppend(dst, 0o700)
	if err != nil {
		return fmt.Errorf("copy the update file: %w", err)
	}
	_, err = io.Copy(w, io.NewSectionReader(src, 0, size))
	if cerr := w.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return fmt.Errorf("copy the update file: %w", err)
	}
	return nil
}

// openPacked opens a packed file into scratch: the xdesign file inside is renamed to
// scratch/xdesign, and the SHA256SUMS and SHA256SUMS.sig next to it are kept for the
// checks.
func (r *updateRun) openPacked(ctx context.Context, env *Env, at io.ReaderAt, size int64) error {
	arch, err := r.u.Sys.Machine.Arch()
	if err != nil {
		return fmt.Errorf("read the CPU architecture: %w", err)
	}
	found, err := unpack.Resolve(ctx, at, size, r.scratch, unpack.Options{
		Name: filepath.Base(r.o.File), Path: r.o.File, Arch: goArch(arch), Limits: unpack.Limits{Payload: maxUpdateFile},
	})
	if err != nil {
		return fmt.Errorf("open %s: %w", r.o.File, err)
	}
	if found.Kind != release.KindBinary {
		return fmt.Errorf("%s holds an xWriter-style release archive, not an xdesign file", r.o.File)
	}
	// The scratch folder is this run's own, so a dry run takes the file out too.
	env.Log().Printf("copy: mv %s %s && chmod 0700 %s", found.Path, r.file, r.file)
	if err := r.u.Sys.FS.Rename(found.Path, r.file); err != nil {
		return fmt.Errorf("take the xdesign file out of %s: %w", r.o.File, err)
	}
	if err := r.u.Sys.FS.Chmod(r.file, 0o700); err != nil {
		return fmt.Errorf("take the xdesign file out of %s: %w", r.o.File, err)
	}
	r.packed, r.fileSum, r.size = &found, found.SHA256, found.Size
	env.Notef("%s holds %s (%s, SHA-256 %s)", strings.Join(found.Layers, ", "), found.Name, formatMB(found.Size), found.SHA256)
	return nil
}

// formatMB is a size in MB for the owner.
func formatMB(n int64) string {
	return fmt.Sprintf("%.1f MB", float64(n)/float64(mib))
}

// findSums returns SHA256SUMS and SHA256SUMS.sig: those inside the packed file, else
// those next to the update file; nil when there are none, and the name they came from.
func (r *updateRun) findSums() (sums, sig []byte, from string, err error) {
	if r.packed != nil && r.packed.Sums != nil {
		return r.packed.Sums, r.packed.Sig, release.SumsName + " inside " + filepath.Base(r.o.File), nil
	}
	dir := filepath.Dir(r.o.File)
	read := func(name string) ([]byte, error) {
		p := filepath.Join(dir, name)
		fi, err := r.u.Sys.FS.Lstat(p)
		switch {
		case errors.Is(err, fs.ErrNotExist):
			return nil, nil // no such file next to the update: nothing to check with
		case err != nil:
			return nil, fmt.Errorf("check %s: %w", p, err)
		case !fi.Mode().IsRegular():
			return nil, nil
		case fi.Size() > 1<<20:
			return nil, fmt.Errorf("%s is larger than 1 MB, more than %s has", p, name)
		}
		data, err := r.u.Sys.FS.ReadFile(p)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", p, err)
		}
		return data, nil
	}
	if sums, err = read(release.SumsName); err != nil || sums == nil {
		return nil, nil, "", err
	}
	if sig, err = read(release.SigName); err != nil {
		return nil, nil, "", err
	}
	return sums, sig, filepath.Join(dir, release.SumsName), nil
}

// stepBuild reads the build information of the copy from its symbol table, without
// running it (section 6.3 step 2): it must be an xdesign file, for Linux or Windows
// (stepVersionRules refuses the other system).
func (r *updateRun) stepBuild() Step {
	return Step{Num: "3", ID: "build", Title: "Build information", ReadOnly: true, Act: func(_ context.Context, env *Env) error {
		bin, err := inspectFile(r.u.Sys.FS, r.file)
		if err != nil {
			return err
		}
		r.next = bin
		built := bin.Version
		if bin.Dev {
			built = bin.Version + " (a development build)"
		}
		env.Factf("new", "xDesign %s for %s, commit %.12s, built %s", built, bin.Arch, cmp.Or(bin.Commit, "unknown"), cmp.Or(bin.BuiltAt, "unknown"))
		env.Notef("updates %s or newer; the database it makes is read by %s or newer", bin.MinUpgradeFrom, bin.SchemaFloor)
		if bin.PayloadSHA256 == "" {
			return errors.New("this xdesign file carries no payload: it is a development build; build a release with ./build.sh or make release")
		}
		return nil
	}}
}

// inspectFile reads the build information of the xdesign file at name.
func inspectFile(fsys host.FS, name string) (release.Binary, error) {
	f, err := fsys.Open(name)
	if err != nil {
		return release.Binary{}, fmt.Errorf("read %s: %w", name, err)
	}
	defer func() { _ = f.Close() }() // read-only: closing cannot lose data
	at, ok := f.(io.ReaderAt)
	if !ok {
		return release.Binary{}, errors.New("this system cannot read a program at an offset")
	}
	bin, err := release.InspectBinary(at)
	if err != nil {
		return release.Binary{}, fmt.Errorf("%s: %w", name, err)
	}
	return bin, nil
}

// stepVersionRules applies the version rules (section 6.3 step 2): the server's system
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.6) and CPU, a
// version newer than the running one, which must be min_upgrade_from or newer; a
// development build only over a development build.
func (r *updateRun) stepVersionRules() Step {
	return Step{Num: "4", ID: "version-rules", Title: "Version rules", ReadOnly: true, Act: func(_ context.Context, env *Env) error {
		if r.next.OS != runtime.GOOS {
			return fmt.Errorf("this file is for %s; this server runs %s", release.SystemName(r.next.OS), platform.Name)
		}
		machine, err := r.u.Sys.Machine.Arch()
		if err != nil {
			return fmt.Errorf("read the CPU architecture: %w", err)
		}
		if arch := goArch(machine); r.next.Arch != arch {
			return fmt.Errorf("this file is for %s, but this server is %s. Copy the %s file instead", r.next.Arch, arch, arch)
		}
		if r.notInstalled {
			env.Notef("nothing is installed to compare with")
			return nil
		}
		next, cur := r.next.Version, r.cur.Version
		curDev := !isReleaseVersion(cur)
		switch {
		case next == cur:
			return fmt.Errorf("this is xDesign %s, which runs already. %sxdesign --install with it repairs the installation", cur, adminPrefix)
		case r.next.Dev && !curDev:
			return fmt.Errorf("this is a development build (%s), which installs only over a development build; this server runs the release %s",
				next, cur)
		case curDev:
			env.Warnf("a development build runs (%s), so neither the version order nor the oldest version %s updates from is checked", cur, next)
			env.Factf("versions", "%s to %s", cur, next)
			return nil
		}
		c, err := buildinfo.CompareVersions(next, cur)
		switch {
		case err != nil:
			return fmt.Errorf("xDesign %s cannot be compared with the running %s: %w", next, cur, err)
		case c < 0:
			return fmt.Errorf("this is xDesign %s, older than the running %s. Go back with %sxdesign rollback --to %s", next, cur, adminPrefix,
				next)
		}
		if c, err := buildinfo.CompareVersions(cur, r.next.MinUpgradeFrom); err == nil && c < 0 {
			return fmt.Errorf("xDesign %s updates installations of %s or newer, and this server runs %s. Update to %s first, then to %s",
				next, r.next.MinUpgradeFrom, cur, r.next.MinUpgradeFrom, next)
		}
		env.Factf("versions", "%s to %s", cur, next)
		env.Factf("can update", "from %s: yes", cur)
		if below, _ := belowFloor(cur, r.next.SchemaFloor); below {
			env.Warnf("after this update, going back to %s needs the backup the update makes first: xDesign %s changes the database in a "+
				"way %s cannot read", cur, next, cur)
		}
		return nil
	}}
}

// isReleaseVersion reports whether v is a release version X.Y.Z.
func isReleaseVersion(v string) bool {
	sv, err := buildinfo.ParseVersion(v)
	return err == nil && sv.IsRelease()
}

// belowFloor reports whether the release version cannot run on a database that the
// migrations of a release with the schema floor floor changed. Development builds always
// can.
func belowFloor(version, floor string) (bool, error) {
	if floor == "" || !isReleaseVersion(version) {
		return false, nil
	}
	c, err := buildinfo.CompareVersions(version, floor)
	if err != nil {
		return false, fmt.Errorf("compare %s with the schema floor %s: %w", version, floor, err)
	}
	return c < 0, nil
}

// stepSpace checks the free space (section 6.3 step 2): the new release plus 100 MB under
// /opt, and the database and the media for the backup the update makes first.
func (r *updateRun) stepSpace() Step {
	return Step{Num: "5", ID: "space", Title: "Disk space", ReadOnly: true, Act: func(_ context.Context, env *Env) error {
		m := r.u.Sys.Machine
		need := uint64(r.size)*releaseFactor + optMargin //nolint:gosec // G115: a file size, at most 1 GB
		st, err := statfsNearest(m, releasesDir)
		if err != nil {
			return err
		}
		if st.Free < need {
			return fmt.Errorf("there is not enough free space under %s: %s free, and the new release needs %s. Free some space, then "+
				"run the update again", programWords, formatSize(st.Free), formatSize(need))
		}
		if r.notInstalled {
			env.Factf("disk space", "enough")
			return nil
		}
		site, err := siteSize(r.u.Sys.FS)
		if err != nil {
			return err
		}
		st, err = statfsNearest(m, dataDir)
		if err != nil {
			return err
		}
		if need := site + backupMargin; st.Free < need {
			return fmt.Errorf("there is not enough free space for the backup the update makes first in %s: %s free, about %s needed "+
				"(the database and the media). Delete old backups there, then run the update again", dataDir, formatSize(st.Free),
				formatSize(need))
		}
		env.Factf("disk space", "enough")
		return nil
	}}
}

// formatSize is a size in MB for the owner.
func formatSize(n uint64) string {
	return fmt.Sprintf("%d MB", n/mib)
}

// siteSize is the size of the database and the media, which the pre-update backup holds
// at most.
func siteSize(fsys host.FS) (uint64, error) {
	var total uint64
	if fi, err := fsys.Stat(filepath.Join(dataDir, "xdesign.db")); err == nil {
		total += uint64(fi.Size()) //nolint:gosec // G115: a file size
	}
	var walk func(dir string) error
	walk = func(dir string) error {
		entries, err := fsys.ReadDir(dir)
		if errors.Is(err, fs.ErrNotExist) {
			return nil // a site without media
		}
		if err != nil {
			return fmt.Errorf("list %s: %w", dir, err)
		}
		for _, e := range entries {
			p := filepath.Join(dir, e.Name())
			if e.IsDir() {
				if err := walk(p); err != nil {
					return err
				}
				continue
			}
			if fi, err := e.Info(); err == nil && fi.Mode().IsRegular() {
				total += uint64(fi.Size()) //nolint:gosec // G115: a file size
			}
		}
		return nil
	}
	err := walk(filepath.Join(dataDir, "media"))
	return total, err
}

// statfsNearest returns the file system facts of p, or of its nearest existing parent.
func statfsNearest(m host.Machine, p string) (host.Statfs, error) {
	for {
		st, err := m.Statfs(p)
		if err == nil || filepath.Dir(p) == p {
			return st, err
		}
		p = filepath.Dir(p)
	}
}

// confirm asks the question of the update.
func (r *updateRun) confirm() (bool, error) {
	r.out.line("")
	ask := &prompter{in: bufio.NewReader(r.u.Stdin), out: r.out}
	ok, err := ask.confirm(fmt.Sprintf("Update xDesign %s to %s?", r.cur.Version, r.next.Version), true)
	if errors.Is(err, errNoAnswer) {
		return false, errors.New("no answer: standard input ended. Run " + adminPrefix + "xdesign update FILE --yes to update without the question")
	}
	return ok, err
}

// removeScratch removes the private folder of the copy.
func (r *updateRun) removeScratch() {
	if r.scratch == "" {
		return
	}
	r.env.Log().Printf("remove: rm -rf %s", r.scratch)
	if err := r.u.Sys.FS.RemoveAll(r.scratch); err != nil {
		r.env.Log().Printf("could not remove %s: %v", r.scratch, err)
	}
}

// handOver starts the second stage in the copy of the new file, with the output of this
// one, and returns its exit status.
func (r *updateRun) handOver(ctx context.Context) int {
	args := []string{"update", "--stage", "2", "--from", r.cur.Version, "--checksum", r.checksum, "--signature", r.signature}
	if r.o.JSON {
		args = append(args, "--json", "--yes")
	}
	if r.o.LogPath != "" {
		args = append(args, "--log", r.o.LogPath)
	}
	if r.o.NoColor {
		args = append(args, "--no-color")
	}
	cmd := host.Cmd{Name: r.file, Args: append(args, r.file), Timeout: stage2Timeout}
	if times := r.stageTimes(); times != "" {
		// The second stage's bar goes on with this stage's times.
		cmd.Env = []string{EnvUpdateSteps + "=" + times}
	}
	if r.text() {
		r.out.write("")
		r.out.note(fmt.Sprintf("xDesign %s continues the update. Do not interrupt it: if a step fails after xDesign stopped, it goes back "+
			"to %s by itself.", r.next.Version, r.cur.Version))
	}
	r.env.Log().Printf("stage 2: %s", cmd.String())
	streamer, ok := r.u.Sys.Runner.(host.Streamer)
	if !ok {
		r.recordFailure()
		return r.fail(errors.New("this system cannot run the new file"))
	}
	// Ctrl+C or a lost SSH connection must not stop the second stage halfway: it ignores
	// them, and is not tied to this context.
	code, err := streamer.Stream(context.WithoutCancel(ctx), cmd, r.u.Stdout, r.u.Stderr)
	r.env.Log().Printf("stage 2 ended with status %d (%v)", code, err)
	if err != nil || code == exitUsage {
		how := fmt.Sprintf("exit status %d", code)
		if err != nil {
			how = err.Error()
		}
		// The second stage reports its own failures; one that could not run or refused
		// the hand-over changed nothing.
		r.recordFailure()
		return r.fail(fmt.Errorf("xDesign %s could not take the update over (%s); see the log %s", r.next.Version, how, r.o.logPath()))
	}
	return code
}

// planned prints the plan of a dry run.
func (r *updateRun) planned() int {
	res := UpdateResult{Status: "planned", From: r.cur.Version, To: r.next.Version, Log: r.o.logPath()}
	if r.o.JSON {
		r.writeResult(res)
		return exitOK
	}
	o := r.out
	o.line("")
	o.section("Dry run finished: nothing was changed")
	if !r.notInstalled {
		o.fact("update", fmt.Sprintf("%s to %s: %sxdesign update %s", r.cur.Version, r.next.Version, adminPrefix, r.o.File))
	}
	o.fact("then", "a backup, the new release folder, a stop, the migrations, "+unitsWords+", the switch and a start with a health check of "+
		"up to "+formatElapsed(updateHealthWait)+"; a failure after the stop goes back by itself")
	return exitOK
}

// fail prints the failure block (or the --json result) and returns the exit status.
func (r *updateRun) fail(err error) int {
	var stepErr *StepError
	step, command := "", ""
	if errors.As(err, &stepErr) {
		step, command = stepErr.Step.ID, stepErr.Command
		err = stepErr.Err
	}
	r.env.Log().Printf("update failed: %v", err)
	if r.o.JSON {
		r.writeResult(UpdateResult{Status: "failed", From: cmp.Or(r.cur.Version, r.o.From), To: r.next.Version, Backup: r.backup,
			FailedStep: step, Log: r.o.logPath(), Error: err.Error()})
		return exitFailed
	}
	if errors.Is(err, errAborted) {
		r.out.line("")
		r.out.section(upperFirst(err.Error()))
		return exitFailed
	}
	r.out.write("") // ends a line the next output would replace
	o := r.errOut
	o.line("")
	o.errorf("the update failed: %v", err)
	if stepErr != nil {
		o.fact("step", fmt.Sprintf("%s %s", stepErr.Step.Num, stepErr.Step.Title))
	}
	if command != "" {
		o.fact("command", command)
	}
	if !r.o.DryRun {
		o.fact("log", r.o.logPath())
	}
	if !r.notInstalled && r.cur.Version != "" {
		o.section(fmt.Sprintf("Nothing was changed: xDesign %s runs as before.", r.cur.Version))
	} else {
		o.section("Nothing was changed.")
	}
	return exitFailed
}

// writeResult prints the --json result.
func (r *updateRun) writeResult(res UpdateResult) {
	b, err := json.MarshalIndent(res, "", "  ")
	if err != nil {
		return
	}
	fmt.Fprintf(r.u.Stdout, "%s\n", b)
}

// update is `sudo ./xdesign --install` over an older installation (section 6.1): after its
// preflight the installer hands the run to the update with this file, which runs both
// stages as `sudo xdesign update FILE` does.
func (r *run) update(ctx context.Context) int {
	u := &Updater{
		Sys: r.sys, Build: r.in.Build, Rand: r.in.Rand, Stdin: r.in.Stdin, Stdout: r.in.Stdout, Stderr: r.in.Stderr,
		Terminal: r.in.Terminal, Color: r.in.Color, Get: r.in.Get, Upgrade: r.in.Upgrade,
	}
	return u.Run(ctx, UpdateOptions{
		File: r.in.Program, Yes: r.opts.Yes, JSON: r.opts.JSON, DryRun: r.opts.DryRun, LogPath: r.opts.LogPath, NoColor: r.opts.NoColor,
	})
}
