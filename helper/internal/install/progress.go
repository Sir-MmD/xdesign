package install

import (
	"context"
	"fmt"
	"math"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// Progress of a run, as xWriter's installer shows it.
//
// Every bar shows the percent of the whole run: the shares of the finished steps plus the
// running step's part of its share, as a percent of all the shares (weights.go). A step
// says how far it is with [Env.Report]; the reporter keeps a [Plan] of the run's steps and
// turns that into one number from 0 to 100 that never goes down and stays at 99 until the
// last step ends. A step that reports no real fraction creeps: its part rises with its
// time along an easing curve, to 90% of its share by its expected time and slower after
// that, never past 95% before it ends, so the bar never stands still for long and never
// jumps by more than a small rest when a step ends. After the run's first 20 seconds the
// line says about how long the run has left. A reporter with a plan redraws the running
// step's line every second by itself (redrawer), so the bar moves while a step is silent.
// The waits report what they wait for and for how long (waiter, below), so every line says
// what is happening. A step's share follows its real time: a step whose time depends on its
// data says so when it starts (Env.Expect), the steps that typical runs make do their work
// take the times an earlier run recorded (Plan.LearnTimes), and a skipped step keeps only
// the part of the bar its check took (Plan.Finish), so a step much quicker than its
// declared time does not make the bar jump when it ends.

// ProgressEvent is one reading of the running step: how far it is as a fraction and in
// counts, and what it is doing.
type ProgressEvent struct {
	// Fraction is how much of the step is done, from 0 to 1: a step that works in phases
	// weighs them itself. Without a Fraction above 0 the fraction is
	// Done of Total; a Fraction below 0 and no Total say that the step has no known total:
	// its part of the bar creeps, or keeps the last real fraction the step reported.
	Fraction float64
	// Done and Total count Unit ("bytes", "files") for the line and the JSON; Total 0
	// says that the total is not known.
	Done, Total int64
	Unit        string
	// Detail says what the step is doing now ("waiting for the website to answer
	// (12 s)"). When it is empty a step with a total shows "12 of 97 files", or "83 MB of
	// 152 MB" for bytes.
	Detail string
	// Timed reports that Detail says itself how long the step has waited ("waiting for
	// the website to answer (12 s)", waiter), so the end of the line does not show the
	// step's time a second time.
	Timed bool
}

// ProgressReporter is implemented by the reporters that show the progress of the
// running step. [Engine.Run] hands its reporter to the [Env] when the reporter has this
// method, so [Env.Report] reaches it; a reporter without it drops the readings.
type ProgressReporter interface {
	// StepProgress shows one reading of the running step. Env.Report has thinned the
	// readings out already.
	StepProgress(ev ProgressEvent)
}

// WorkReporter is implemented by the reporters with a plan: [Engine.Run]
// tells them when the check of a step found its work not done, before its act runs, so a
// step that typical runs find done takes the share of its work (Plan.Working).
type WorkReporter interface {
	// StepWorking reports that the step s, which runs, does its work.
	StepWorking(s Step)
}

// ExpectReporter is implemented by the reporters with a plan:
// [Env.Expect] tells them how long the running step is expected to take once what it works
// on says so, so the step's share of the bar is its share of the run's time (Plan.Expect).
// A reporter wrapper must forward it, as it forwards StepWorking.
type ExpectReporter interface {
	// StepExpect reports that the running step id is expected to take d.
	StepExpect(id string, d time.Duration)
}

// reportInterval is the shortest time between two readings that [Env.Report] passes on:
// four a second.
const reportInterval = 250 * time.Millisecond

// reportState is what [Env.Report] remembers: where the readings go, and the last one
// it passed on, so it can leave out the rest.
type reportState struct {
	mu   sync.Mutex
	sink ProgressReporter
	// step is the ID of the running step and start when it started; sent reports that a
	// reading of the step was passed on, at time at and with key.
	step  string
	start time.Time
	sent  bool
	at    time.Time
	key   reportKey
}

// reportKey is what makes a reading a repeat of the one before: the step's percent and
// the detail, and for a step without a total also the seconds it has run, because the
// time is then the only thing that moves.
type reportKey struct {
	percent int
	detail  string
	seconds int
}

// attach hands the reporter of an engine to the env: the readings of [Env.Report] go to
// it when it shows them.
func (e *Env) attach(r Reporter) {
	e.report.mu.Lock()
	defer e.report.mu.Unlock()
	if sink, ok := r.(ProgressReporter); ok {
		e.report.sink = sink
	} else {
		e.report.sink = nil
	}
}

// beginReports forgets the readings of the step before; the step id starts now.
func (e *Env) beginReports(id string) {
	now := time.Now()
	e.report.mu.Lock()
	defer e.report.mu.Unlock()
	e.report.step, e.report.start, e.report.sent = id, now, false
}

// Report shows how far the running step is: the one way a step reports a real fraction
// and says what it is doing. It passes on at most four readings a second, and none that
// repeats the last percent and detail (a step without a total repeats only within the same
// second), so a step may call it as often as it likes. A dry run reports nothing.
func (e *Env) Report(ev ProgressEvent) {
	if e.DryRun {
		return
	}
	ev.Fraction = ev.fraction()
	e.report.mu.Lock()
	defer e.report.mu.Unlock()
	if e.report.sink == nil {
		return
	}
	now := time.Now()
	key := reportKey{percent: ev.percent(), detail: ev.text(), seconds: -1}
	if ev.Fraction < 0 {
		key.seconds = int(now.Sub(e.report.start) / time.Second)
	}
	if e.report.sent && (key == e.report.key || now.Sub(e.report.at) < reportInterval) {
		return
	}
	e.report.sent, e.report.at, e.report.key = true, now, key
	e.report.sink.StepProgress(ev)
}

// Expect tells the plan of the run how long the running step is expected to take, once
// what it works on says so: the migrations it applies, the size of
// the backup it writes or of the dump it restores. The step's share of the bar becomes that
// time and the bar goes on from where it is (Plan.Expect). A dry run, and a run whose
// reporter has no plan, change nothing.
func (e *Env) Expect(d time.Duration) {
	if e.DryRun {
		return
	}
	e.report.mu.Lock()
	defer e.report.mu.Unlock()
	if x, ok := e.report.sink.(ExpectReporter); ok {
		x.StepExpect(e.report.step, d)
	}
}

// fraction is how much of the step is done, from 0 to 1, or -1 when that is not known:
// the Fraction when it is above 0, else Done of Total, else 0 for a Fraction of 0.
func (ev ProgressEvent) fraction() float64 {
	switch {
	case ev.Fraction > 0:
		return math.Min(ev.Fraction, 1)
	case ev.Total > 0:
		return math.Min(math.Max(float64(ev.Done)/float64(ev.Total), 0), 1)
	case ev.Fraction == 0:
		return 0
	}
	return -1 // below 0, or not a number
}

// percent is the step's own percent, -1 when the fraction is not known.
func (ev ProgressEvent) percent() int {
	f := ev.fraction()
	if f < 0 {
		return -1
	}
	return int(f * 100)
}

// text is what the step is doing: its detail, or else the counts.
func (ev ProgressEvent) text() string {
	switch {
	case ev.Detail != "":
		return ev.Detail
	case ev.Total <= 0:
		return ""
	case ev.Unit == "bytes":
		return formatBytes(uint64(max(ev.Done, 0))) + " of " + formatBytes(uint64(ev.Total))
	}
	return fmt.Sprintf("%d of %d %s", ev.Done, ev.Total, ev.Unit)
}

// Reading is where a run stands: the overall percent and the running step's own
// numbers.
type Reading struct {
	// Step is the ID of the running step; empty between steps.
	Step string
	// Known reports that the plan lists the running step. The steps a run takes when it
	// goes back after a failure are not listed: they have no share of the percent, so
	// their lines show none.
	Known bool
	// Percent is the percent of the whole run, 0 to 100.
	Percent int
	// StepPercent is the running step's own percent, -1 when it is not known.
	StepPercent int
	// Elapsed is the time the running step has run.
	Elapsed time.Duration
	// Left is the time the run is expected to go on; 0 while it cannot be
	// known: in the run's first 20 seconds, while a step the plan does not list runs, and
	// when only a step that ran past its expected time is left.
	Left time.Duration
	// Done, Total, Unit and Detail are what the step last reported, and Timed whether its
	// Detail says how long it has waited.
	Done, Total int64
	Unit        string
	Detail      string
	Timed       bool
	// Complete reports that every step of the plan has finished.
	Complete bool
}

// tail is the end of the running step's line (liveLine): the time the run has left once
// it is known, padded to leftTextWidth so the bar keeps its width while it changes, else,
// after showElapsedAfter, the time the step has run, unless its words say that already
// (Timed).
func (rd Reading) tail() string {
	switch {
	case rd.Left > 0:
		return fmt.Sprintf("%-*s", leftTextWidth, leftText(rd.Left))
	case rd.Elapsed >= showElapsedAfter && !rd.Timed:
		return formatElapsed(rd.Elapsed)
	}
	return ""
}

// planStep is a step of a plan: its numbers from its list, and what became of it.
type planStep struct {
	spec stepSpec
	// share is what the step's part of the bar is worth now, in seconds of a typical run:
	// its weight on the run's family, and its expected time once its check found work, when
	// that is more (Plan.Working); the time its data or an earlier run tells (Plan.Expect,
	// Plan.LearnTimes); and only the part its check took once it was skipped (Plan.Finish).
	share float64
	// expect is its expected time on the run's family, or the one its data or an earlier
	// run tells.
	expect time.Duration
	// done reports that it finished: done, or skipped. status is how it ended, empty while
	// it has not, and for a step of an update's first stage whose times did not come over;
	// took is how long it ran.
	done   bool
	status Status
	took   time.Duration
	// title is the step's words as the run showed them (Start), which its record in
	// install.json keeps; empty until it starts.
	title string
}

// Plan is the list of the steps of a run with the numbers of each (weights.go), and how
// far the run is through them. A step's share is what its part of the percent is worth; a
// finished step counts whole, and a skipped one only with the part its check took, so a
// repair that skips most steps moves by the time its checks and its work take
// A reporter holds a Plan and
// asks it for the percent at every step start, reading, end and redraw. It is safe for
// concurrent use.
type Plan struct {
	begun time.Time

	mu sync.Mutex
	// family is the family whose expected times the plan uses (distro.go).
	family string
	steps  []planStep
	// running reports that a step runs, with ID runID since runAt; cur is its place in
	// steps, -1 when the plan does not list it (a step the plan does not know weighs
	// nothing).
	running bool
	runID   string
	runAt   time.Time
	cur     int
	// frac is the last real fraction the running step reported, negative while it reported
	// none; from is the part of its share the bar showed when the first one came, so the
	// switch from creeping neither stalls the bar nor makes it jump.
	frac   float64
	from   float64
	done   int64
	total  int64
	unit   string
	detail string
	timed  bool
	// base and baseShare rebase the bar when the total of the shares changes during the
	// run (a step whose check found work, a list made again): the percent goes on from base,
	// and the share done above baseShare fills the rest of the bar.
	base, baseShare float64
	// shown is the highest percent given out, so the percent never goes down.
	shown int
}

// newPlan returns the plan of a run that takes the steps of list in order (weights.go),
// with the expected times of the family (distro.go; empty takes apt's).
func newPlan(list stepList, family string) *Plan {
	p := &Plan{begun: time.Now(), family: family, cur: -1, frac: -1}
	p.setLocked(list)
	return p
}

// stepIDs returns the IDs of steps.
func stepIDs(steps []Step) []string {
	ids := make([]string, len(steps))
	for i, s := range steps {
		ids[i] = s.ID
	}
	return ids
}

// SetSteps replaces the list of steps, for a run whose list changes after its answers; the
// steps that finished stay finished, and the bar goes on from where it is.
func (p *Plan) SetSteps(list stepList) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.rebaseLocked(func() { p.setLocked(list) })
}

