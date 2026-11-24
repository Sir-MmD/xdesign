package install

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"path"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// Moving the site later (docs/plan/16-owner-list-2026-11-23.md section 7, D-610): `sudo
// xdesign admin set-port PORT` and `sudo xdesign admin set-path PATH | --random`, which
// behave as xWriter's commands of the same names and are written as the domain change
// (domain.go). xDesign restarts instead of moving a live listener: config.toml gets the
// new port or path, xDesign restarts and must answer its health check there, and the
// settings from before are put back when a step fails. set-port opens the new port in the
// firewall first and labels it under SELinux, and once xDesign answers on it closes the
// old port when xDesign had opened it; going back closes the new port and removes its
// label again, so nothing is left half-changed. Both refuse while the maintenance helper
// or a backup runs, and record themselves in install.json's history and the install log.
// The maintenance helper runs them too, for Settings > Site address
// (docs/plan/17-second-owner-list-2026-11-23.md section 6), with InMaintenance. On Windows
// they run in a terminal opened as Administrator or in the maintenance service, and move
// the rule of Windows Firewall (docs/plan/18-third-owner-list-2026-11-23.md section 8.6);
// each system's parts are in address_linux.go and address_windows.go.

// AddressOptions are what set-port and set-path work with.
type AddressOptions struct {
	// Port is set-port's new port; 0 for set-path.
	Port int
	// BasePath is set-path's new web base path; Random makes one instead.
	BasePath string
	Random   bool
	// NoFirewall leaves the firewall alone (set-port): the rule to add is shown.
	NoFirewall bool
	Yes        bool
	JSON       bool
	LogPath    string
	// InMaintenance reports the maintenance helper's run of an address change asked for in
	// the website: xdesign-maintenance.service is that run, so only the backups' lock
	// keeps it away.
	InMaintenance bool
}

func (o AddressOptions) logPath() string {
	if o.LogPath == "" {
		return DefaultLogPath
	}
	return o.LogPath
}

// Validate checks the options alone.
func (o AddressOptions) Validate() error {
	if o.JSON && !o.Yes {
		return fmt.Errorf("%w: --json needs --yes: questions cannot be asked while the output is JSON", ErrUsage)
	}
	return nil
}

// command is the command's name: "set-port" or "set-path".
func (o AddressOptions) command() string {
	if o.Port != 0 {
		return "set-port"
	}
	return "set-path"
}

// argument is the command's argument as the owner gave it: "40000", "/k3v9x2m1/" or
// "--random".
func (o AddressOptions) argument() string {
	switch {
	case o.Port != 0:
		return strconv.Itoa(o.Port)
	case o.Random:
		return "--random"
	}
	return o.BasePath
}

// AddressResult is the final object of --json.
type AddressResult struct {
	// Status is "changed", "went_back" (a step failed and the settings from before are in
	// use again) or "failed" (nothing was changed, or going back failed too).
	Status string `json:"status"`
	// From and To are the ports ("34567") or the web base paths ("/k3v9x2m1q8wz7r4t/").
	From string `json:"from"`
	To   string `json:"to"`
	// Address is the site's address once the run ended.
	Address string `json:"address"`
	// Notes are what is left to do by hand: the firewall rule to add, a rule that could
	// not be closed.
	Notes      []string `json:"notes,omitempty"`
	FailedStep string   `json:"failed_step"`
	Log        string   `json:"log"`
	Error      string   `json:"error,omitempty"`
}

// portSteps are set-port's steps in the order they run.
func portSteps() stepList {
	return stepList{
		step("port", 1, secs(1)),          // config.toml, install.json, the port, the firewall
		step("open-port", 1, secs(2)),     // ufw or firewalld
		step("label-port", 1, secs(8)),    // semanage is slow; only while SELinux is enforcing
		step("settings", 1, secs(1)),      // config.toml, and the unit when its capability changes
		step("stop", 3, secs(3)),          // the service stops within 30 seconds
		step("start", 10, secs(10)),       // the start and the health check
		step("finish", 1, secs(2)),        // the old port closed, install.json
		step("back-settings", 1, secs(1)), // only when a step failed
		step("back-start", 10, secs(10)),  // the start with the settings from before
		step("back-port", 1, secs(8)),     // the new port closed and its label removed
	}
}

