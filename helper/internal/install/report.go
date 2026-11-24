package install

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"sync"
	"time"
)

// The marks at the start of each step line.
const (
	markRunning = "[ .. ]"
	markDone    = "[ ok ]"
	markWarn    = "[warn]"
	markSkipped = "[skip]"
	markPlanned = "[plan]"
	markFailed  = "[FAIL]"
	// subIndent lines up text under a step line, after its mark.
	subIndent = "         "
)

// The running line of the text reporter has a bar of 16 characters, where the
// installer's has 22 (pacman.go), and room for the longest label.
const (
	textBarWidth  = 16
	textLineWidth = 60
)

// TextReporter writes one line per step with a status mark, and the step's notes,
// warnings and dry-run plan indented below it. On a terminal it first prints the
// step with a running mark and then rewrites that line. With a Plan the running line
// also has a bar with the percent of the whole run and, after 5 seconds, the time the
// step has run, or, once the run's first 20 seconds are over, the time the run has left:
//
//	[ .. ] 8. Backup before the update  [#######---------]  41%  about 2 minutes left
//
// and without a terminal one line, between the steps' lines, each time the percent
// passes a multiple of 10. It redraws the running line every second by itself.
type TextReporter struct {
	W        io.Writer
	Terminal bool
	// Plan, when set, gives the running step its bar and the lines of the percent.
	Plan *Plan

	mu sync.Mutex
	// step is the running step, detail what it said it is doing, and noted the highest
	// multiple of 10 that a line was printed for; ended reports that the line of the
	// finished run (Done, 100%) was printed.
	step   Step
	detail string
	noted  int
	ended  bool
	// ticks redraws the running line every second.
	ticks redrawer
}

// StepStarted implements [Reporter].
func (t *TextReporter) StepStarted(s Step) {
	t.mu.Lock()
	t.step, t.detail = s, ""
	switch {
	case t.Plan != nil:
		t.draw(t.Plan.Start(s.ID, s.Title))
	case t.Terminal:
		fmt.Fprintf(t.W, "%s %s", markRunning, stepLabel(s))
	}
	t.mu.Unlock()
	if t.Plan != nil {
		t.ticks.start(t.tick)
	}
}

// StepWorking implements [WorkReporter].
func (t *TextReporter) StepWorking(s Step) {
	if t.Plan != nil {
		t.Plan.Working(s.ID)
	}
}

// StepExpect implements [ExpectReporter].
func (t *TextReporter) StepExpect(id string, d time.Duration) {
	t.Plan.Expect(id, d) // a nil plan does nothing
}

// tick redraws the running line, so it moves while the step says nothing.
func (t *TextReporter) tick() {
	t.mu.Lock()
	defer t.mu.Unlock()
	if rd := t.Plan.Reading(); rd.Step != "" {
		t.draw(rd)
	}
}

