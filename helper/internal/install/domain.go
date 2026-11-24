package install

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/config"
)

// The domain change of Settings > HTTPS (docs/plan/07-server-install-update.md section 4:
// "a domain can be added later in Settings > HTTPS"), which the root helper runs for the
// website: config.toml's domain, which is the app's XD_PUBLIC_URL (the port stays); then
// xDesign restarts, so the front, the HTTPS manager and the app start with the new
// domain, and must answer its health check. When a step fails, the settings from before
// are put back and xDesign starts again with them.

// DomainOptions are what the domain change works with.
type DomainOptions struct {
	// Domain is the new domain: a domain name, or the server's IP address.
	Domain  string
	JSON    bool
	LogPath string
}

func (o DomainOptions) logPath() string {
	if o.LogPath == "" {
		return DefaultLogPath
	}
	return o.LogPath
}

// DomainResult is the final object of --json.
type DomainResult struct {
	// Status is "changed", "went_back" (a step failed and the domain from before is in use
	// again) or "failed" (nothing was changed, or going back failed too).
	Status string `json:"status"`
	From   string `json:"from"`
	To     string `json:"to"`
	// Address is the site's address once the run ended.
	Address    string `json:"address"`
	FailedStep string `json:"failed_step"`
	Log        string `json:"log"`
	Error      string `json:"error,omitempty"`
}

// domainSteps are the domain change's steps in the order they run.
func domainSteps() stepList {
	return stepList{
		step("domain", 1, secs(1)),        // config.toml and install.json
		step("settings", 1, secs(1)),      // config.toml
		step("stop", 3, secs(3)),          // the service stops within 30 seconds
		step("start", 10, secs(10)),       // the start and the health check
		step("back-settings", 1, secs(1)), // only when a step failed
		step("back-start", 10, secs(10)),  // the start with the domain from before
	}
}

// domainRun is one run of the domain change.
type domainRun struct {
	u        *Updater
	o        DomainOptions
	env      *Env
	engine   *Engine
	progress *Plan

	state   State
	version string
	// old and cfg are the settings from before and with the new domain; oldConfig the
	// file from before.
	old, cfg  *config.Config
	oldConfig []byte
	// wroteConfig reports that config.toml has the new domain; stopped that xDesign was
	// stopped.
	wroteConfig, stopped bool
}

// ChangeDomain is the domain change, with the Updater's system, streams and health check.
// It returns the exit status: 0 when xDesign runs with the new domain, 1 otherwise.
func (u *Updater) ChangeDomain(ctx context.Context, o DomainOptions) int {
	r := &domainRun{u: u, o: o}
	masker := &Masker{}
	log, closer, err := OpenLog(u.Sys.FS, o.logPath(), masker)
	if err != nil {
		fmt.Fprintf(u.Stderr, "xdesign domain change: %v\n", err)
		return exitFailed
	}
	defer func() { _ = closer.Close() }() // the log; a failed close cannot be reported anywhere useful
	r.env = NewEnv(u.Sys, log, masker, false)
	var out *printer
	if !o.JSON {
		out = newPrinter(u.Stdout, u.Color, u.Terminal)
	}
	var reporter Reporter
	reporter, r.progress = newReporter(reporterSpec{
		Stdout: u.Stdout, Stderr: u.Stderr, Terminal: u.Terminal, JSON: o.JSON,
		Steps: domainSteps(), Family: systemFamily(u.Sys.FS), Out: out, Sections: map[string]string{
			"domain": "Changing the domain...", "settings": "Changing the domain...", "stop": "Restarting xDesign...",
			"start": "Restarting xDesign...", "back-settings": "Going back to the domain from before...",
			"back-start": "Going back to the domain from before...",
		},
	})
	r.engine = &Engine{Env: r.env, Reporter: reporter}
	ctx = context.WithoutCancel(ctx) // a domain change must not stop halfway
	r.env.Log().Printf("==== xdesign domain change (to %q) ====", o.Domain)
	if _, err := r.engine.Run(ctx, []Step{r.stepDomain()}); err != nil {
		return r.result(DomainResult{Status: "failed", FailedStep: failedStep(err).ID, Error: stepErrText(err)})
	}
	if _, err := r.engine.Run(ctx, []Step{r.stepSettings(), r.stepStop(), r.stepStart()}); err != nil {
		res := DomainResult{Status: "failed", FailedStep: failedStep(err).ID, Error: stepErrText(err)}
		if !r.wroteConfig && !r.stopped {
			return r.result(res)
		}
		if _, berr := r.engine.Run(ctx, r.backSteps()); berr != nil {
			res.Error = fmt.Sprintf("%s; going back to %s failed too: %s", res.Error, r.old.Domain, stepErrText(berr))
			return r.result(res)
		}
		res.Status = "went_back"
		return r.result(res)
	}
	return r.result(DomainResult{Status: "changed"})
}

// result prints the result: the --json object, or a line in pacman's style.
func (r *domainRun) result(res DomainResult) int {
	res.Log = r.o.logPath()
	res.To = r.o.Domain
	if r.old != nil {
		res.From, res.Address = r.old.Domain, r.old.PublicURL()
	}
	if res.Status == "changed" {
		res.Address = r.cfg.PublicURL()
	}
	if r.o.JSON {
		b, err := json.MarshalIndent(res, "", "  ")
		if err == nil {
			fmt.Fprintf(r.u.Stdout, "%s\n", b)
		}
	} else if res.Status == "changed" {
		fmt.Fprintf(r.u.Stdout, ":: The domain is %s now: xDesign opens at %s.\n", res.To, res.Address)
	} else {
		fmt.Fprintf(r.u.Stderr, "error: the domain change failed: %s\n", res.Error)
	}
	if res.Status == "changed" {
		return exitOK
	}
	return exitFailed
}