// pathSteps are set-path's steps in the order they run.
func pathSteps() stepList {
	return stepList{
		step("path", 1, secs(1)),          // config.toml and install.json
		step("settings", 1, secs(1)),      // config.toml
		step("stop", 3, secs(3)),          // the service stops within 30 seconds
		step("start", 10, secs(10)),       // the start and the health check
		step("finish", 1, secs(1)),        // install.json
		step("back-settings", 1, secs(1)), // only when a step failed
		step("back-start", 10, secs(10)),  // the start with the settings from before
	}
}

// addressRun is one run of set-port or set-path.
type addressRun struct {
	u        *Updater
	o        AddressOptions
	env      *Env
	engine   *Engine
	out      *printer
	errOut   *printer
	progress *Plan

	site site
	// cfg is the settings with the new port or path; from and to name the old and the new
	// one ("34567", "/k3v9x2m1q8wz7r4t/").
	cfg      *config.Config
	from, to string
	// oldPort and port are set-port's ports.
	oldPort, port int
	// firewall is the active firewall; opened reports that this run opened the new port.
	firewall Firewall
	opened   bool
	// labelFrom is the new port's SELinux type before ("" for none); label reports that it
	// gets http_port_t, labeled that this run labeled it.
	labelFrom      string
	label, labeled bool
	// unit and oldUnit are xdesign.service with the change and from before, when the port
	// moves across 1024 and the unit's capability changes with it; nil otherwise.
	unit, oldUnit []byte
	// fwBefore and seBefore are install.json's records from before, put back when going
	// back.
	fwBefore StateFirewall
	seBefore StateSELinux
	// wroteConfig, wroteUnit and stopped report what the change did.
	wroteConfig, wroteUnit, stopped bool
	notes                           []string
}

// ChangeAddress is `sudo xdesign admin set-port` (o.Port) or `sudo xdesign admin set-path`,
// with the Updater's system, streams and health check. It returns the exit status: 0 when
// xDesign answers at the new address, 1 otherwise, 2 for invalid options.
func (u *Updater) ChangeAddress(ctx context.Context, o AddressOptions) int {
	name := "xdesign admin " + o.command()
	if err := o.Validate(); err != nil {
		fmt.Fprintf(u.Stderr, "%s: %v\n", name, strings.TrimPrefix(err.Error(), ErrUsage.Error()+": "))
		return exitUsage
	}
	if !elevated(u.Sys.Machine) {
		fmt.Fprintf(u.Stderr, "%v\n", notAdmin(name, name+" "+o.argument()))
		return exitFailed
	}
	r := &addressRun{u: u, o: o}
	r.out = newPrinter(u.Stdout, u.Color, u.Terminal)
	r.errOut = newPrinter(u.Stderr, u.Color, false)
	masker := &Masker{}
	log, closer, err := OpenLog(u.Sys.FS, o.logPath(), masker)
	if err != nil {
		fmt.Fprintf(u.Stderr, "%s: %v\n", name, err)
		return exitFailed
	}
	defer func() { _ = closer.Close() }() // the log; a failed close cannot be reported anywhere useful
	r.env = NewEnv(u.Sys, log, masker, false)
	var out *printer
	if !o.JSON {
		out = r.out
	}
	steps := pathSteps()
	if o.Port != 0 {
		steps = portSteps()
	}
	var reporter Reporter
	reporter, r.progress = newReporter(reporterSpec{
		Stdout: u.Stdout, Stderr: u.Stderr, Terminal: u.Terminal, JSON: o.JSON,
		Steps: steps, Family: systemFamily(u.Sys.FS), Out: out, Sections: r.sections(),
	})
	r.engine = &Engine{Env: r.env, Reporter: reporter}
	return r.main(ctx)
}

