package install

import (
	"bufio"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/netip"
	"strings"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// Exit statuses of the installer.
const (
	exitOK     = 0
	exitFailed = 1
	exitUsage  = 2
)

// Mode is how the installer treats what it finds (docs/plan/07-server-install-update.md
// section 3 step 1).
type Mode int

// Installer modes.
const (
	// ModeFresh: no previous installation.
	ModeFresh Mode = iota
	// ModeResume: install.json says "installing", so a previous run stopped; the
	// installer asks whether to continue it, and done steps are skipped.
	ModeResume
	// ModeRepair: this version is installed; the installer re-checks everything,
	// never touches the settings, the accounts or the data, restarts the service and
	// runs the health check.
	ModeRepair
	// ModeExisting: the data of an earlier installation is here (install.json says
	// "uninstalled", holds an unknown status, or is missing next to xDesign's files, or
	// names an installed version whose program is gone); the installer asks whether to
	// install with it, and the settings and the database are kept.
	ModeExisting
	// ModeUpdate: an older version is installed; xdesign update does the work, so the
	// installer stops with that command.
	ModeUpdate
	// ModeNewer: a newer version is installed; the installer refuses.
	ModeNewer
)

func (m Mode) String() string {
	switch m {
	case ModeFresh:
		return "fresh install"
	case ModeResume:
		return "continuing an unfinished installation"
	case ModeRepair:
		return "repair"
	case ModeExisting:
		return "reinstall with existing data"
	case ModeUpdate:
		return "update"
	case ModeNewer:
		return "a newer version is installed"
	}
	return fmt.Sprintf("mode %d", int(m))
}

// Installer is `sudo ./xdesign --install` (docs/plan/07-server-install-update.md section
// 3): xWriter's install engine and output with the flow of xmtp-panel's installer.
type Installer struct {
	// Sys is the operating system.
	Sys host.System
	// Build is the build information of this file: its version, its CPU and its payload.
	Build buildinfo.Info
	// Rand is the source of generated values (crypto/rand in production).
	Rand io.Reader
	// Stdin is read for the answers.
	Stdin io.Reader
	// Stdout gets the step lines, the questions and the summary, or the final JSON
	// object with --json; Stderr gets errors, or the JSON progress lines.
	Stdout, Stderr io.Writer
	// Terminal reports that Stdout is a terminal: the running step is drawn on a line
	// that is redrawn.
	Terminal bool
	// Color turns on the colors of pacman's style (UseColor decides it).
	Color bool
	// Rerun is the command that runs the installer again, for the messages ("sudo
	// ./xdesign --install"); empty says "the installer".
	Rerun string
	// Program is the path of this file, for the command that updates an older
	// installation with it (sudo xdesign update FILE).
	Program string
	// LookupIP returns the addresses of a host name in the DNS, for the check that the
	// domain points to this server; nil leaves that check out.
	LookupIP func(ctx context.Context, host string) ([]netip.Addr, error)
	// Get asks the website on this server for url (/api/health under the web base path, as
	// healthURL builds it) with host as the Host header and the TLS server name, without a
	// proxy and without checking the certificate, and returns the status and the start of
	// the body; nil leaves the health check out.
	Get func(ctx context.Context, url, host string) (status int, body []byte, err error)
	// Upgrade asks the website on this server for a WebSocket upgrade (the update's health
	// check, Updater.Upgrade); nil leaves that part out.
	Upgrade func(ctx context.Context, url, host, origin string) (status int, err error)
	// EchoOff keeps the terminal from showing what is typed (the Cloudflare API token) and
	// returns the function that shows it again; nil reads every answer as it comes.
	EchoOff func() (restore func(), err error)
}

// run is one installer run.
type run struct {
	in   *Installer
	opts Options
	sys  host.System
	env  *Env
	log  *Log
	ask  *prompter
	// out prints in pacman's style on Stdout, errOut the failure on Stderr; pacman is
	// the reporter of the steps on out (nil with --json). progress is the plan of the
	// run, whose weights give every bar its percent; nil in a dry run.
	out, errOut *printer
	pacman      *PacmanReporter
	progress    *Plan

	// version is this release's; selfSum the SHA-256 of this file, once read.
	version string
	selfSum string
	// What preflight found.
	osr     host.OSRelease
	distro  distro
	arch    string // "amd64" or "arm64"
	systemd int    // the version of systemd, 0 when unknown
	selinux string // "enforcing", "permissive" or "" (off)
	mode    Mode
	prev    State // install.json of an earlier run (when found)
	hasPrev bool
	// prevVersion is the version of the earlier installation: the release that
	// /opt/xdesign/current points to, else the one install.json names. programMissing
	// reports that install.json says "installed" but that release's program is gone;
	// found lists the files of an earlier installation when install.json is missing.
	prevVersion    string
	programMissing bool
	found          []string
	// port80Free reports that port 80 is free for Let's Encrypt's checks; programs names
	// the programs that listen on each TCP port (ss, https.go).
	port80Free bool
	programs   map[int][]string
	// firewall is the active firewall (fwdetect.go).
	firewall Firewall
	// refusal says why this release is not installed over what preflight found (an
	// older or a newer xDesign, the unfinished installation or the data of a newer one);
	// refuse prints it.
	refusal *refusal
	// started reports that this run wrote install.json with "status": "installing";
	// from then on stepRecorder records the step that runs.
	started bool

	// What this run does.
	state State // install.json as this run builds it
	// cfg is the site's config.toml: the answers, or the file an earlier installation
	// left (keptConfig).
	cfg        *config.Config
	keptConfig bool
	// owner is the site owner to make; ownerUsername the owner the site has already.
	owner         ownerPlan
	ownerUsername string
	// restore is the backup to put in place (the restore question), when there is one.
	restore restorePlan
	// openPorts are the ports the owner lets the firewall step open (firewall.go);
	// labelPort the port whose SELinux label the owner allowed (selinux.go).
	openPorts []int
	labelPort int
	// https is the certificate the owner chose (certificate.go); an empty method keeps the
	// HTTPS settings the site has.
	https httpsPlan

	// What happened.
	password string // generated by init-owner in this run; secret
	// enabledAtBoot reports that step 8 found or made xdesign.service enabled.
	enabledAtBoot bool
	// certificate is what the certificate step found of the Let's Encrypt certificate.
	certificate certOutcome
}

// Run runs the installer and returns the exit status: 0 when the installation (or
// repair, or dry run) succeeded, 1 when it failed, 2 for invalid options.
func (in *Installer) Run(ctx context.Context, opts Options) int {
	if err := opts.Validate(); err != nil {
		fmt.Fprintf(in.Stderr, "xdesign --install: %v\n", strings.TrimPrefix(err.Error(), ErrUsage.Error()+": "))
		return exitUsage
	}
	if in.Rand == nil {
		in.Rand = rand.Reader
	}
	return newRun(in, opts).main(ctx)
}

// newRun prepares a run of the installer.
func newRun(in *Installer, opts Options) *run {
	r := &run{in: in, opts: opts, sys: in.Sys, version: in.Build.Version}
	r.out = newPrinter(in.Stdout, in.Color, in.Terminal)
	r.errOut = newPrinter(in.Stderr, in.Color, false)
	r.ask = &prompter{in: bufio.NewReader(in.Stdin), out: r.out}
	cfg := config.Defaults()
	r.cfg = &cfg
	return r
}

func (r *run) main(ctx context.Context) int {
	masker := &Masker{}
	masker.Add(r.opts.CloudflareToken)
	var closer io.Closer
	if !r.opts.DryRun {
		log, c, err := OpenLog(r.sys.FS, r.opts.logPath(), masker)
		if err != nil {
			return r.failEarly(err)
		}
		r.log, closer = log, c
	} else {
		r.log = NewLog(nil, masker)
	}
	return r.installAndClose(ctx, masker, closer)
}

// installAndClose runs the steps and closes the log file at the end.
func (r *run) installAndClose(ctx context.Context, masker *Masker, closer io.Closer) int {
	defer func() {
		if closer != nil {
			if err := closer.Close(); err != nil {
				fmt.Fprintf(r.in.Stderr, "xdesign --install: close the log: %v\n", err)
			}
		}
	}()
	r.log.Printf("==== xdesign --install %s (dry run %t, yes %t) ====", r.version, r.opts.DryRun, r.opts.Yes)
	r.env = NewEnv(r.sys, r.log, masker, r.opts.DryRun)

	// Every bar shows the percent of the whole run; a dry run does nothing, so it shows
	// none.
	steps := r.steps()
	reporter, plan := newReporter(reporterSpec{
		Stderr: r.in.Stderr, JSON: r.opts.JSON, DryRun: r.opts.DryRun,
		Steps: installSteps().pick(stepIDs(steps)), Family: systemFamily(r.sys.FS), Out: r.out, Sections: r.sections(),
	})
	r.progress = plan
	r.pacman, _ = reporter.(*PacmanReporter) // nil with --json
	if r.pacman != nil && r.opts.DryRun {
		r.out.section(fmt.Sprintf("Dry run of the xDesign %s installer: nothing is changed, every command is shown", r.version))
	}
	engine := &Engine{Env: r.env, Reporter: reporter}

	// Preflight decides what to do with an earlier installation: a refusal replaces the
	// failure block (an older xDesign is updated with xdesign update, a newer one is
	// kept), and an unfinished installation or the data an uninstall kept is confirmed
	// before the questions.
	_, err := engine.Run(ctx, steps[:1])
	switch {
	case r.refusal != nil:
		return r.refuse()
	case err != nil:
		return r.fail(err)
	case r.mode == ModeUpdate:
		return r.update(ctx)
	}
	if err := r.confirmEarlier(); err != nil {
		return r.fail(err)
	}
	if err := r.decide(ctx); err != nil {
		return r.fail(err)
	}
	if !r.opts.DryRun {
		r.state.Status = StateInstalling
		if err := WriteState(r.sys.FS, r.state); err != nil {
			return r.fail(err)
		}
		r.started = true
	}
	engine.Reporter = stepRecorder{Reporter: reporter, r: r}
	if r.progress != nil {
		// A repair weighs the steps it does by the times they took in the earlier runs.
		r.progress.LearnTimes(r.prev.History)
		r.progress.Restart() // the time the owner took to answer is not the run's
	}
	if _, err := engine.Run(ctx, steps[1:]); err != nil {
		r.recordFailure()
		return r.fail(err)
	}
	return r.succeed()
}

// stepRecorder records each step in install.json before it runs, once this run wrote
// "status": "installing", so a run that stops for any reason (a failure, Ctrl+C, a
// closed SSH connection, a power cut) tells the next one where it stopped.
type stepRecorder struct {
	Reporter
	r *run
}

// StepStarted implements [Reporter].
func (s stepRecorder) StepStarted(step Step) {
	s.r.recordStep(step.ID)
	s.Reporter.StepStarted(step)
}

// StepProgress implements [ProgressReporter] for the reporter behind it, so the engine
// still hands the env a reporter that shows the progress.
func (s stepRecorder) StepProgress(ev ProgressEvent) {
	if pr, ok := s.Reporter.(ProgressReporter); ok {
		pr.StepProgress(ev)
	}
}

// StepWorking implements [WorkReporter] for the reporter behind it, so the plan learns
// which steps do their work.
func (s stepRecorder) StepWorking(step Step) {
	if w, ok := s.Reporter.(WorkReporter); ok {
		w.StepWorking(step)
	}
}

// StepExpect implements [ExpectReporter] for the reporter behind it, so the plan learns
// the expected times that the steps' data tells.
func (s stepRecorder) StepExpect(id string, d time.Duration) {
	if x, ok := s.Reporter.(ExpectReporter); ok {
		x.StepExpect(id, d)
	}
}

// recordStep writes the step about to run into install.json as last_step, and into the
// state this run writes later. Only that key of the file changes, and a failure to write
// it is logged: it never stops the installation.
func (r *run) recordStep(id string) {
	if !r.started || r.state.LastStep == id {
		return
	}
	r.state.LastStep = id
	st, found, err := ReadState(r.sys.FS)
	if err == nil && found {
		st.LastStep = id
		err = WriteState(r.sys.FS, st)
	}
	if err != nil {
		r.log.Printf("warning: record the step %s in %s: %v", id, StatePath, err)
	}
}

// historyAction is the action of this run in the history of install.json: a repair, or an
// installation (a fresh one, a continued one, or one with the data of an earlier one).
func (r *run) historyAction() string {
	if r.mode == ModeRepair {
		return ActionRepair
	}
	return ActionInstall
}

// recordFailure adds this run to the history of install.json as failed, with the times of
// the steps it ran, once it wrote "status": "installing": only the history changes, and the
// next run still continues where this one stopped (last_step). A failure to write it is
// logged; it never hides the run's own failure.
func (r *run) recordFailure() {
	if !r.started {
		return
	}
	e := HistoryEntry{
		At: r.now().Format(time.RFC3339), Action: r.historyAction(), Version: r.version, Result: ResultFailed,
	}.withTimes(r.progress)
	if err := appendHistory(r.sys.FS, e); err != nil {
		r.log.Printf("warning: record the failed run in %s: %v", StatePath, err)
	}
}

// failEarly reports an error that happened before any step ran.
func (r *run) failEarly(err error) int {
	if r.opts.JSON {
		r.writeResult(Result{Status: "failed", Version: r.version, Log: r.opts.logPath(), Error: err.Error()})
		return exitFailed
	}
	r.errOut.errorf("%v", err)
	return exitFailed
}

// decide asks the questions of section 3 (or takes the flags with --yes, and in dry
// runs) and fills in the plan of this run; the summary before the installation is shown
// either way, except with --json.
func (r *run) decide(ctx context.Context) error {
	if err := r.loadSettings(ctx); err != nil {
		return err
	}
	if !r.opts.Yes && !r.opts.DryRun {
		return r.questions(ctx)
	}
	if !r.keptConfig {
		if err := r.setDomain(ctx, r.opts.Domain); err != nil {
			return err
		}
		if err := r.chooseSite(ctx, false); err != nil {
			return err
		}
	}
	if r.mode != ModeRepair {
		if err := r.chooseHTTPS(false); err != nil {
			return err
		}
		if err := r.askSystem(ctx, false); err != nil {
			return err
		}
	}
	if r.ownerUsername == "" {
		username := normalUsername(r.opts.OwnerUsername)
		if username == "" {
			username = defaultOwnerUsername
		}
		if name := strings.TrimSpace(r.opts.OwnerName); name != "" {
			r.owner = ownerPlan{Username: username, Name: name}
		} else if r.mode != ModeRepair {
			if !r.opts.DryRun {
				return errors.New("--yes needs --owner-name: the site has no owner yet")
			}
			r.owner = ownerPlan{Username: username, Name: "OWNER_NAME"} // asked in a real run
		}
	}
	if !r.opts.JSON && r.mode != ModeRepair {
		r.printSummary()
	}
	return nil
}

// loadSettings takes what an earlier installation left: its config.toml, which is kept as
// it is (the domain, the port and the web base path are not asked), and its owner, whose questions are
// left out.
func (r *run) loadSettings(ctx context.Context) error {
	if exists(r.sys.FS, configPath) {
		cfg, err := r.readConfig()
		if err != nil {
			return err
		}
		r.cfg, r.keptConfig = cfg, true
	}
	if r.mode != ModeFresh && exists(r.sys.FS, currentCLI) {
		username, err := siteOwner(ctx, r.env)
		if err != nil {
			r.log.Printf("the owner of the earlier installation cannot be read yet: %v", err)
		}
		r.ownerUsername = username
	}
	return nil
}

// errAborted is returned when the owner answers no to a confirmation.
var errAborted = errors.New("stopped at your request; nothing was changed")

// Result is the final object of --json.
type Result struct {
	// Status is "installed", "repaired", "planned" (dry run) or "failed".
	Status  string `json:"status"`
	Version string `json:"version"`
	// URL is the site's full address (with the port and the web base path) and Username
	// its owner's.
	URL      string `json:"url,omitempty"`
	Username string `json:"username,omitempty"`
	// Password is set only when the installer made the owner in this run.
	Password string `json:"password,omitempty"`
	// Certificate is the site's certificate when this run chose one; nil when the site
	// keeps its HTTPS settings.
	Certificate *CertificateResult `json:"certificate,omitempty"`
	FailedStep  string             `json:"failed_step"`
	Log         string             `json:"log"`
	// Error explains a failure.
	Error string `json:"error,omitempty"`
}

func (r *run) writeResult(res Result) {
	// The generated password belongs in the result: it is how --json callers receive the
	// owner's sign-in, once.
	b, err := json.MarshalIndent(res, "", "  ") //nolint:gosec // G117: see above
	if err != nil {
		return
	}
	fmt.Fprintf(r.in.Stdout, "%s\n", b)
}

// now returns the current time in UTC.
func (r *run) now() time.Time {
	return time.Now().UTC()
}