func (p *Plan) setLocked(list stepList) {
	finished := map[string][]planStep{}
	for _, s := range p.steps {
		if s.done {
			finished[s.spec.id] = append(finished[s.spec.id], s)
		}
	}
	steps := make([]planStep, 0, len(list))
	for _, spec := range list {
		s := planStep{spec: spec, share: spec.share(p.family), expect: spec.expect.on(p.family)}
		if old := finished[spec.id]; len(old) > 0 {
			s.share, s.done, s.status, s.took = max(s.share, old[0].share), true, old[0].status, old[0].took
			s.title = old[0].title // its words for the record
			finished[spec.id] = old[1:]
		}
		steps = append(steps, s)
	}
	p.steps = steps
	p.cur = -1
	if p.running {
		p.cur = p.findLocked(p.runID)
	}
}

// DoneBefore counts every step before the step id as finished: the second stage of an
// update lists the first stage's steps too and starts where that stage ended. earlier are
// the times of those steps that the first stage handed over (EnvUpdateSteps); a step they
// lack counts as done without a time, and one they say was skipped keeps the part of its
// share that its check took there (Finish), so the percent goes on from the same
// number. An ID the plan lacks changes nothing.
func (p *Plan) DoneBefore(id string, earlier []StepTime) {
	p.mu.Lock()
	defer p.mu.Unlock()
	at := slices.IndexFunc(p.steps, func(s planStep) bool { return s.spec.id == id })
	for i := 0; i < at; i++ {
		s := &p.steps[i]
		s.done = true
		if j := slices.IndexFunc(earlier, func(t StepTime) bool { return t.ID == s.spec.id }); j >= 0 {
			s.status, s.took = Status(earlier[j].Status), time.Duration(earlier[j].TookMS)*time.Millisecond
			s.title = earlier[j].Title // the first stage's words
			if s.status == StatusSkipped {
				s.share *= creep(s.took, s.expect)
			}
		}
	}
}