// sections maps the steps to the sections of the output.
func (r *addressRun) sections() map[string]string {
	restart, finish := "Restarting xDesign...", "Finishing..."
	if r.o.Port != 0 {
		moving, back := fmt.Sprintf("Moving xDesign to port %d...", r.o.Port), "Going back to the port from before..."
		return map[string]string{
			"port": "Checking the new port...", "open-port": moving, "label-port": moving, "settings": moving, "stop": restart,
			"start": restart, "finish": finish, "back-settings": back, "back-start": back, "back-port": back,
		}
	}
	changing, back := "Changing the web base path...", "Going back to the web base path from before..."
	return map[string]string{
		"path": "Checking the new web base path...", "settings": changing, "stop": restart, "start": restart, "finish": finish,
		"back-settings": back, "back-start": back,
	}
}

func (r *addressRun) main(ctx context.Context) int {
	ctx = context.WithoutCancel(ctx) // a move must not stop halfway
	r.env.Log().Printf("==== xdesign admin %s %s ====", r.o.command(), r.o.argument())
	first, off := r.stepPath(), 0
	if r.o.Port != 0 {
		first, off = r.stepPort(), len(r.moveSteps())
	}
	if _, err := r.engine.Run(ctx, []Step{first}); err != nil {
		return r.result(AddressResult{Status: "failed", FailedStep: failedStep(err).ID, Error: stepErrText(err)})
	}
	if err := r.confirm(); err != nil {
		if errors.Is(err, errAborted) {
			r.out.line("")
			r.out.section(upperFirst(err.Error()))
			return exitFailed
		}
		return r.result(AddressResult{Status: "failed", Error: err.Error()})
	}
	num := func(n int) string { return strconv.Itoa(n + off) }
	steps := []Step{r.stepSettings(num(2)), stopStep(num(3), &r.stopped), startStep(num(4), r.u, r.cfg, r.site.version)}
	if r.o.Port != 0 {
		steps = append(r.moveSteps(), steps...)
	}
	if _, err := r.engine.Run(ctx, steps); err != nil {
		res := AddressResult{Status: "failed", FailedStep: failedStep(err).ID, Error: stepErrText(err)}
		if !r.changed() {
			r.record(ResultFailed)
			return r.result(res)
		}
		if _, berr := r.engine.Run(ctx, r.backSteps()); berr != nil {
			res.Error = fmt.Sprintf("%s; going back to %s failed too: %s", res.Error, r.from, stepErrText(berr))
			r.record(ResultFailed)
			return r.result(res)
		}
		res.Status = "went_back"
		r.record(ResultRolledBack)
		return r.result(res)
	}
	_, _ = r.engine.Run(ctx, []Step{r.stepFinish(num(5))})
	return r.result(AddressResult{Status: "changed"})
}

// changed reports whether the change touched anything that going back puts back.
func (r *addressRun) changed() bool {
	return r.opened || r.labeled || r.wroteConfig || r.wroteUnit || r.stopped
}

// what names the setting: "port" or "web base path".
func (r *addressRun) what() string {
	if r.o.Port != 0 {
		return "port"
	}
	return "web base path"
}

// change says what the run changes: "port 34567 to 40000".
func (r *addressRun) change() string {
	return fmt.Sprintf("%s %s to %s", r.what(), r.from, r.to)
}

// load reads the installed site and refuses while the maintenance helper or a backup runs.
func (r *addressRun) load(ctx context.Context, env *Env) error {
	s, err := readSite(r.u, "xdesign admin "+r.o.command())
	if err != nil {
		return err
	}
	if err := checkNotBusy(ctx, env, s.cfg, r.o.InMaintenance); err != nil {
		return err
	}
	r.site = s
	fw, se := s.state.Firewall, s.state.SELinux
	r.fwBefore = StateFirewall{Tool: fw.Tool, Ports: slices.Clone(fw.Ports)}
	r.seBefore = StateSELinux{Enabled: se.Enabled, ChconFallback: se.ChconFallback, PortsAdded: slices.Clone(se.PortsAdded),
		PortsModified: slices.Clone(se.PortsModified)}
	r.progress.LearnTimes(s.state.History)
	return nil
}

