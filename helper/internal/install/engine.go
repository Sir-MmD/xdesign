package install

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// Step is one step of an installer, updater, restore or uninstall run
// (docs/plan/07-server-install-update.md section 3): Check (is it already done?), Act (do
// it) and Verify (did it work?). Completed steps are skipped, so running a list of
// steps again is always safe.
//
// A step changes the system only through the [Env] methods Run and Do, so that a dry
// run prints what it would do instead of doing it.
type Step struct {
	// Num is the step number shown to the owner, from the list of steps.go ("3b").
	Num string
	// ID is the stable machine name used in the log and in --json output
	// ("program-files").
	ID string
	// Title is the name shown on the step's line ("Program files").
	Title string
	// Check returns why the step can be skipped ("already installed"), or "" when
	// Act must run. A nil Check means the step always runs. Check must not change the
	// system: it also runs in dry runs, where an error is taken as "not done yet",
	// because a check often depends on an earlier step that a dry run does not do.
	Check func(ctx context.Context, env *Env) (skip string, err error)
	// Act does the work.
	Act func(ctx context.Context, env *Env) error
	// Verify confirms that Act worked. When nil, Check runs again and must report
	// the step as done; when Check is nil too, nothing is verified. Not run in dry
	// runs.
	Verify func(ctx context.Context, env *Env) error
	// ReadOnly marks a step that only reads the system (preflight): a dry run runs
	// it for real and reports it as done.
	ReadOnly bool
}

// Status is the outcome of a step.
type Status string

// Step outcomes.
const (
	// StatusDone means Act ran and the result was verified.
	StatusDone Status = "done"
	// StatusSkipped means Check found the work already done.
	StatusSkipped Status = "skipped"
	// StatusPlanned means a dry run printed what Act would do.
	StatusPlanned Status = "planned"
	// StatusFailed means Check, Act or Verify failed.
	StatusFailed Status = "failed"
)

// StepResult is what happened in one step.
type StepResult struct {
	Step   Step
	Status Status
	// Reason says why a skipped step was skipped.
	Reason string
	// Facts, Notes and Warnings are the lines the step added for the owner.
	Facts    []Fact
	Notes    []string
	Warnings []string
	// Planned holds the commands and operations of a dry run, in shell form.
	Planned []string
	// Err is the failure of a failed step.
	Err error
	// Command is the last command or operation the step ran, in shell form.
	Command string
}

// Fact is a value a step found or made, shown as " -> label  value" in the
// installer's output (docs/plan/07-server-install-update.md section 3): the system of
// preflight, the health check's time.
type Fact struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

// StepError reports the step that stopped a run.
type StepError struct {
	Step Step
	// Command is the last command or operation the step ran, in shell form.
	Command string
	Err     error
}

func (e *StepError) Error() string {
	return fmt.Sprintf("step %s %q failed: %v", e.Step.Num, e.Step.Title, e.Err)
}

func (e *StepError) Unwrap() error {
	return e.Err
}

// Reporter shows the progress of a run: a line per step on the terminal, or JSON
// lines. A reporter may also implement [ProgressReporter], to show how far the running
// step is (progress.go); the engine hands it to the [Env] for that. A reporter with a
// plan implements [WorkReporter] too, which the engine tells when a step does its work.
type Reporter interface {
	// StepStarted is called before a step's Check.
	StepStarted(s Step)
	// StepFinished is called with the outcome of the step.
	StepFinished(r StepResult)
}

// Engine runs steps in order.
type Engine struct {
	Env      *Env
	Reporter Reporter
}

// Run runs steps in order until one fails. It returns the results of the steps that
// ran and, when one failed, a [*StepError].
func (e *Engine) Run(ctx context.Context, steps []Step) ([]StepResult, error) {
	e.Env.attach(e.Reporter)
	results := make([]StepResult, 0, len(steps))
	for _, s := range steps {
		if err := ctx.Err(); err != nil {
			return results, &StepError{Step: s, Err: fmt.Errorf("stopped: %w", err)}
		}
		r := e.runStep(ctx, s)
		results = append(results, r)
		if r.Status == StatusFailed {
			return results, &StepError{Step: s, Command: r.Command, Err: r.Err}
		}
	}
	return results, nil
}

