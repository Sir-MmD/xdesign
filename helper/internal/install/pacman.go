package install

import (
	"fmt"
	"io"
	"strings"
	"sync"
	"time"
)

// Output in pacman's style (xWriter's installer; docs/plan/07-server-install-update.md
// section 3): ":: Title..." starts a section (bold blue colons, bold text), " -> label
// value" lines give facts (bold blue arrow, values lined up), questions are "::" lines
// ending in [Y/n] or [y/N], the running step is a line with a bar redrawn on a terminal,
// "warning:" is bold yellow and "error:" bold red. Colors only where UseColor says; the
// install log and --json are not affected.

// ANSI sequences of pacman's colors.
const (
	ansiReset  = "\x1b[0m"
	ansiBold   = "\x1b[1m"
	ansiBlue   = "\x1b[1;34m"
	ansiYellow = "\x1b[1;33m"
	ansiRed    = "\x1b[1;31m"
	// eraseLine returns to the start of the line and clears it.
	eraseLine = "\r\x1b[K"
)

// Layout of the lines.
const (
	// factLabelWidth is the width of a fact's label; the values start after it, at
	// column factIndent.
	factLabelWidth = 13
	factIndent     = 18
	// noteIndent lines up the later lines of a note after its arrow; planIndent puts
	// the commands of a dry run under their step.
	noteIndent = 4
	planIndent = 6
	// pkgTextWidth is the width of the text of a running step's line before its bar, and
	// pkgBarWidth the number of # and - in the bar, so a line fits 80 columns.
	pkgTextWidth = 50
	pkgBarWidth  = 22
)

// UseColor decides whether the installer's output has colors: --no-color
// turns them off; FORCE_COLOR forces them and NO_COLOR turns them off, each when set
// and not empty; otherwise only a terminal gets colors.
func UseColor(terminal, noColor bool, getenv func(string) string) bool {
	switch {
	case noColor:
		return false
	case getenv != nil && getenv("FORCE_COLOR") != "":
		return true
	case getenv != nil && getenv("NO_COLOR") != "":
		return false
	}
	return terminal
}

// printer writes the installer's lines. On a terminal it can draw a line that the
// next output replaces: the running step with its bar. It is safe for concurrent use.
type printer struct {
	mu       sync.Mutex
	w        io.Writer
	color    bool
	terminal bool
	// transient reports that the running step's line is drawn without a line feed.
	transient bool
}

func newPrinter(w io.Writer, color, terminal bool) *printer {
	return &printer{w: w, color: color, terminal: terminal}
}

// paint wraps text in an ANSI style when colors are on.
func (p *printer) paint(style, text string) string {
	if !p.color || text == "" {
		return text
	}
	return style + text + ansiReset
}

func (p *printer) colon(text string) string {
	return p.paint(ansiBlue, "::") + " " + p.paint(ansiBold, text)
}

func (p *printer) arrow() string {
	return " " + p.paint(ansiBlue, "->") + " "
}

// write prints lines after the line that the next output replaces is settled.
func (p *printer) write(text string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.settle()
	fmt.Fprint(p.w, text)
}

// settle ends the replaceable line: the running step's line is cleared.
func (p *printer) settle() {
	if p.transient {
		fmt.Fprint(p.w, eraseLine)
		p.transient = false
	}
}

// indented returns text with its later lines indented by n spaces, ending in a line
// feed.
func indented(text string, n int) string {
	lines := strings.Split(strings.TrimRight(text, "\n"), "\n")
	pad := strings.Repeat(" ", n)
	for i := 1; i < len(lines); i++ {
		lines[i] = strings.TrimRight(pad+lines[i], " ")
	}
	return strings.Join(lines, "\n") + "\n"
}

// section prints ":: title".
func (p *printer) section(title string) {
	p.write(p.colon(title) + "\n")
}