// checkNotBusy refuses while the maintenance helper carries out a request of the website
// (an update, a rollback, a restore, a domain change or an address change) or a backup is
// made or restored: the maintenance lock of docs/plan/16-owner-list-2026-11-23.md section
// 7. The helper's own run (inMaintenance) checks the backups' lock only.
func checkNotBusy(ctx context.Context, env *Env, cfg *config.Config, inMaintenance bool) error {
	if !inMaintenance {
		busy, err := maintenanceBusy(ctx, env)
		if err != nil {
			return err
		}
		if busy {
			return errors.New("the server is busy with an update, a rollback, a restore, a domain change or an address change " +
				"asked for in the website (" + maintenanceWords + " runs): try again when it is done")
		}
	}
	if backup.Running(backup.Options{DataDir: cfg.DataDir}.Dir()) {
		return backup.ErrBusy
	}
	return nil
}

// stepPort checks the new port as the installer's port question does (1 to 65535, not
// 80, free; 443 allowed) and finds what moves with it: the unit's capability, the
// firewall and the SELinux label (the first and the last on Linux).
func (r *addressRun) stepPort() Step {
	return Step{Num: "1", ID: "port", Title: "New port", ReadOnly: true, Act: func(ctx context.Context, env *Env) error {
		if err := r.load(ctx, env); err != nil {
			return err
		}
		old := r.site.cfg
		listenHost, oldText, err := net.SplitHostPort(old.Listen)
		if err != nil {
			return fmt.Errorf("%s: listen %q has no port", configPath, old.Listen)
		}
		r.oldPort, _ = strconv.Atoi(oldText) // config.Parse checked it
		port := r.o.Port
		switch {
		case port < 1 || port > 65535:
			return errors.New("please give a port number from 1 to 65535")
		case port == httpPort:
			return errors.New("port 80 cannot serve HTTPS; choose another one")
		case port == r.oldPort:
			return fmt.Errorf("xDesign already uses port %d", port)
		case r.u.Sys.Machine.ProbePort(ctx, "", port) != nil:
			return fmt.Errorf("port %d is in use; choose another one", port)
		}
		next := *old
		next.Listen = net.JoinHostPort(listenHost, strconv.Itoa(port))
		r.cfg, r.port, r.from, r.to = &next, port, oldText, strconv.Itoa(port)
		env.Factf("port", "%d to %d", r.oldPort, port)
		env.Factf("address", "%s", next.PublicURL())
		if err := r.planUnit(); err != nil {
			return err
		}
		r.planFirewall(ctx, env)
		r.planSELinux(ctx, env)
		return nil
	}}
}

// stepPath checks the new web base path as the installer's question does, or makes a
// random one, and warns about what stops working.
func (r *addressRun) stepPath() Step {
	return Step{Num: "1", ID: "path", Title: "New web base path", ReadOnly: true, Act: func(ctx context.Context, env *Env) error {
		if err := r.load(ctx, env); err != nil {
			return err
		}
		p := r.o.BasePath
		if r.o.Random {
			var err error
			if p, err = RandomBasePath(r.u.Rand); err != nil {
				return err
			}
		}
		if err := config.CheckBasePath(p); err != nil {
			return err
		}
		if p == r.site.cfg.BasePath {
			return fmt.Errorf("xDesign already uses the web base path %s", p)
		}
		next := *r.site.cfg
		next.BasePath = p
		r.cfg, r.from, r.to = &next, r.site.cfg.BasePath, p
		env.Factf("path", "%s to %s", r.from, p)
		env.Factf("address", "%s", next.PublicURL())
		if p == "/" {
			env.Warnf("with the web base path / anyone who finds the port finds the sign-in page; a random path is recommended")
		}
		env.Warnf("The old address stops working: view-only links and Claude links you already sent, and Claude Code's connection " +
			"to xDesign, need the new address.")
		return nil
	}}
}