// Complete counts every step as finished, for a run that ended well with a step of the
// list left out.
func (p *Plan) Complete() Reading {
	p.mu.Lock()
	defer p.mu.Unlock()
	for i := range p.steps {
		p.steps[i].done = true
	}
	return p.readingLocked()
}

// findLocked returns the place of the first unfinished step id, -1 for none.
func (p *Plan) findLocked(id string) int {
	for i, s := range p.steps {
		if s.spec.id == id && !s.done {
			return i
		}
	}
	return -1
}

// Start records that the step id started, with its words (its Title) for its record.
func (p *Plan) Start(id, title string) Reading {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.running, p.runID, p.runAt = true, id, time.Now()
	p.cur = p.findLocked(id)
	if p.cur >= 0 {
		p.steps[p.cur].title = title
	}
	p.frac, p.from, p.done, p.total, p.unit, p.detail, p.timed = -1, 0, 0, 0, "", "", false
	return p.readingLocked()
}

// Working records that the check of the running step id found work to do (WorkReporter): a
// step whose share is below its expected time (one that typical runs find done, such as the
// program files of a repair) takes its expected time as its share, and the
// bar goes on from where it is, so the step's work moves it and the change neither moves it
// back nor makes it jump.
func (p *Plan) Working(id string) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if !p.running || p.cur < 0 || p.steps[p.cur].spec.id != id {
		return
	}
	s := &p.steps[p.cur]
	if work := s.expect.Seconds(); work > s.share {
		p.rebaseLocked(func() { s.share = work })
	}
}

