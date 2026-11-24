package install

import (
	"slices"
	"time"
)

// The steps of every command that shows a bar, each with its weight and its expected time,
// as xWriter's weights.go declares them. A command's list is the only place where a step
// gets its numbers: [step] takes both, so a step added later cannot be left without them.
//
// The weight is the step's share of the bar, in seconds of a typical run of the command on
// a typical small server: for a step that such a run makes do its work it is the step's
// expected time, so a step's share of the bar is its share of the run's time; a step that
// such a run finds done weighs the second or two of its check, and when its check does find
// work its share grows to its expected time without moving the bar (Plan.Working). The
// expected time is how long the step takes when it does its work, with apt (the Debian
// family) and with dnf (Fedora). Each run records its steps' real times in install.json,
// to tune them by, and the steps that typical runs make do their work take the times an
// earlier run of this server recorded (Plan.LearnTimes). Every list holds the whole run in
// the order it runs; a step the plan does not list has no share, and its line shows no
// bar.

// stepSpec is a step of a command's list: its ID, its weight and its expected time.
type stepSpec struct {
	id     string
	weight int
	expect expectTime
}

// expectTime is how long a step takes when it does its work: on the Debian family (apt),
// and on Fedora (dnf).
type expectTime struct{ apt, dnf time.Duration }

// secs is an expected time of n seconds on every system.
func secs(n int) expectTime { return secsBy(n, n) }

// secsBy is an expected time of apt seconds on the Debian family, and of dnf seconds on
// Fedora.
func secsBy(apt, dnf int) expectTime {
	return expectTime{apt: time.Duration(apt) * time.Second, dnf: time.Duration(dnf) * time.Second}
}

// on returns the expected time on the family (distro.go): dnf's on the RHEL family, apt's
// on the others and while the family is not known.
func (e expectTime) on(family string) time.Duration {
	if family == familyRHEL {
		return e.dnf
	}
	return e.apt
}

// step declares a step of a list with its weight and its expected time, both required: a
// weight below 1 counts as 1.
func step(id string, weight int, expect expectTime) stepSpec {
	return stepSpec{id: id, weight: max(weight, 1), expect: expect}
}

// share is the step's weight on the family: it follows the step's expected time there, so a
// step that takes longer with dnf has the bigger share of the bar there too.
func (s stepSpec) share(family string) float64 {
	w := float64(s.weight)
	if on := s.expect.on(family); s.expect.apt > 0 && on != s.expect.apt {
		w *= float64(on) / float64(s.expect.apt)
	}
	return w
}

// stepList is the steps of a run in the order they run.
type stepList []stepSpec

// pick returns the steps ids in their order, each with its numbers from l: the installer
// makes its plan from the steps a run takes (steps.go). A step l lacks weighs 1 and is
// expected to take a second.
func (l stepList) pick(ids []string) stepList {
	out := make(stepList, 0, len(ids))
	for _, id := range ids {
		i := slices.IndexFunc(l, func(s stepSpec) bool { return s.id == id })
		if i < 0 {
			out = append(out, step(id, 1, secs(1)))
			continue
		}
		out = append(out, l[i])
	}
	return out
}

// installSteps are the installer's steps in the order of steps.go (docs/plan/07-server-
// install-update.md section 3). The times are those of a fresh server: a repair finds most
// of the work done and skips those steps, which then keep only the part of the bar their
// checks took (Plan.Finish).
func installSteps() stepList {
	return stepList{
		step("preflight", 2, secs(2)),             // the system, the ports, what is installed
		step("system-user", 1, secs(1)),           // the sysusers file
		step("directories", 1, secs(1)),           // a few folders
		step("program-files", 8, secs(8)),         // the payload unpacked: Node.js and the app, about 150 MB
		step("selinux", 1, secsBy(1, 6)),          // labels on Fedora; Debian and Ubuntu have no SELinux
		step("config", 1, secs(1)),                // one file
		step("units", 2, secs(2)),                 // the unit and a daemon-reload
		step("enable", 1, secs(1)),                // systemctl enable
		step("services", 1, secs(1)),              // the two Windows services
		step("restore", 4, secs(4)),               // a backup unpacked, when the owner gave one
		step("migrations", 3, secs(3)),            // the database's migrations, Node.js's start included
		step("owner", 3, secs(3)),                 // the owner account and its password's hash
		step("selinux-network", 1, secsBy(1, 20)), // semanage port on Fedora, slow
		step("https-method", 1, secs(1)),          // the HTTPS manager's state file
		step("start", 8, secs(8)),                 // the start and the health check
		step("apps", 1, secs(1)),                  // Windows' list of installed apps
		step("firewall", 1, secs(2)),              // a rule or two in ufw or firewalld
		step("certificate", 20, secs(20)),         // Let's Encrypt's checks, when the owner chose it
		step("finish", 1, secs(1)),                // install.json and the summary
	}
}