func (e *Engine) runStep(ctx context.Context, s Step) StepResult {
	env := e.Env
	env.begin(s.ID)
	e.Reporter.StepStarted(s)
	status := e.execute(ctx, s, env)
	cur := env.current()
	r := StepResult{
		Step: s, Status: status, Reason: cur.reason, Err: cur.err, Facts: cur.facts,
		Notes: cur.notes, Warnings: cur.warnings, Planned: cur.planned, Command: cur.lastCmd,
	}
	switch r.Status {
	case StatusFailed:
		env.log.Printf("step %s %s failed: %v", s.Num, s.ID, r.Err)
	case StatusSkipped:
		env.log.Printf("step %s %s skipped: %s", s.Num, s.ID, r.Reason)
	case StatusDone, StatusPlanned:
		env.log.Printf("step %s %s %s", s.Num, s.ID, r.Status)
	}
	e.Reporter.StepFinished(r)
	return r
}

func (e *Engine) execute(ctx context.Context, s Step, env *Env) Status {
	env.log.Printf("step %s %s: %s", s.Num, s.ID, s.Title)
	if s.Check != nil {
		skip, err := s.Check(ctx, env)
		switch {
		case err != nil && !env.DryRun:
			env.fail(fmt.Errorf("check: %w", err))
			return StatusFailed
		case err != nil:
			env.log.Printf("dry run: check of step %s could not run yet: %v", s.ID, err)
		case skip != "":
			env.skip(skip)
			return StatusSkipped
		}
	}
	// The step does its work: its share of the bar becomes that of its work
	// (Plan.Working).
	if w, ok := e.Reporter.(WorkReporter); ok && !env.DryRun {
		w.StepWorking(s)
	}
	if s.Act != nil {
		if err := s.Act(ctx, env); err != nil {
			env.fail(err)
			return StatusFailed
		}
	}
	if env.DryRun && !s.ReadOnly {
		return StatusPlanned
	}
	if err := verify(ctx, s, env); err != nil {
		env.fail(err)
		return StatusFailed
	}
	return StatusDone
}

func verify(ctx context.Context, s Step, env *Env) error {
	switch {
	case s.Verify != nil:
		if err := s.Verify(ctx, env); err != nil {
			return fmt.Errorf("verify: %w", err)
		}
	case s.Check != nil:
		skip, err := s.Check(ctx, env)
		if err != nil {
			return fmt.Errorf("verify: %w", err)
		}
		if skip == "" {
			return errors.New("verify: the step ran but its check still finds the work not done")
		}
	}
	return nil
}

// Env is what steps work with: the system, the install log and the dry-run switch.
// Steps read the system directly through Sys and change it only through Run and Do.
type Env struct {
	// Sys is the operating system.
	Sys host.System
	// DryRun makes Run and Do record what they would do instead of doing it.
	DryRun bool

	log    *Log
	masker *Masker
	mu     sync.Mutex
	cur    stepState
	// report holds what Report passes to the engine's reporter (progress.go).
	report reportState
}

// stepState collects what the running step reported.
type stepState struct {
	reason   string
	err      error
	facts    []Fact
	notes    []string
	warnings []string
	planned  []string
	lastCmd  string
}

// NewEnv returns an Env. log may be nil (no log file); masker may be nil (nothing to
// mask).
func NewEnv(sys host.System, log *Log, masker *Masker, dryRun bool) *Env {
	if masker == nil {
		masker = &Masker{}
	}
	if log == nil {
		log = NewLog(nil, masker)
	}
	return &Env{Sys: sys, DryRun: dryRun, log: log, masker: masker}
}

// begin forgets what the previous step reported; the step id starts.
func (e *Env) begin(id string) {
	e.beginReports(id)
	e.mu.Lock()
	defer e.mu.Unlock()
	e.cur = stepState{}
}

// current returns what the running step reported so far.
func (e *Env) current() stepState {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.cur
}

func (e *Env) fail(err error) {
	err = e.maskError(err)
	e.mu.Lock()
	defer e.mu.Unlock()
	e.cur.err = err
}

// maskedError is an error whose text has the run's secrets hidden; it unwraps to the
// error it hides, so errors.Is and errors.As still see the cause.
type maskedError struct {
	text string
	err  error
}

func (e *maskedError) Error() string { return e.text }

func (e *maskedError) Unwrap() error { return e.err }

// maskError returns err with the secrets of the run hidden in its text. A command that
// failed reports itself in shell form, so the text of an error must not reach the owner
// as it is.
func (e *Env) maskError(err error) error {
	if err == nil {
		return nil
	}
	text := err.Error()
	if masked := e.masker.Mask(text); masked != text {
		return &maskedError{text: masked, err: err}
	}
	return err
}

func (e *Env) skip(reason string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.cur.reason = reason
}