// StepProgress implements [ProgressReporter].
func (t *TextReporter) StepProgress(ev ProgressEvent) {
	if t.Plan == nil {
		return
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	rd := t.Plan.Progress(ev)
	if rd.Step == "" {
		return // a reading that came after the step ended
	}
	t.detail = rd.Detail
	t.draw(rd)
}

// draw redraws the running line on a terminal; without one it prints the line of the
// percent when that passed a multiple of 10. A step the plan does not list (one that a
// run takes when it goes back after a failure) has no share of the percent, so its line
// is the plain mark.
func (t *TextReporter) draw(rd Reading) {
	if !t.Terminal {
		t.note(rd)
		return
	}
	if !rd.Known {
		fmt.Fprint(t.W, eraseLine+markRunning+" "+stepLabel(t.step))
		return
	}
	text := stepLabel(t.step) + "..."
	if t.detail != "" {
		text = stepLabel(t.step) + ": " + t.detail
	}
	fmt.Fprint(t.W, "\r\x1b[K"+liveLine(markRunning+" ", text, textLineWidth, textBarWidth, rd.Percent, rd.tail()))
}

// note prints "         40%  Program files: 83 MB of 152 MB" under the steps' lines
// when the percent passed a multiple of 10 since the last such line. A terminal draws
// the percent in the running line instead.
func (t *TextReporter) note(rd Reading) {
	if t.Terminal || rd.Percent/10 <= t.noted {
		return
	}
	t.noted = rd.Percent / 10
	text := t.step.Title
	if t.detail != "" {
		text += ": " + t.detail
	}
	writeIndented(t.W, "", fmt.Sprintf("%d%%  %s", rd.Percent, text))
}

// StepFinished implements [Reporter].
func (t *TextReporter) StepFinished(r StepResult) {
	t.ticks.stop() // before the lock, which a redraw waits for
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.Terminal {
		// Carriage return and "erase to the end of the line" replace the running line.
		fmt.Fprint(t.W, "\r\x1b[K")
	}
	line := statusMark(r) + " " + stepLabel(r.Step)
	if r.Status == StatusSkipped && r.Reason != "" {
		line += ": " + r.Reason
	}
	fmt.Fprintln(t.W, line)
	for _, f := range r.Facts {
		writeIndented(t.W, "", f.Label+": "+f.Value)
	}
	for _, n := range r.Notes {
		writeIndented(t.W, "", n)
	}
	for _, w := range r.Warnings {
		writeIndented(t.W, "warning: ", w)
	}
	for _, p := range r.Planned {
		writeIndented(t.W, "", p)
	}
	if r.Status == StatusFailed && r.Err != nil {
		writeIndented(t.W, "error: ", r.Err.Error())
	}
	if t.Plan != nil {
		rd := t.Plan.Finish(r.Step.ID, r.Status)
		t.step, t.detail = r.Step, ""
		if r.Status != StatusFailed {
			t.note(rd)
			if rd.Complete && t.Terminal && !t.ended {
				// The end of the run says 100%, as the installer's does.
				t.ended = true
				fmt.Fprintln(t.W, liveLine(markDone+" ", "Done", textLineWidth, textBarWidth, rd.Percent, ""))
			}
		}
	}
}

func statusMark(r StepResult) string {
	switch r.Status {
	case StatusSkipped:
		return markSkipped
	case StatusPlanned:
		return markPlanned
	case StatusFailed:
		return markFailed
	case StatusDone:
		if len(r.Warnings) > 0 {
			return markWarn
		}
	}
	return markDone
}

func stepLabel(s Step) string {
	return s.Num + ". " + s.Title
}

// writeIndented writes text under a step line; continuation lines line up with the
// first line's text.
func writeIndented(w io.Writer, prefix, text string) {
	pad := strings.Repeat(" ", len(prefix))
	for i, line := range strings.Split(strings.TrimRight(text, "\n"), "\n") {
		if i == 0 {
			fmt.Fprintln(w, strings.TrimRight(subIndent+prefix+line, " "))
		} else {
			fmt.Fprintln(w, strings.TrimRight(subIndent+pad+line, " "))
		}
	}
}

// JSONReporter writes one JSON object per line for each step event (the progress lines of
// --json) and one for each reading of the running step's progress: ProgressLine. With a
// plan it also writes a progress line when the percent of the run moved while the step
// said nothing, so a reader of the lines (the website's maintenance runs) sees the bar
// creep.
type JSONReporter struct {
	W io.Writer
	// Plan, when set, gives the step and progress lines the percent of the whole run.
	Plan *Plan

	mu sync.Mutex
	// step is the ID of the running step, and sent the percent of the run in the last line.
	step string
	sent int
	// ticks looks at the percent every second.
	ticks redrawer
}

// StepEvent is one progress line of --json output. With a plan it also carries the
// percent of the whole run when the step started or ended, so a reader of the lines
// sees the percent move at every step and not only where a step reports.
type StepEvent struct {
	Event    string   `json:"event"`
	Num      string   `json:"num"`
	ID       string   `json:"id"`
	Title    string   `json:"title"`
	Status   string   `json:"status"`
	Percent  *int     `json:"percent,omitempty"`
	Reason   string   `json:"reason,omitempty"`
	Facts    []Fact   `json:"facts,omitempty"`
	Notes    []string `json:"notes,omitempty"`
	Warnings []string `json:"warnings,omitempty"`
	Planned  []string `json:"planned,omitempty"`
	Error    string   `json:"error,omitempty"`
}

// ProgressLine is the --json line of the progress of the running step:
//
//	{"event":"progress","step":"start","percent":83,
//	 "detail":"waiting for the website to answer (4 s)","elapsed_ms":4000}
//
// percent is the percent of the whole run (left out without a plan), step_percent the
// step's own (left out when the step has no total), and elapsed_ms the time the step
// has run.
type ProgressLine struct {
	Event       string `json:"event"`
	Step        string `json:"step"`
	Percent     *int   `json:"percent,omitempty"`
	StepPercent *int   `json:"step_percent,omitempty"`
	Detail      string `json:"detail,omitempty"`
	Done        int64  `json:"done,omitempty"`
	Total       int64  `json:"total,omitempty"`
	Unit        string `json:"unit,omitempty"`
	ElapsedMS   int64  `json:"elapsed_ms,omitempty"`
}

// StepStarted implements [Reporter].
func (j *JSONReporter) StepStarted(s Step) {
	j.mu.Lock()
	j.step = s.ID
	ev := StepEvent{Event: "step", Num: s.Num, ID: s.ID, Title: s.Title, Status: "started"}
	if j.Plan != nil {
		if rd := j.Plan.Start(s.ID, s.Title); rd.Known {
			ev.Percent, j.sent = &rd.Percent, rd.Percent
		}
	}
	j.write(ev)
	j.mu.Unlock()
	if j.Plan != nil {
		j.ticks.start(j.tick) // after the lock, which a tick of the step before may wait for
	}
}

// StepWorking implements [WorkReporter].
func (j *JSONReporter) StepWorking(s Step) {
	if j.Plan != nil {
		j.Plan.Working(s.ID)
	}
}

// StepExpect implements [ExpectReporter].
func (j *JSONReporter) StepExpect(id string, d time.Duration) {
	j.Plan.Expect(id, d) // a nil plan does nothing
}

// tick writes a progress line when the percent of the run moved since the last line.
func (j *JSONReporter) tick() {
	j.mu.Lock()
	defer j.mu.Unlock()
	if rd := j.Plan.Reading(); rd.Step != "" && rd.Known && rd.Percent != j.sent {
		j.progress(rd)
	}
}

// StepFinished implements [Reporter].
func (j *JSONReporter) StepFinished(r StepResult) {
	j.ticks.stop() // before the lock, which a tick waits for
	j.mu.Lock()
	defer j.mu.Unlock()
	ev := StepEvent{
		Event: "step", Num: r.Step.Num, ID: r.Step.ID, Title: r.Step.Title, Status: string(r.Status),
		Reason: r.Reason, Facts: r.Facts, Notes: r.Notes, Warnings: r.Warnings, Planned: r.Planned,
	}
	if r.Err != nil {
		ev.Error = r.Err.Error()
	}
	if j.Plan != nil {
		if rd := j.Plan.Finish(r.Step.ID, r.Status); rd.Known {
			ev.Percent, j.sent = &rd.Percent, rd.Percent
		}
	}
	j.write(ev)
}

// StepProgress implements [ProgressReporter].
func (j *JSONReporter) StepProgress(ev ProgressEvent) {
	j.mu.Lock()
	defer j.mu.Unlock()
	if j.Plan != nil {
		if rd := j.Plan.Progress(ev); rd.Step != "" { // a reading after the step ended is dropped
			j.progress(rd)
		}
		return
	}
	line := ProgressLine{Event: "progress", Step: j.step, Detail: ev.text(), Done: ev.Done, Total: ev.Total, Unit: ev.Unit}
	if p := ev.percent(); p >= 0 {
		line.StepPercent = &p
	}
	j.write(line)
}

// progress writes the progress line of a reading.
func (j *JSONReporter) progress(rd Reading) {
	line := ProgressLine{
		Event: "progress", Step: rd.Step, Detail: rd.Detail,
		Done: rd.Done, Total: rd.Total, Unit: rd.Unit, ElapsedMS: rd.Elapsed.Milliseconds(),
	}
	if rd.Known {
		line.Percent, j.sent = &rd.Percent, rd.Percent
	}
	if rd.StepPercent >= 0 {
		line.StepPercent = &rd.StepPercent
	}
	j.write(line)
}

// write writes one line; the caller holds the lock.
func (j *JSONReporter) write(v any) {
	b, err := json.Marshal(v)
	if err != nil {
		// Only strings, numbers and their slices: marshaling cannot fail.
		return
	}
	fmt.Fprintf(j.W, "%s\n", b)
}

// reporterSpec is what [newReporter] needs to build the reporter of a run.
type reporterSpec struct {
	// Stdout gets the lines of the text styles and Stderr those of --json.
	Stdout, Stderr io.Writer
	// Terminal reports that Stdout is a terminal, where the running step is redrawn.
	Terminal bool
	// JSON makes the --json lines of [JSONReporter].
	JSON bool
	// DryRun leaves the plan out: a dry run does nothing, so it shows no percent.
	DryRun bool
	// Steps make the plan: the steps of the whole run in the order they run, each with its
	// weight and its expected time (weights.go), and Family is the family of the system,
	// whose expected times the plan takes (systemFamily; empty takes apt's).
	Steps  stepList
	Family string
	// Out and Sections make the installer's [PacmanReporter] on Out, with the section
	// titles of its steps, in place of the text style of the other commands.
	Out      *printer
	Sections map[string]string
}

// newReporter builds the reporter of a run and the plan that gives every bar its percent.
// The installer, the update, the rollback and the uninstall all get theirs here, so they
// draw the same line, and their --json carries the same step and progress events. The plan
// is nil in a dry run, whose reporter shows no percent.
func newReporter(s reporterSpec) (Reporter, *Plan) {
	var plan *Plan
	if !s.DryRun {
		plan = newPlan(s.Steps, s.Family)
	}
	switch {
	case s.JSON:
		return &JSONReporter{W: s.Stderr, Plan: plan, sent: -1}, plan
	case s.Out != nil:
		return &PacmanReporter{p: s.Out, sections: s.Sections, dryRun: s.DryRun, plan: plan}, plan
	}
	return &TextReporter{W: s.Stdout, Terminal: s.Terminal, Plan: plan}, plan
}