// planFirewall finds the active firewall and whether it lets the new port in. With
// --no-firewall, or without a firewall xDesign opens ports in, it notes the rule to add by
// hand.
func (r *addressRun) planFirewall(ctx context.Context, env *Env) {
	fw, err := DetectFirewall(ctx, env)
	if err == nil {
		fw = moveFirewall(fw, r.site.state.Firewall, r.oldPort)
	}
	r.firewall = fw
	switch {
	case r.o.NoFirewall:
		r.notef(env, "the firewall is left alone (--no-firewall): allow TCP port %d in it yourself, for example: %s", r.port,
			firewallRule(fw.Tool, r.port))
	case err != nil:
		r.notef(env, "the firewall cannot be read (%v): allow TCP port %d in it yourself", err, r.port)
	case fw.Tool == "":
		r.notef(env, "%s", noFirewallNote(r.port))
	default:
		if allowed, err := fw.Allowed(ctx, env, r.port); err == nil && allowed {
			env.Factf("firewall", "TCP port %d is allowed in %s", r.port, fw.name())
		} else {
			env.Factf("firewall", "opens TCP port %d in %s", r.port, fw.name())
		}
	}
}

// notef adds a note under the step's line that is also left to do by hand.
func (r *addressRun) notef(env *Env, format string, args ...any) {
	env.Notef(format, args...)
	r.notes = append(r.notes, fmt.Sprintf(format, args...))
}

// warnf adds a warning under the step's line that is also left to do by hand.
func (r *addressRun) warnf(env *Env, format string, args ...any) {
	env.Warnf(format, args...)
	r.notes = append(r.notes, fmt.Sprintf(format, args...))
}

// confirm asks the command's question, unless --yes: set-port asks for the SELinux label
// of the new port first (as the installer does) and then ":: Move xDesign to port 40000?
// [Y/n]"; set-path asks ":: Change the web base path? [y/N]" after its warning.
func (r *addressRun) confirm() error {
	if r.o.Yes {
		return nil
	}
	r.out.line("")
	ask := &prompter{in: bufio.NewReader(r.u.Stdin), out: r.out}
	if r.label {
		question := fmt.Sprintf("Label port %d for HTTPS under SELinux (semanage port %s -t %s -p tcp %d)?", r.port,
			semanageFlag(r.labelFrom), selinuxPortType, r.port)
		ok, err := ask.confirm(question, true)
		if err != nil {
			return r.noAnswer(err)
		}
		r.label = ok
	}
	question, def := fmt.Sprintf("Move xDesign to port %d?", r.port), true
	if r.o.Port == 0 {
		question, def = "Change the web base path?", false
	}
	ok, err := ask.confirm(question, def)
	switch {
	case err != nil:
		return r.noAnswer(err)
	case !ok:
		return errAborted
	}
	return nil
}

// noAnswer says how to run the command without its question when standard input ended.
func (r *addressRun) noAnswer(err error) error {
	if errors.Is(err, errNoAnswer) {
		return fmt.Errorf("no answer: standard input ended. Run %sxdesign admin %s %s --yes to change it without the question",
			adminPrefix, r.o.command(), r.o.argument())
	}
	return err
}

// saveState writes install.json with what the run recorded so far.
func (r *addressRun) saveState(env *Env) error {
	return env.Do("write "+StatePath, func() error { return WriteState(r.u.Sys.FS, r.site.state) })
}

// stepOpenPort opens the new port in ufw, firewalld or Windows Firewall before xDesign
// moves to it, and records it in install.json, so the uninstall closes it.
func (r *addressRun) stepOpenPort() Step {
	return Step{
		Num: "2", ID: "open-port", Title: firewallTitle,
		Check: func(ctx context.Context, env *Env) (string, error) {
			switch {
			case r.o.NoFirewall:
				return "left alone (--no-firewall)", nil
			case r.firewall.Tool == "":
				return "no active firewall", nil
			}
			allowed, err := r.firewall.Allowed(ctx, env, r.port)
			if err != nil || !allowed {
				return "", err
			}
			return "the port is allowed in " + r.firewall.name(), nil
		},
		Act: func(ctx context.Context, env *Env) error {
			r.opened = true
			if err := r.firewall.Open(ctx, env, r.port); err != nil {
				return err
			}
			env.Factf("firewall", "TCP port %d opened in %s", r.port, r.firewall.name())
			r.site.state.recordPort(r.firewall.Tool, r.port)
			return r.saveState(env)
		},
	}
}