// Expect sets the time the step id is expected to take, from what it works on or from an
// earlier run: the step that runs with that ID, or else the first
// one with it that has not finished. Its share becomes that time too, at least a second, so
// its share of the bar is its share of the run's time, and the bar goes on from where it is
// (as with Working): a step much quicker than its declared time leaves only a small rest for
// its end, and a slower one creeps by its own time. A nil plan (a dry run) does nothing.
func (p *Plan) Expect(id string, d time.Duration) {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	i := p.cur
	if !p.running || i < 0 || p.steps[i].spec.id != id {
		i = p.findLocked(id)
	}
	if i < 0 {
		return
	}
	s := &p.steps[i]
	d = max(d, time.Second)
	p.rebaseLocked(func() { s.expect, s.share = d, d.Seconds() })
}

// LearnTimes takes the expected times of the plan's steps from the times they took in the
// earlier runs of history, oldest first (install.json): a step that
// typical runs make do its work (stepSpec.learns) and that has not finished takes the time
// the same step took the last time a run recorded it done (Expect). So the steps whose time
// nothing else tells, such as the website's start with its health check, weigh what they
// take on this server. The runs of an
// uninstall are left out: their steps of the same names undo the work. A step whose data
// tells its time says so when it starts (Env.Expect), and a step no run recorded keeps its
// declared time. A nil plan does nothing.
func (p *Plan) LearnTimes(history []HistoryEntry) {
	if p == nil {
		return
	}
	took := map[string]time.Duration{}
	for _, e := range history {
		if e.Action == ActionUninstall {
			continue
		}
		for _, t := range e.Steps {
			if t.Status == string(StatusDone) && t.TookMS > 0 {
				took[t.ID] = time.Duration(t.TookMS) * time.Millisecond // a newer run's time replaces an older one's
			}
		}
	}
	if len(took) == 0 {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.rebaseLocked(func() {
		for i := range p.steps {
			s := &p.steps[i]
			if d, ok := took[s.spec.id]; ok && !s.done && s.spec.learns() {
				s.expect = max(d, time.Second)
				s.share = s.expect.Seconds()
			}
		}
	})
}

// learns reports whether the step takes its expected time from earlier runs
// (Plan.LearnTimes): its weight is its expected time with apt, so typical runs make it do
// its work (weights.go), and at least 2 seconds. A step that typical runs find done keeps
// the weight of its check, and one that a flag leaves without work its second.
func (s stepSpec) learns() bool {
	return s.weight >= 2 && time.Duration(s.weight)*time.Second == s.expect.apt
}

// Progress records a reading of the running step. A reading that comes while no step
// runs (a late one) changes nothing. A reading without a real fraction keeps the last one
// the step reported.
func (p *Plan) Progress(ev ProgressEvent) Reading {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.running {
		if f := ev.fraction(); f >= 0 {
			if p.frac < 0 {
				p.from = p.creepLocked(time.Now())
			}
			p.frac = f
		}
		p.done, p.total, p.unit, p.detail, p.timed = ev.Done, ev.Total, ev.Unit, ev.text(), ev.Timed
	}
	return p.readingLocked()
}

// Finish records that the step id ended with status; a failed step does not count as done.
// A skipped step did only its check: it keeps the part of its
// share that the bar showed while the check ran, about the time the check took, and the
// rest of its share goes, the reverse of Working, with the bar where it is, so a step with
// a big share that a run finds done does not make the bar jump. The reading has the step's
// own numbers as they stood and the percent of the run after it.
func (p *Plan) Finish(id string, status Status) Reading {
	p.mu.Lock()
	defer p.mu.Unlock()
	rd := p.readingLocked()
	i := p.cur
	if i < 0 || p.steps[i].spec.id != id {
		i = p.findLocked(id)
	}
	end := func() {
		if i >= 0 {
			s := &p.steps[i]
			s.done, s.status = status != StatusFailed, status
			if p.running && p.runID == id {
				s.took = time.Since(p.runAt)
			}
		}
		p.running, p.cur = false, -1
	}
	if status == StatusSkipped && i >= 0 {
		part := 0.0
		if p.running && i == p.cur {
			part = p.partLocked(time.Now())
		}
		s := &p.steps[i]
		p.rebaseLocked(func() {
			s.share *= part
			end()
		})
	} else {
		end()
	}
	p.frac, p.from, p.done, p.total, p.unit, p.detail, p.timed = -1, 0, 0, 0, "", "", false
	rd.Percent, rd.Complete = p.percentLocked()
	return rd
}

// Reading returns where the run stands now.
func (p *Plan) Reading() Reading {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.readingLocked()
}

// Times returns the family of the plan's expected times and the times of the steps that
// ended so far, in the order of the plan, for the run's entry in install.json; nothing for
// a nil plan (a dry run). The expected time is the one weights.go declares, not the one the
// step's data or an earlier run gave this run, so the records tune the declared times.
func (p *Plan) Times() (family string, times []StepTime) {
	if p == nil {
		return "", nil
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	for _, s := range p.steps {
		if s.status == "" {
			continue
		}
		times = append(times, StepTime{
			ID: s.spec.id, Status: string(s.status), ExpectedMS: s.spec.expect.on(p.family).Milliseconds(), TookMS: s.took.Milliseconds(),
			Title: s.title,
		})
	}
	return p.family, times
}

// Elapsed is the time since the plan was made, or since [Plan.Restart]: how long the run
// took so far.
func (p *Plan) Elapsed() time.Duration {
	p.mu.Lock()
	defer p.mu.Unlock()
	return time.Since(p.begun)
}

// Restart starts counting the time of the run from now. A run calls it when the owner
// has answered its questions, so the time they took to think is not part of the run. A
// nil plan (a dry run) does nothing.
func (p *Plan) Restart() {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.begun = time.Now()
}

// Took is how long the run took, for the end block ("3 min 12 s"); empty without a plan
// and for a run that took under a second.
func (p *Plan) Took() string {
	if p == nil {
		return ""
	}
	if took := p.Elapsed(); took >= time.Second {
		return formatElapsed(took)
	}
	return ""
}

func (p *Plan) readingLocked() Reading {
	now := time.Now()
	rd := Reading{
		Step: p.runID, StepPercent: -1, Done: p.done, Total: p.total, Unit: p.unit, Detail: p.detail, Timed: p.timed,
	}
	if !p.running {
		rd.Step = ""
	} else {
		rd.Known = p.cur >= 0
		rd.Elapsed = now.Sub(p.runAt)
	}
	if p.frac >= 0 {
		rd.StepPercent = int(p.frac * 100)
	}
	rd.Percent, rd.Complete = p.percentLocked()
	rd.Left = p.leftLocked(now)
	return rd
}

// The creeping of a step without a real fraction: creepAt of its
// share by its expected time, never creepCap before it ends.
const (
	creepAt  = 0.9
	creepCap = 0.95
)

// creep is the part of its share that a step without a real fraction is shown to have
// done after running for elapsed, when it is expected to take expect: an easing curve that
// is quick at first and reaches 90% at the expected time, then slower, halfway to 95% at
// twice the expected time, and never 95%: the rest fills when the step ends.
func creep(elapsed, expect time.Duration) float64 {
	if elapsed <= 0 {
		return 0
	}
	t := float64(elapsed) / float64(max(expect, time.Second))
	if t <= 1 {
		return creepAt * t * (2 - t)
	}
	return creepCap - (creepCap-creepAt)/t
}

// creepLocked is the creeping part of the running step at now; 0 for a step the plan does
// not list.
func (p *Plan) creepLocked(now time.Time) float64 {
	if !p.running || p.cur < 0 {
		return 0
	}
	return creep(now.Sub(p.runAt), p.steps[p.cur].expect)
}

// partLocked is the part of its share that the running step has done, 0 to 1: its real
// fraction, which fills what the creeping had not when it came, or else the creeping.
func (p *Plan) partLocked(now time.Time) float64 {
	if p.frac >= 0 {
		return p.from + (1-p.from)*p.frac
	}
	return p.creepLocked(now)
}

// shareLocked adds up the shares: done is that of the finished steps with the running
// step's part of its own, total that of every step, and open counts the steps that have
// not finished.
func (p *Plan) shareLocked(now time.Time) (done, total float64, open int) {
	for _, s := range p.steps {
		total += s.share
		if s.done {
			done += s.share
		} else {
			open++
		}
	}
	if p.running && p.cur >= 0 {
		done += p.steps[p.cur].share * p.partLocked(now)
	}
	return done, total, open
}

// valueLocked is the percent of the whole run as a number, before it is held at 99 and kept
// from going down: the share done as a part of all the shares, from the last rebase on. ok
// is false for a plan without shares.
func (p *Plan) valueLocked(now time.Time) (value float64, open int, ok bool) {
	done, total, open := p.shareLocked(now)
	if total <= 0 {
		return 0, open, false
	}
	value = p.base
	if rest := total - p.baseShare; rest > 0 {
		value += (100 - p.base) * (done - p.baseShare) / rest
	}
	return value, open, true
}

// percentLocked is the percent of the whole run (valueLocked). It never goes down, and it
// stays at 99 until every step has finished.
func (p *Plan) percentLocked() (percent int, complete bool) {
	value, open, ok := p.valueLocked(time.Now())
	if !ok {
		return p.shown, false
	}
	percent = int(value)
	complete = open == 0
	switch {
	case complete:
		percent = 100
	case percent > 99:
		percent = 99
	}
	p.shown = max(p.shown, percent)
	return p.shown, complete
}

// rebaseLocked makes change, a change of the total of the shares during the run, without
// moving the bar: the percent goes on from where it is, and the share done after the change
// fills the rest of the bar from there.
func (p *Plan) rebaseLocked(change func()) {
	now := time.Now()
	value, _, _ := p.valueLocked(now)
	base := min(max(value, float64(p.shown)), 100)
	change()
	done, _, _ := p.shareLocked(now)
	p.base, p.baseShare = base, done
}

// The time left of a run.
const (
	// leftAfter is how long a run goes before its line says how long it has left.
	leftAfter = 20 * time.Second
	// speedAfter is how much expected time the steps that did their work must have before
	// the run's speed is taken from them; until then the run counts as typical. speedMin
	// and speedMax bound that speed, a run four times slower than expected still gets a
	// number.
	speedAfter = 10 * time.Second
	speedMin   = 0.25
	speedMax   = 4.0
	// ownSpeedAfter is the part of its work a running step must have reported before its
	// rest is taken from its own speed.
	ownSpeedAfter = 0.1
)

// leftLocked is the time the run is expected to go on at now: the shares of the steps to
// come, which are seconds of a typical run, and the rest of the running step's, at the
// speed of the run so far (the time the steps that did their work took, against their
// expected times; a running step past its expected time counts too). A running step that
// reported a tenth of its work goes by its own speed instead. It is 0 while it cannot be
// known: in the run's first 20 seconds, while no step of the plan runs, and when only a
// step that ran past its expected time is left.
func (p *Plan) leftLocked(now time.Time) time.Duration {
	if !p.running || p.cur < 0 || now.Sub(p.begun) < leftAfter {
		return 0
	}
	cur := p.steps[p.cur]
	elapsed := now.Sub(p.runAt)
	var took, expect time.Duration
	for _, s := range p.steps {
		if s.status == StatusDone {
			took, expect = took+s.took, expect+s.expect
		}
	}
	if elapsed > cur.expect {
		took, expect = took+elapsed, expect+cur.expect
	}
	speed := 1.0
	if expect >= speedAfter {
		speed = min(max(float64(took)/float64(expect), speedMin), speedMax)
	}
	var rest float64
	for i, s := range p.steps {
		if !s.done && i != p.cur {
			rest += s.share
		}
	}
	left := time.Duration(rest * speed * float64(time.Second))
	if p.frac >= ownSpeedAfter {
		left += time.Duration(float64(elapsed) * (1 - p.frac) / p.frac)
	} else if own := time.Duration(cur.share*speed*float64(time.Second)) - elapsed; own > 0 {
		left += own
	}
	return max(left, 0)
}

// leftText is the time a run has left as its line says it: "about 4 minutes left" in whole
// minutes, "about 40 seconds left" by fives under a minute.
func leftText(d time.Duration) string {
	if s := int((d + 2500*time.Millisecond) / (5 * time.Second) * 5); s < 60 {
		return fmt.Sprintf("about %d seconds left", max(s, 5))
	}
	if m := int((d + 30*time.Second) / time.Minute); m > 1 {
		return fmt.Sprintf("about %d minutes left", m)
	}
	return "about 1 minute left"
}

// redrawTick is how often a reporter with a plan redraws the running step's line by itself.
const redrawTick = time.Second

// redrawer calls the redraw of a reporter with a plan every redrawTick while a step runs,
// so the bar creeps and the time left moves while the step says nothing.
// The redraw takes the reporter's lock, so stop must be called without it.
type redrawer struct {
	mu         sync.Mutex
	quit, done chan struct{}
}

// start begins the redraws of the running step, after it has ended those of the step
// before.
func (d *redrawer) start(redraw func()) {
	d.stop()
	tick := time.NewTicker(redrawTick)
	quit, done := make(chan struct{}), make(chan struct{})
	go func() {
		defer close(done)
		defer tick.Stop()
		for {
			select {
			case <-quit:
				return
			case <-tick.C:
				redraw()
			}
		}
	}()
	d.mu.Lock()
	d.quit, d.done = quit, done
	d.mu.Unlock()
}

// stop ends the redraws and returns once the last one has returned; without redraws it
// does nothing.
func (d *redrawer) stop() {
	d.mu.Lock()
	quit, done := d.quit, d.done
	d.quit, d.done = nil, nil
	d.mu.Unlock()
	if quit != nil {
		close(quit)
		<-done
	}
}

// The look of the live lines: they keep to 79 columns so a redrawn line never wraps.
const (
	// lineWidth is the width of a live line, the time left of the bar included.
	lineWidth = 79
	// showElapsedAfter is how long a step runs before its line shows the time.
	showElapsedAfter = 5 * time.Second
	// minTextWidth is the narrowest the text of a live line gets.
	minTextWidth = 10
	// tailTextWidth is the room a live line with a tail keeps for its text: the bar gets
	// narrower for it, down to minBarWidth, so the line still says what the step does
	// next to the time the run has left. leftTextWidth is the width of
	// that time ("about 55 minutes left").
	tailTextWidth = 34
	minBarWidth   = 10
	leftTextWidth = 21
)

// formatElapsed formats the time a step has run: "7 s", "2 min 10 s", "1 h 5 min".
func formatElapsed(d time.Duration) string {
	s := int64(d / time.Second)
	switch {
	case s < 60:
		return strconv.FormatInt(s, 10) + " s"
	case s < 3600:
		return fmt.Sprintf("%d min %d s", s/60, s%60)
	}
	return fmt.Sprintf("%d h %d min", s/3600, s%3600/60)
}

// progressBar draws the bar of a live line: "[#########-------------]".
func progressBar(width, percent int) string {
	filled := min(max(percent, 0), 100) * width / 100
	return "[" + strings.Repeat("#", filled) + strings.Repeat("-", width-filled) + "]"
}

// fitText cuts text to fit width columns with a space to spare, ending in "..." when
// it is cut.
func fitText(text string, width int) string {
	runes := []rune(text)
	if len(runes) <= width-1 {
		return text
	}
	return string(runes[:max(width-4, 0)]) + "..."
}

// liveLine draws the line of a running step: prefix, the text (at most textMax columns,
// cut to fit), a bar of barWidth characters (narrower when the tail needs the room,
// tailTextWidth), the percent of the whole run and tail, the time the run has left or the
// time the step has run (Reading.tail):
//
//	Program files: 83 MB of 152 MB    [###------------]  23%  about 4 minutes left
func liveLine(prefix, text string, textMax, barWidth, percent int, tail string) string {
	suffix := ""
	if tail != "" {
		suffix = "  " + tail
		barWidth = min(barWidth, max(lineWidth-len(prefix)-2-5-len(suffix)-tailTextWidth, minBarWidth))
	}
	// The bar, the space and the percent take barWidth+2 and 5 columns.
	width := min(textMax, lineWidth-len(prefix)-(barWidth+2)-5-len(suffix))
	width = max(width, minTextWidth)
	return fmt.Sprintf("%s%-*s%s %3d%%%s", prefix, width, fitText(text, width), progressBar(barWidth, percent), percent, suffix)
}

// Watching a running step (xWriter's watch.go). A step that waits, or that runs a command it
// cannot see into, has a helper that reports for it while it runs: what it waits for and
// for how long. The helpers report through [Env.Report] from a goroutine of their own. The
// function they return ends the goroutine and does not return before it has stopped, so no
// reading comes after the step.

// waitTick is how often a waiting step reports: once a second, so the time it has run
// moves.
const waitTick = time.Second

// reporting reports whether the readings of [Env.Report] reach a reporter that shows
// them: a dry run reports nothing, and neither does a run whose reporter shows no
// progress.
func (e *Env) reporting() bool {
	if e.DryRun {
		return false
	}
	e.report.mu.Lock()
	defer e.report.mu.Unlock()
	return e.report.sink != nil
}

// watch calls read every interval until the returned stop function is called, and
// reports what it returns when its second result is true. The first call comes after one
// interval. read gets a context
// that stop ends, so a command it waits for is killed. stop may be called more than once;
// it returns when the last call of read has returned. Nothing runs when no reporter would
// show the readings.
func (e *Env) watch(ctx context.Context, interval time.Duration, read func(ctx context.Context) (ProgressEvent, bool)) (stop func()) {
	if !e.reporting() {
		return func() {}
	}
	ctx, cancel := context.WithCancel(ctx)
	done := make(chan struct{})
	tick := time.NewTicker(interval)
	go func() {
		defer close(done)
		defer tick.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-tick.C:
			}
			if ev, ok := read(ctx); ok && ctx.Err() == nil {
				e.Report(ev)
			}
		}
	}()
	var once sync.Once
	return func() {
		once.Do(func() {
			cancel()
			<-done
		})
	}
}

