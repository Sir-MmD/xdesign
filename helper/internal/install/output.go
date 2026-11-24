package install

import (
	"errors"
	"fmt"
	"strings"
)

// sections maps the installer's steps to the sections of their output. The sections
// follow the order of the steps. A step that is not listed (a later task's) shows under
// the section before it.
func (r *run) sections() map[string]string {
	m := map[string]string{}
	add := func(title string, ids ...string) {
		for _, id := range ids {
			m[id] = title
		}
	}
	add("Checking this server...", "preflight")
	add(fmt.Sprintf("Installing xDesign %s...", r.version), "system-user", "directories", "program-files", "selinux", "config",
		"units", "enable")
	add("Setting up the website...", "restore", "migrations", "owner")
	add("Starting xDesign...", "selinux-network", "https-method", "services", "start")
	add("Finishing...", "apps", "firewall", "certificate", "finish")
	return m
}

// rerun is the command that runs the installer again, for the messages.
func (r *run) rerun() string {
	if r.in.Rerun != "" {
		return "run " + r.in.Rerun + " again"
	}
	return "run the installer again"
}

// rerunWithout says how to run the installer again without flag.
func (r *run) rerunWithout(flag string) string {
	if r.in.Rerun != "" {
		return "run " + r.in.Rerun + " again without " + flag
	}
	return "run the installer again without " + flag
}

// ownerShown is the owner's username for the end: the one this run made, or the one the
// site had.
func (r *run) ownerShown() string {
	if r.ownerUsername != "" {
		return r.ownerUsername
	}
	return r.owner.Username
}

// succeed prints the end of section 3 step 8 (or the --json result) and returns the exit
// status.
func (r *run) succeed() int {
	if r.opts.DryRun {
		if r.opts.JSON {
			r.writeResult(Result{
				Status: "planned", Version: r.version, URL: r.cfg.PublicURL(), Certificate: r.certificateResult(), Log: r.opts.logPath(),
			})
			return exitOK
		}
		r.out.line("")
		r.out.section("Dry run finished: nothing was changed")
		r.out.fact("install", r.rerunWithout("--dry-run"))
		return exitOK
	}
	status := "installed"
	if r.mode == ModeRepair {
		status = "repaired"
	}
	username := r.ownerShown()
	if r.opts.JSON {
		r.writeResult(Result{
			Status: status, Version: r.version, URL: r.cfg.PublicURL(), Username: username, Password: r.password,
			Certificate: r.certificateResult(), Log: r.opts.logPath(),
		})
		return exitOK
	}
	o := r.out
	o.line("")
	if r.mode == ModeRepair {
		o.section(fmt.Sprintf("xDesign %s was repaired and is running.", r.version))
	} else {
		o.section(fmt.Sprintf("xDesign %s is running.", r.version))
	}
	o.line("   Open:     " + r.cfg.PublicURL())
	if r.https.method != "" {
		o.line("   HTTPS:    " + r.certificateText())
	}
	o.line("   Username: " + username)
	if r.password != "" {
		o.line("   Password: " + r.password + "   (shown only now; change it under Account)")
	} else {
		o.line("   Password: unchanged (" + adminPrefix + "xdesign admin reset-password " + username + " makes a new one)")
	}
	o.line("   Keep this address: the site answers only there. " + adminPrefix + "xdesign status shows it again.")
	o.line(endServiceLine)
	what := portsText(r.sitePorts())
	if r.firewall.Tool != "" {
		o.warn(fmt.Sprintf("if your hosting provider has a firewall, allow %s there too", what))
	} else {
		o.warn(fmt.Sprintf("if this server or your hosting provider has a firewall, allow %s there", what))
	}
	return exitOK
}