// stepSettings writes config.toml with the new port or path (writeConfig, as the
// installer writes it), and xdesign.service with a daemon-reload when its capability
// changes (planUnit, on Linux).
func (r *addressRun) stepSettings(num string) Step {
	return Step{Num: num, ID: "settings", Title: "Settings", Act: func(ctx context.Context, env *Env) error {
		data, err := config.Render(*r.cfg)
		if err != nil {
			return err
		}
		if _, err := config.Parse(data, configPath); err != nil {
			return fmt.Errorf("the settings with the new %s are not valid: %w", r.what(), err)
		}
		r.wroteConfig = true
		if err := writeConfig(env, r.u.Sys, data, r.what()+" "+r.to); err != nil {
			return err
		}
		if r.unit == nil {
			return nil
		}
		r.wroteUnit = true
		return writeUnit(ctx, env, r.unit)
	}}
}

// writeUnit installs xdesign.service with data and reloads systemd.
func writeUnit(ctx context.Context, env *Env, data []byte) error {
	if err := installFile(env, "systemd/"+serviceUnit, path.Join(unitDir, serviceUnit), data); err != nil {
		return err
	}
	_, err := env.Run(ctx, host.Command("systemctl", "daemon-reload"))
	return err
}

// stepFinish closes the old port when xDesign opened it (set-port), and records the change
// in install.json's history.
func (r *addressRun) stepFinish(num string) Step {
	return Step{Num: num, ID: "finish", Title: "Finish", Act: func(ctx context.Context, env *Env) error {
		if r.o.Port != 0 {
			r.closeOld(ctx, env)
		}
		r.site.state.History = append(r.site.state.History, r.entry(""))
		if err := r.saveState(env); err != nil {
			env.Warnf("%s could not be written: %v", StatePath, err)
		}
		return nil
	}}
}

// closeOld closes the old port once xDesign answers on the new one, when install.json says
// xDesign opened it, as xWriter's set-port does; a rule someone else added is left alone.
func (r *addressRun) closeOld(ctx context.Context, env *Env) {
	fw, old := &r.site.state.Firewall, r.oldPort
	if !slices.Contains(fw.Ports, old) {
		return
	}
	made := Firewall{Tool: fw.Tool}.name()
	switch {
	case r.o.NoFirewall:
		r.notef(env, "TCP port %d stays open in %s (--no-firewall)", old, made)
		return
	case r.firewall.Tool == "":
		env.Notef("TCP port %d: no firewall is active any more, so there is no rule to remove", old)
	case r.firewall.Tool != fw.Tool:
		r.warnf(env, "xDesign opened TCP port %d in %s, but the active firewall is %s: remove that rule by hand if it is still there",
			old, made, r.firewall.name())
	default:
		allowed, err := r.firewall.Allowed(ctx, env, old)
		if err == nil && allowed {
			err = r.firewall.Close(ctx, env, old)
		}
		if err != nil {
			r.warnf(env, "the old TCP port %d could not be closed in %s (%v): close it by hand", old, made, err)
			return
		}
		env.Factf("firewall", "TCP port %d closed in %s", old, made)
	}
	fw.Ports = slices.DeleteFunc(fw.Ports, func(p int) bool { return p == old })
	if len(fw.Ports) == 0 {
		fw.Tool = ""
	}
}