// stepDomain checks the new domain against the site's settings and finds what it changes.
func (r *domainRun) stepDomain() Step {
	return Step{Num: "1", ID: "domain", Title: "New domain", ReadOnly: true, Act: func(_ context.Context, env *Env) error {
		s, err := readSite(r.u, "the domain change")
		if err != nil {
			return err
		}
		r.oldConfig, r.old = s.data, s.cfg
		d, err := config.CheckDomain(r.o.Domain)
		switch {
		case err != nil:
			return err
		case d == r.old.Domain:
			return fmt.Errorf("xDesign already uses %s", d)
		}
		next := *r.old
		next.Domain = d
		r.o.Domain, r.cfg, r.state, r.version = d, &next, s.state, s.version
		env.Factf("domain", "%s to %s (%s)", r.old.Domain, d, r.cfg.PublicURL())
		return nil
	}}
}

// site is what a change of the site's settings starts from (the domain change, set-port
// and set-path): install.json, the running version, and config.toml as it is and as it
// reads.
type site struct {
	state   State
	version string
	data    []byte
	cfg     *config.Config
}

// readSite reads the installed site for a change of its settings, which runs as root or
// Administrator (notAdmin says so otherwise, with what).
func readSite(u *Updater, what string) (site, error) {
	fsys := u.Sys.FS
	if !elevated(u.Sys.Machine) {
		return site{}, notAdmin(what, "")
	}
	st, found, err := ReadState(fsys)
	if err != nil {
		return site{}, err
	}
	if !found || st.Status != StateInstalled {
		return site{}, fmt.Errorf("xDesign is not installed on this server, or its installation did not finish (%s)", StatePath)
	}
	cur, err := currentRelease(fsys)
	if err != nil {
		return site{}, err
	}
	s := site{state: st, version: cur.Version}
	if s.data, err = fsys.ReadFile(configPath); err != nil {
		return site{}, fmt.Errorf("read %s: %w", configPath, err)
	}
	if s.cfg, err = config.Parse(s.data, configPath); err != nil {
		return site{}, err
	}
	return s, nil
}

// stepSettings writes config.toml with the new domain (writeConfig, as the installer
// writes it) and install.json.
func (r *domainRun) stepSettings() Step {
	return Step{Num: "2", ID: "settings", Title: "Settings", Act: func(_ context.Context, env *Env) error {
		data, err := config.Render(*r.cfg)
		if err != nil {
			return err
		}
		if _, err := config.Parse(data, configPath); err != nil {
			return fmt.Errorf("the settings with the new domain are not valid: %w", err)
		}
		if err := writeConfig(env, r.u.Sys, data, "domain "+r.cfg.Domain); err != nil {
			return err
		}
		r.wroteConfig = true
		return env.Do("write "+StatePath, func() error { return WriteState(r.u.Sys.FS, r.state) })
	}}
}

func (r *domainRun) stepStop() Step {
	return stopStep("3", &r.stopped)
}

func (r *domainRun) stepStart() Step {
	return startStep("4", r.u, r.cfg, r.version)
}

// stopStep stops xDesign for a change of its settings; stopped records that it began.
func stopStep(num string, stopped *bool) Step {
	return Step{Num: num, ID: "stop", Title: "Stop xDesign", Act: func(ctx context.Context, env *Env) error {
		*stopped = true
		return stopService(ctx, env)
	}}
}

// startStep starts xDesign with the settings cfg and waits for its health check.
func startStep(num string, u *Updater, cfg *config.Config, version string) Step {
	return Step{Num: num, ID: "start", Title: "Start and health check", Act: func(ctx context.Context, env *Env) error {
		return startAndCheck(ctx, env, u, cfg, version)
	}}
}

// backSteps put the settings from before back and start xDesign with them, after a step
// of the change failed.
func (r *domainRun) backSteps() []Step {
	return []Step{
		{Num: "B1", ID: "back-settings", Title: "Settings from before",
			Check: func(context.Context, *Env) (string, error) {
				if !r.wroteConfig {
					return "config.toml was not changed", nil
				}
				return "", nil
			},
			Act: func(_ context.Context, env *Env) error {
				return writeConfig(env, r.u.Sys, r.oldConfig, "the settings from before, domain "+r.old.Domain)
			},
			Verify: func(context.Context, *Env) error { return nil },
		},
		{Num: "B2", ID: "back-start", Title: "Start xDesign with " + r.old.Domain, Act: func(ctx context.Context, env *Env) error {
			if err := stopService(ctx, env); err != nil {
				return err
			}
			return startAndCheck(ctx, env, r.u, r.old, r.version)
		}},
	}
}

// DomainArgs parses the arguments of the root helper's domain change: [--json] DOMAIN.
func DomainArgs(args []string) (DomainOptions, error) {
	var o DomainOptions
	for _, a := range args {
		switch {
		case a == "--json":
			o.JSON = true
		case strings.HasPrefix(a, "-"):
			return o, fmt.Errorf("%w: unknown flag %s", ErrUsage, a)
		case o.Domain != "":
			return o, fmt.Errorf("%w: unexpected argument %q", ErrUsage, a)
		default:
			o.Domain = a
		}
	}
	if o.Domain == "" {
		return o, fmt.Errorf("%w: give the new domain", ErrUsage)
	}
	return o, nil
}