// fact prints " -> label  value"; an empty label prints the value after the arrow.
func (p *printer) fact(label, value string) {
	if label == "" {
		p.note(value)
		return
	}
	pad := factLabelWidth - len(label)
	if pad < 1 {
		pad = 1
	}
	p.write(p.arrow() + label + strings.Repeat(" ", pad) + " " + indented(value, factIndent))
}

// note prints " -> text".
func (p *printer) note(text string) {
	p.write(p.arrow() + indented(text, noteIndent))
}

// warn prints "warning: text".
func (p *printer) warn(text string) {
	p.write(p.paint(ansiYellow, "warning:") + " " + indented(text, len("warning: ")))
}

// errorf prints "error: text".
func (p *printer) errorf(format string, args ...any) {
	p.write(p.paint(ansiRed, "error:") + " " + indented(fmt.Sprintf(format, args...), len("error: ")))
}

// line prints text as it is, with a line feed.
func (p *printer) line(text string) {
	p.write(text + "\n")
}

// prompt prints a question in pacman's style without a line feed: the answer follows
// on the same line.
func (p *printer) prompt(question string) {
	p.write(p.colon(question) + " ")
}

// running draws the running step's line on a terminal; the next output replaces it.
func (p *printer) running(text string) {
	if !p.terminal {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.settle()
	fmt.Fprint(p.w, p.arrow()+text)
	p.transient = true
}

// live draws the running step's line with its bar (liveLine) on a terminal, in place of
// the one drawn before; the next output replaces it.
func (p *printer) live(line string) {
	if !p.terminal {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.settle()
	fmt.Fprint(p.w, line)
	p.transient = true
}

// PacmanReporter shows the installer's steps in pacman's style: the ":: Section..."
// line of the steps that follow (left out when every step of a section was skipped
// without a word), each step's facts, notes and warnings, and on a terminal the running
// step on a line that the next output replaces. With a plan that line has a bar with the
// percent of the whole run and, after 5 seconds, the time the step has run, or, once the
// run's first 20 seconds are over, the time the run has left; without a terminal a line
// shows the percent each time it passes a multiple of 10, and the line is redrawn every
// second by itself. A dry run also shows every step with
// what it would do, and no percent. A failed step's error is left to the failure block
// of the run (output.go).
type PacmanReporter struct {
	p *printer
	// sections maps step IDs to the title of their section; dryRun shows every step.
	sections map[string]string
	dryRun   bool
	// plan gives the percent of the whole run; nil leaves it out.
	plan *Plan

	mu sync.Mutex
	// step is the running step and title its title; section the title printed last.
	step    string
	title   string
	section string
	// detail is what the running step said it is doing, and noted the highest multiple
	// of 10 that a line was printed for.
	detail string
	noted  int
	// ticks redraws the running line every second.
	ticks redrawer
}

// StepStarted implements [Reporter].
func (pr *PacmanReporter) StepStarted(s Step) {
	pr.mu.Lock()
	pr.step, pr.title, pr.detail = s.ID, s.Title, ""
	ticks := false
	switch {
	case pr.dryRun:
	case pr.plan != nil:
		pr.drawLive(pr.plan.Start(s.ID, s.Title))
		ticks = true
	default:
		pr.p.running(s.Title + "...")
	}
	pr.mu.Unlock()
	if ticks {
		pr.ticks.start(pr.tick)
	}
}

// StepWorking implements [WorkReporter].
func (pr *PacmanReporter) StepWorking(s Step) {
	if pr.plan != nil && !pr.dryRun {
		pr.plan.Working(s.ID)
	}
}

// StepExpect implements [ExpectReporter].
func (pr *PacmanReporter) StepExpect(id string, d time.Duration) {
	if !pr.dryRun {
		pr.plan.Expect(id, d) // a nil plan does nothing
	}
}

// tick redraws the running step's line, so the bar moves while the step says nothing;
// without a terminal it prints the line of the percent when that passed a multiple of 10.
func (pr *PacmanReporter) tick() {
	pr.mu.Lock()
	defer pr.mu.Unlock()
	rd := pr.plan.Reading()
	switch {
	case rd.Step == "":
	case !pr.p.terminal:
		pr.noteProgress(rd, true)
	default:
		pr.drawLive(rd)
	}
}

// StepProgress implements [ProgressReporter].
func (pr *PacmanReporter) StepProgress(ev ProgressEvent) {
	if pr.plan == nil || pr.dryRun {
		return
	}
	pr.mu.Lock()
	defer pr.mu.Unlock()
	rd := pr.plan.Progress(ev)
	if rd.Step == "" {
		return // a reading that came after the step ended
	}
	pr.detail = rd.Detail
	if !pr.p.terminal {
		pr.noteProgress(rd, true)
	} else {
		pr.drawLive(rd)
	}
}

// drawLive draws the running step's line on a terminal: its title and what it is
// doing, the bar and the percent of the whole run, and the time the run has left or the
// time the step has run.
func (pr *PacmanReporter) drawLive(rd Reading) {
	text := pr.title + "..."
	if pr.detail != "" {
		text = pr.title + ": " + pr.detail
	}
	pr.p.live(liveLine("", text, pkgTextWidth, pkgBarWidth, rd.Percent, rd.tail()))
}

// noteProgress prints " -> 40%  Program files: 83 MB of 152 MB" when the percent passed
// a multiple of 10 since the last such line, for a run without a terminal. Inside a step
// the line goes under the step's section, which may not have been printed yet.
func (pr *PacmanReporter) noteProgress(rd Reading, inStep bool) {
	if pr.p.terminal || rd.Percent/10 <= pr.noted {
		return
	}
	pr.noted = rd.Percent / 10
	if inStep {
		pr.header(pr.step)
	}
	text := pr.title
	if pr.detail != "" {
		text += ": " + pr.detail
	}
	pr.p.note(fmt.Sprintf("%d%%  %s", rd.Percent, text))
}

// StepFinished implements [Reporter].
func (pr *PacmanReporter) StepFinished(r StepResult) {
	pr.ticks.stop() // before the lock, which a redraw waits for
	pr.mu.Lock()
	defer pr.mu.Unlock()
	pr.title = r.Step.Title
	pr.print(r)
	if pr.plan == nil || pr.dryRun {
		return
	}
	rd := pr.plan.Finish(r.Step.ID, r.Status)
	pr.detail = ""
	if r.Status == StatusFailed {
		return
	}
	pr.noteProgress(rd, false)
	if rd.Complete && pr.p.terminal {
		// The end of the run says 100%; the line of a step is gone with the next output.
		pr.p.line(liveLine("", "Done", pkgTextWidth, pkgBarWidth, rd.Percent, ""))
	}
}

// print shows the end of a step: its section, facts, notes and warnings.
func (pr *PacmanReporter) print(r StepResult) {
	visible := pr.dryRun || r.Status != StatusSkipped || len(r.Facts)+len(r.Notes)+len(r.Warnings) > 0
	if !visible {
		pr.p.write("") // clears the running step's line
		return
	}
	pr.header(r.Step.ID)
	if pr.dryRun {
		line := r.Step.Num + ". " + r.Step.Title
		if r.Status == StatusSkipped {
			line += ": skipped"
			if r.Reason != "" {
				line += ", " + r.Reason
			}
		}
		pr.p.note(line)
		for _, planned := range r.Planned {
			pr.p.write(strings.Repeat(" ", planIndent) + indented(planned, planIndent))
		}
	}
	for _, f := range r.Facts {
		pr.p.fact(f.Label, f.Value)
	}
	for _, n := range r.Notes {
		pr.p.note(n)
	}
	for _, w := range r.Warnings {
		pr.p.warn(w)
	}
}

// header prints the section of the step when it differs from the one printed last.
func (pr *PacmanReporter) header(stepID string) {
	title := pr.sections[stepID]
	if title == "" || title == pr.section {
		return
	}
	pr.section = title
	pr.p.section(title)
}