// waiter reports a step that waits: what it waits for, with the seconds it has waited in
// its words, "waiting for the website to answer (12 s)", so the line says how long even
// when its end shows the time the run has left. The reading has no total, so the step's
// part of the bar creeps.
type waiter struct {
	env    *Env
	mu     sync.Mutex
	detail string
	since  time.Time
	stopFn func()
}

// waiting reports that the running step waits for something (detail, for example
// "waiting for the website to answer"), now and every second until stop is called.
func (e *Env) waiting(ctx context.Context, detail string) *waiter {
	w := &waiter{env: e, detail: detail, since: time.Now()}
	e.Report(w.event())
	w.stopFn = e.watch(ctx, waitTick, func(context.Context) (ProgressEvent, bool) { return w.event(), true })
	return w
}

func (w *waiter) event() ProgressEvent {
	w.mu.Lock()
	defer w.mu.Unlock()
	return ProgressEvent{Fraction: -1, Detail: waitText(w.detail, time.Since(w.since)), Timed: true}
}

// say changes what the step waits for; the seconds of new words count from now.
func (w *waiter) say(detail string) {
	w.mu.Lock()
	if detail != w.detail {
		w.detail, w.since = detail, time.Now()
	}
	w.mu.Unlock()
	w.env.Report(w.event())
}

// waitText is the words of a waiting step: what it waits for, with the time it has waited
// once that is a second, "waiting for the website to answer (12 s)".
func waitText(detail string, waited time.Duration) string {
	if waited < time.Second {
		return detail
	}
	return detail + " (" + formatElapsed(waited) + ")"
}

// runWaiting runs cmd, which prints nothing to follow, while the step's line says what it
// does with the seconds it takes.
func (e *Env) runWaiting(ctx context.Context, detail string, cmd host.Cmd) (host.Result, error) {
	defer e.waiting(ctx, detail).stop()
	return e.Run(ctx, cmd)
}

// stop ends the reports; it may be called more than once.
func (w *waiter) stop() {
	w.stopFn()
}

// ---- The backup ----