// fail prints the failure block (or the --json result) and returns the exit status.
func (r *run) fail(err error) int {
	var stepErr *StepError
	step, command := "", ""
	if errors.As(err, &stepErr) {
		step, command = stepErr.Step.ID, stepErr.Command
		err = stepErr.Err
	}
	if errors.Is(err, errAborted) {
		if r.opts.JSON {
			r.writeResult(Result{Status: "failed", Version: r.version, FailedStep: step, Log: r.opts.logPath(), Error: err.Error()})
		} else {
			r.out.line("")
			r.out.section(upperFirst(err.Error()))
		}
		return exitFailed
	}
	r.log.Printf("installation failed: %v", err)
	if r.opts.JSON {
		res := Result{Status: "failed", Version: r.version, FailedStep: step, Log: r.opts.logPath(), Error: err.Error()}
		if r.password != "" {
			res.Username, res.Password = r.owner.Username, r.password
		}
		r.writeResult(res)
		return exitFailed
	}
	r.out.write("") // ends a line the next output would replace
	o := r.errOut
	what := "the installation"
	if stepErr != nil {
		if title := r.sections()[stepErr.Step.ID]; title != "" {
			what = lowerFirst(strings.TrimSuffix(title, "..."))
		}
	}
	o.line("")
	o.errorf("%s failed: %v", what, err)
	if stepErr != nil {
		o.fact("step", fmt.Sprintf("%s %s", stepErr.Step.Num, stepErr.Step.Title))
	}
	if command != "" {
		o.fact("command", command)
	}
	if !r.opts.DryRun {
		o.fact("log", r.opts.logPath())
	}
	if r.enabledAtBoot {
		o.fact("state", serviceWords+" starts at boot; the failed step and the ones after it are missing")
	} else {
		o.fact("state", "the website is not started and does not start at boot")
	}
	if r.password != "" {
		o.warn("the owner account was made before the failure: save its sign-in now, it is not shown again")
		o.fact("username", r.owner.Username)
		o.fact("password", r.password)
	}
	o.section("Fix the problem and " + r.rerun() + ": finished steps are skipped.")
	return exitFailed
}

// lowerFirst returns s with its first letter in lower case.
func lowerFirst(s string) string {
	if s == "" {
		return s
	}
	return strings.ToLower(s[:1]) + s[1:]
}

// refusal is why this release is not installed over what preflight found: the text
// after "error:" and the facts that say what to do instead.
type refusal struct {
	text  string
	facts []Fact
}

// refuseNewer refuses this release where an unfinished installation of a newer xDesign,
// or its data, is: the installer never goes back to an older release. use says how to
// go on with it; removing it is the other way.
func (r *run) refuseNewer(fail func(string, ...any), text string, use Fact) {
	r.refusal = &refusal{text: text, facts: []Fact{use,
		{Label: "start over", Value: "remove it first (a final backup is offered), then install: " + purgeCommand}}}
	fail("%s", text)
}

// refuse prints the refusal in place of the failure block, or the --json result, and
// returns the exit status. Nothing was changed.
func (r *run) refuse() int {
	ref := r.refusal
	r.log.Printf("refused: %s", ref.text)
	if r.opts.JSON {
		msg := ref.text
		for _, f := range ref.facts {
			msg += "; " + f.Label + ": " + f.Value
		}
		r.writeResult(Result{Status: "failed", Version: r.version, FailedStep: "preflight", Log: r.opts.logPath(), Error: msg})
		return exitFailed
	}
	r.out.write("") // ends a line the next output would replace
	r.errOut.line("")
	r.errOut.errorf("%s", ref.text)
	for _, f := range ref.facts {
		r.errOut.fact(f.Label, f.Value)
	}
	r.errOut.section("Nothing was changed.")
	return exitFailed
}

// purgeCommand is the command that removes an earlier installation with its data.
const purgeCommand = adminPrefix + "xdesign --uninstall (Remove everything)"

// stoppedAt names the section an unfinished installation stopped in ("Setting up the
// website"), from the step install.json recorded; "" when it is not known.
func (r *run) stoppedAt() string {
	if r.mode != ModeResume || r.prev.LastStep == "" {
		return ""
	}
	return strings.TrimSuffix(r.sections()[r.prev.LastStep], "...")
}

// confirmEarlier asks whether to go on with what an earlier installation left: an
// installation that stopped, or the data of an uninstalled or partly removed one. --yes
// answers yes and dry runs do not ask; a no stops with nothing changed. The questions of
// the installation follow, and ":: Proceed with installation?" last.
func (r *run) confirmEarlier() error {
	var question, instead string
	switch r.mode {
	case ModeResume:
		question = "An earlier installation did not finish. Continue it?"
		if section := r.stoppedAt(); section != "" {
			question = `An earlier installation stopped at "` + section + `". Continue it?`
		}
		instead = "To start over instead, remove what it left first: " + purgeCommand
	case ModeExisting:
		question = "xDesign's data from an earlier installation is here. Install with it?"
		instead = "To install without it, remove it first: " + purgeCommand
	case ModeFresh, ModeRepair, ModeUpdate, ModeNewer:
		return nil // a repair asks in questions(); an update and a refusal never get here
	}
	if r.opts.Yes || r.opts.DryRun {
		return nil
	}
	ok, err := r.ask.confirm(question, true)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("%w. %s", errAborted, instead)
	}
	return nil
}