// Masker returns the masker of secrets that the log and the output use.
func (e *Env) Masker() *Masker {
	return e.masker
}

// Log returns the install log.
func (e *Env) Log() *Log {
	return e.log
}

// Query runs a command that only reads the system. It runs in dry runs too. Like
// [host.Runner.Run], a command that ran and failed is reported in the result, not as
// an error.
func (e *Env) Query(ctx context.Context, cmd host.Cmd) (host.Result, error) {
	e.setLast(cmd.String())
	e.log.Command("query", cmd)
	res, err := e.Sys.Runner.Run(ctx, cmd)
	e.log.Result(cmd, res, err)
	if err != nil {
		return res, fmt.Errorf("query: %w", err)
	}
	return res, nil
}

// Run runs a command that changes the system and returns an error unless it exits
// with status 0. A dry run records the command instead and returns an empty result.
func (e *Env) Run(ctx context.Context, cmd host.Cmd) (host.Result, error) {
	if e.DryRun {
		e.Plan(cmd.String())
		return host.Result{}, nil
	}
	e.setLast(cmd.String())
	e.log.Command("run", cmd)
	res, err := e.Sys.Runner.Run(ctx, cmd)
	e.log.Result(cmd, res, err)
	if err != nil {
		return res, fmt.Errorf("run: %w", err)
	}
	return res, res.Err(cmd)
}

// Do runs op, an operation in Go that changes the system, described in shell form
// by desc (for example "install -m 0644 ... /etc/sysusers.d/xdesign.conf"). A dry
// run records desc instead.
func (e *Env) Do(desc string, op func() error) error {
	if e.DryRun {
		e.Plan(desc)
		return nil
	}
	e.setLast(desc)
	e.log.Printf("do: %s", desc)
	if err := op(); err != nil {
		e.log.Printf("failed: %v", err)
		return err
	}
	return nil
}

// Plan records a line of the dry-run plan that is not a command, such as an
// explanation. It does nothing outside dry runs.
func (e *Env) Plan(line string) {
	if !e.DryRun {
		return
	}
	line = e.masker.Mask(line)
	e.mu.Lock()
	e.cur.planned = append(e.cur.planned, line)
	e.mu.Unlock()
	e.log.Printf("plan: %s", line)
}

// Factf adds a fact under the step's line: a value the step found or made, with its
// label (" -> health  ready after 6 s").
func (e *Env) Factf(label, format string, args ...any) {
	value := e.masker.Mask(fmt.Sprintf(format, args...))
	e.mu.Lock()
	e.cur.facts = append(e.cur.facts, Fact{Label: label, Value: value})
	e.mu.Unlock()
	e.log.Printf("fact: %s: %s", label, value)
}

// Notef adds an information line under the step's line.
func (e *Env) Notef(format string, args ...any) {
	line := e.masker.Mask(fmt.Sprintf(format, args...))
	e.mu.Lock()
	e.cur.notes = append(e.cur.notes, line)
	e.mu.Unlock()
	e.log.Printf("note: %s", line)
}

// Warnf adds a warning under the step's line.
func (e *Env) Warnf(format string, args ...any) {
	line := e.masker.Mask(fmt.Sprintf(format, args...))
	e.mu.Lock()
	e.cur.warnings = append(e.cur.warnings, line)
	e.mu.Unlock()
	e.log.Printf("warning: %s", line)
}

func (e *Env) setLast(cmd string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.cur.lastCmd = e.masker.Mask(cmd)
}

// Masker replaces secrets (passwords, generated credentials) in text before it
// reaches the log or the terminal. It is safe for concurrent use.
type Masker struct {
	mu      sync.Mutex
	secrets []maskedSecret
}

// maskedSecret is a secret with the text that stands for it.
type maskedSecret struct {
	secret, shown string
}

// maskedText replaces a secret.
const maskedText = "[masked]"

// Add registers a secret. Values shorter than 4 characters are ignored: masking them
// would garble unrelated text, and no real secret is that short.
func (m *Masker) Add(secret string) {
	m.AddAs(secret, maskedText)
}

// AddAs registers a secret that is shown as the given text. Secrets are replaced in the
// order they were registered, so register a whole value before a secret inside it.
func (m *Masker) AddAs(secret, shown string) {
	if len(secret) < 4 {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.secrets = append(m.secrets, maskedSecret{secret: secret, shown: shown})
}

// Mask returns s with every registered secret replaced.
func (m *Masker) Mask(s string) string {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, r := range m.secrets {
		s = strings.ReplaceAll(s, r.secret, r.shown)
	}
	return s
}