// backSteps put the settings from before back and start xDesign with them, then close the
// new port and remove its label (set-port), after a step of the change failed.
func (r *addressRun) backSteps() []Step {
	title := "Start xDesign under " + r.from
	if r.o.Port != 0 {
		title = "Start xDesign on port " + r.from
	}
	steps := []Step{
		{Num: "B1", ID: "back-settings", Title: "Settings from before",
			Check: func(context.Context, *Env) (string, error) {
				if !r.wroteConfig && !r.wroteUnit {
					return "config.toml was not changed", nil
				}
				return "", nil
			},
			Act: func(ctx context.Context, env *Env) error {
				if r.wroteConfig {
					if err := writeConfig(env, r.u.Sys, r.site.data, "the settings from before, "+r.what()+" "+r.from); err != nil {
						return err
					}
				}
				if r.wroteUnit {
					return writeUnit(ctx, env, r.oldUnit)
				}
				return nil
			},
			Verify: func(context.Context, *Env) error { return nil },
		},
		{Num: "B2", ID: "back-start", Title: title,
			Check: func(context.Context, *Env) (string, error) {
				if !r.stopped {
					return "xDesign was not stopped", nil
				}
				return "", nil
			},
			Act: func(ctx context.Context, env *Env) error {
				if err := stopService(ctx, env); err != nil {
					return err
				}
				return startAndCheck(ctx, env, r.u, r.site.cfg, r.site.version)
			},
			Verify: func(context.Context, *Env) error { return nil },
		},
	}
	if r.o.Port != 0 {
		steps = append(steps, r.stepBackPort())
	}
	return steps
}

// stepBackPort closes the new port again and puts its SELinux label back, when this run
// changed them, and install.json's records with them. xDesign answers on the old port by
// then, so a failure here is a warning with what to do by hand, and its record stays in
// install.json for the uninstall.
func (r *addressRun) stepBackPort() Step {
	return Step{Num: "B3", ID: "back-port", Title: "Close port " + r.to,
		Check: func(context.Context, *Env) (string, error) {
			if !r.opened && !r.labeled {
				return "the firewall and SELinux were not changed", nil
			}
			return "", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			if r.opened {
				allowed, err := r.firewall.Allowed(ctx, env, r.port)
				if err == nil && allowed {
					err = r.firewall.Close(ctx, env, r.port)
				}
				if err != nil {
					r.warnf(env, "TCP port %d could not be closed in %s again (%v): close it by hand", r.port, r.firewall.name(), err)
				} else {
					r.site.state.Firewall = r.fwBefore
				}
			}
			if r.labeled {
				r.unlabel(ctx, env)
			}
			return r.saveState(env)
		},
		Verify: func(context.Context, *Env) error { return nil },
	}
}

// entry is the run's entry in install.json's history.
func (r *addressRun) entry(result string) HistoryEntry {
	action := ActionSetPath
	if r.o.Port != 0 {
		action = ActionSetPort
	}
	return HistoryEntry{
		At: time.Now().UTC().Format(time.RFC3339), Action: action, Version: r.site.version, Change: r.change(), Result: result,
	}.withTimes(r.progress)
}

// record adds the failed change to install.json's history, as the file has it now.
func (r *addressRun) record(result string) {
	e := r.entry(result)
	err := r.env.Do("write "+StatePath+" (failed "+r.o.command()+")", func() error { return appendHistory(r.u.Sys.FS, e) })
	if err != nil {
		r.env.Log().Printf("could not write %s: %v", StatePath, err)
	}
}

// result prints the result: the --json object, or the end in pacman's style.
func (r *addressRun) result(res AddressResult) int {
	res.From, res.To, res.Notes, res.Log = r.from, r.to, r.notes, r.o.logPath()
	if r.site.cfg != nil {
		res.Address = r.site.cfg.PublicURL()
	}
	if res.Status == "changed" {
		res.Address = r.cfg.PublicURL()
	}
	switch {
	case r.o.JSON:
		b, err := json.MarshalIndent(res, "", "  ")
		if err == nil {
			fmt.Fprintf(r.u.Stdout, "%s\n", b)
		}
	case res.Status == "changed":
		r.out.write("") // ends a line the next output would replace
		r.out.line("")
		r.out.section("xDesign now answers at " + res.Address)
	default:
		r.out.write("")
		o := r.errOut
		o.line("")
		o.errorf("%s", res.Error)
		o.fact("log", r.o.logPath())
		switch {
		case res.Status == "went_back":
			o.section(fmt.Sprintf("xDesign went back to the %s %s and answers at %s as before.", r.what(), r.from, res.Address))
		case r.changed():
			o.section("Going back failed too. Send the log to the developer.")
		default:
			o.section("Nothing was changed.")
		}
	}
	if res.Status == "changed" {
		return exitOK
	}
	return exitFailed
}
