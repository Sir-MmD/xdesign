package install

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"

	"github.com/Sir-MmD/xdesign/helper/internal/maintreq"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// The Windows services (docs/plan/18-third-owner-list-2026-11-23.md sections 8.2 and 8.6):
// xdesign runs the site as NT SERVICE\xdesign; xdesign-maintenance runs the updates, the
// rollbacks and the restores as LocalSystem when xdesign starts it. Both run the release
// through the current junction, so an update changes neither.
const (
	maintenanceServiceName = "xdesign-maintenance"
	// servicePoll is how often a service's state is asked while it starts or stops.
	servicePoll = 500 * time.Millisecond
	// restartReset is the time without a failure after which Windows counts the site's
	// failures from 0 again (its failure actions), in seconds: a day.
	restartReset = 24 * 60 * 60
	// serviceLogLines is how many of the service log's last lines a failed start shows.
	serviceLogLines = 20
)

// winService is a service of section 8.2 or 8.6 as the installer makes it.
type winService struct {
	name   string
	config mgr.Config
	// args follow C:\Program Files\xDesign\current\xdesign.exe on its command line.
	args []string
	// words describe its settings in the plan and the log.
	words string
	// restarts gives it the failure actions of restartActions.
	restarts bool
	// security is the DACL of who may query, start, stop or change it, in SDDL; "" keeps
	// the one Windows gives a new service.
	security string
}

// windowsServices are the two services, the site's first.
func windowsServices() []winService {
	return []winService{
		{
			name: serviceName,
			config: mgr.Config{
				ServiceType: windows.SERVICE_WIN32_OWN_PROCESS, StartType: mgr.StartAutomatic, DelayedAutoStart: true,
				ErrorControl: mgr.ErrorNormal, DisplayName: "xDesign", ServiceStartName: `NT SERVICE\` + serviceName,
				SidType: windows.SERVICE_SID_TYPE_UNRESTRICTED,
			},
			args: []string{"serve", "--config", configPath},
			words: `"xDesign", automatic (delayed start), NT SERVICE\` + serviceName + `, restarted 5 s after a failure three ` +
				`times, then after 60 s`,
			restarts: true,
		},
		{
			name: maintenanceServiceName,
			config: mgr.Config{
				ServiceType: windows.SERVICE_WIN32_OWN_PROCESS, StartType: mgr.StartManual, ErrorControl: mgr.ErrorNormal,
				DisplayName: "xDesign maintenance", ServiceStartName: "LocalSystem",
			},
			args:     []string{"admin", "maintenance", "--request", filepath.Join(platform.MaintenanceDir, maintreq.RequestFileName)},
			words:    `"xDesign maintenance", manual start, LocalSystem; NT SERVICE\` + serviceName + " may only query and start it",
			security: maintenanceSecurity(),
		},
	}
}

// serviceNames are the names of the two services, for install.json.
func serviceNames() []string {
	var names []string
	for _, s := range windowsServices() {
		names = append(names, s.name)
	}
	return names
}

// maintenanceSecurity is the DACL of xdesign-maintenance: SYSTEM and Administrators as
// Windows gives them to a new service, and the site's account (by its SID, as the folders
// name it) may query its state and start it, nothing else (section 8.6).
func maintenanceSecurity() string {
	return "D:(A;;CCLCSWRPWPDTLOCRRC;;;SY)(A;;CCDCLCSWRPWPDTLOCRSDRCWDWO;;;BA)(A;;LCRP;;;" + platform.ServiceSID(serviceName) + ")"
}

// restartActions are the site's failure actions (WIN-03): restarted 5 seconds after each
// of the first three failures, then after 60 seconds, as systemd's Restart=on-failure.
func restartActions() []mgr.RecoveryAction {
	return []mgr.RecoveryAction{
		{Type: mgr.ServiceRestart, Delay: 5 * time.Second},
		{Type: mgr.ServiceRestart, Delay: 5 * time.Second},
		{Type: mgr.ServiceRestart, Delay: 5 * time.Second},
		{Type: mgr.ServiceRestart, Delay: 60 * time.Second},
	}
}

// commandLine is the service's command line as the service manager keeps it: the program
// in quotes, then its arguments, as mgr.CreateService writes it.
func (s winService) commandLine() string {
	line := windows.EscapeArg(currentBin)
	for _, a := range s.args {
		line += " " + windows.EscapeArg(a)
	}
	return line
}

// openService opens the service name with access; nil when it does not exist.
func openService(name string, access uint32) (*mgr.Service, error) {
	m, err := windows.OpenSCManager(nil, nil, windows.SC_MANAGER_CONNECT)
	if err != nil {
		return nil, fmt.Errorf("connect to the service manager: %w", err)
	}
	defer func() { _ = windows.CloseServiceHandle(m) }() // the service's handle stays valid
	p, err := windows.UTF16PtrFromString(name)
	if err != nil {
		return nil, fmt.Errorf("the service %s: %w", name, err)
	}
	h, err := windows.OpenService(m, p, access)
	switch {
	case errors.Is(err, windows.ERROR_SERVICE_DOES_NOT_EXIST):
		return nil, nil
	case err != nil:
		return nil, fmt.Errorf("open the service %s: %w", name, err)
	}
	return &mgr.Service{Name: name, Handle: h}, nil
}

// closeService closes a service's handle; nothing was changed through a failed close.
func closeService(s *mgr.Service) {
	_ = s.Close()
}

// serviceState is the state of the service name; found is false when it does not exist.
func serviceState(name string) (state svc.State, found bool, err error) {
	s, err := openService(name, windows.SERVICE_QUERY_STATUS)
	if err != nil || s == nil {
		return svc.Stopped, false, err
	}
	defer closeService(s)
	st, err := s.Query()
	if err != nil {
		return svc.Stopped, true, fmt.Errorf("ask the state of the service %s: %w", name, err)
	}
	return st.State, true, nil
}

// stateWords names a service's state as `Get-Service` does, in lower case.
func stateWords(state svc.State) string {
	switch state {
	case svc.Stopped:
		return "stopped"
	case svc.StartPending:
		return "starting"
	case svc.StopPending:
		return "stopping"
	case svc.Running:
		return "running"
	case svc.ContinuePending:
		return "resuming"
	case svc.PausePending:
		return "pausing"
	case svc.Paused:
		return "paused"
	}
	return fmt.Sprintf("in state %d", state)
}

// differs says what of the service s is not as the installer sets it ("missing", "another
// command line"), "" when it all is.
func (s winService) differs() (string, error) {
	h, err := openService(s.name, windows.SERVICE_QUERY_CONFIG|windows.READ_CONTROL)
	if err != nil {
		return "", err
	}
	if h == nil {
		return "missing", nil
	}
	defer closeService(h)
	have, err := h.Config()
	if err != nil {
		return "", fmt.Errorf("read the settings of the service %s: %w", s.name, err)
	}
	want := s.config
	switch {
	case !strings.EqualFold(have.BinaryPathName, s.commandLine()):
		return "another command line (" + have.BinaryPathName + ")", nil
	case !strings.EqualFold(have.ServiceStartName, want.ServiceStartName):
		return "another account (" + have.ServiceStartName + ")", nil
	case have.ServiceType != want.ServiceType || have.SidType != want.SidType:
		return "another type", nil
	case have.StartType != want.StartType || have.DelayedAutoStart != want.DelayedAutoStart || have.ErrorControl != want.ErrorControl:
		return "another start", nil
	case have.DisplayName != want.DisplayName:
		return "another display name (" + have.DisplayName + ")", nil
	}
	if s.restarts {
		actions, err := h.RecoveryActions()
		if err != nil {
			return "", fmt.Errorf("read the failure actions of the service %s: %w", s.name, err)
		}
		reset, err := h.ResetPeriod()
		if err != nil {
			return "", fmt.Errorf("read the failure actions of the service %s: %w", s.name, err)
		}
		always, err := h.RecoveryActionsOnNonCrashFailures()
		if err != nil {
			return "", fmt.Errorf("read the failure actions of the service %s: %w", s.name, err)
		}
		if !slices.Equal(actions, restartActions()) || reset != restartReset || !always {
			return "other failure actions", nil
		}
	}
	if s.security != "" {
		same, err := platform.ServiceSecurityMatches(h.Handle, s.security)
		if err != nil {
			return "", fmt.Errorf("the service %s: %w", s.name, err)
		}
		if !same {
			return "other permissions", nil
		}
	}
	return "", nil
}

// apply creates the service s, or gives an existing one the installer's settings (a
// repair), with its failure actions and its permissions.
func (s winService) apply() error {
	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("connect to the service manager: %w", err)
	}
	defer func() { _ = m.Disconnect() }() // the service's handle stays valid
	h, err := m.OpenService(s.name)
	switch {
	case errors.Is(err, windows.ERROR_SERVICE_DOES_NOT_EXIST):
		if h, err = m.CreateService(s.name, currentBin, s.config, s.args...); err != nil {
			return fmt.Errorf("create the service %s: %w", s.name, err)
		}
	case err != nil:
		return fmt.Errorf("open the service %s: %w", s.name, err)
	default:
		c := s.config
		c.BinaryPathName = s.commandLine()
		if err := h.UpdateConfig(c); err != nil {
			closeService(h)
			return fmt.Errorf("change the service %s: %w", s.name, err)
		}
	}
	defer closeService(h)
	if s.restarts {
		if err := h.SetRecoveryActions(restartActions(), restartReset); err != nil {
			return fmt.Errorf("set the failure actions of the service %s: %w", s.name, err)
		}
		if err := h.SetRecoveryActionsOnNonCrashFailures(true); err != nil {
			return fmt.Errorf("set the failure actions of the service %s: %w", s.name, err)
		}
	}
	if s.security != "" {
		if err := platform.SetServiceSecurity(h.Handle, s.security); err != nil {
			return fmt.Errorf("the service %s: %w", s.name, err)
		}
	}
	return nil
}

// startWindowsService starts the service name; one that runs already is left running.
func startWindowsService(name string) error {
	s, err := openService(name, windows.SERVICE_START)
	if err != nil {
		return err
	}
	if s == nil {
		return fmt.Errorf("the service %s does not exist", name)
	}
	defer closeService(s)
	if err := s.Start(); err != nil && !errors.Is(err, windows.ERROR_SERVICE_ALREADY_RUNNING) {
		return fmt.Errorf("start the service %s: %w", name, err)
	}
	return nil
}

// stopWindowsService stops the service name and waits until it stopped, up to stopTimeout
// (it asks for 30 seconds); a missing or stopped service is left as it is.
func stopWindowsService(ctx context.Context, name string) error {
	s, err := openService(name, windows.SERVICE_STOP|windows.SERVICE_QUERY_STATUS)
	if err != nil || s == nil {
		return err
	}
	defer closeService(s)
	if _, err := s.Control(svc.Stop); err != nil && !errors.Is(err, windows.ERROR_SERVICE_NOT_ACTIVE) &&
		!errors.Is(err, windows.ERROR_SERVICE_CANNOT_ACCEPT_CTRL) {
		return fmt.Errorf("stop the service %s: %w", name, err)
	}
	deadline := time.Now().Add(stopTimeout)
	for {
		st, err := s.Query()
		if err != nil {
			return fmt.Errorf("ask the state of the service %s: %w", name, err)
		}
		if st.State == svc.Stopped {
			return nil
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("the service %s did not stop within %s; it is %s", name, formatElapsed(stopTimeout), stateWords(st.State))
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("interrupted while the service %s stopped: %w", name, ctx.Err())
		case <-time.After(servicePoll):
		}
	}
}

// stepServices makes the two services (sections 8.2 and 8.6) once the files and the data
// they run with are in place, and records them in install.json. A repair gives existing
// services the installer's settings again.
func (r *run) stepServices() Step {
	done := func() {
		r.enabledAtBoot = true
		r.state.Services = serviceNames()
	}
	return Step{
		ID: "services", Title: "Windows services",
		Check: func(context.Context, *Env) (string, error) {
			for _, s := range windowsServices() {
				diff, err := s.differs()
				if err != nil || diff != "" {
					return "", err
				}
			}
			done()
			return "xdesign starts at boot, and xdesign-maintenance waits for Maintenance", nil
		},
		Act: func(_ context.Context, env *Env) error {
			for _, s := range windowsServices() {
				if diff, err := s.differs(); err == nil && diff == "" {
					continue
				}
				if err := env.Do(fmt.Sprintf("set up the service %s (%s): %s", s.name, s.words, s.commandLine()), s.apply); err != nil {
					return err
				}
			}
			if env.DryRun {
				return nil
			}
			done()
			return r.saveState(env)
		},
		Verify: func(context.Context, *Env) error {
			for _, s := range windowsServices() {
				diff, err := s.differs()
				if err != nil {
					return err
				}
				if diff != "" {
					return fmt.Errorf("the service %s still has %s", s.name, diff)
				}
			}
			return nil
		},
	}
}

// stepStart starts the service xdesign, or restarts it in a repair or when it runs already,
// and waits until the website answers (section 8.3 step 7).
func (r *run) stepStart() Step {
	return Step{
		ID: "start", Title: "Start and health check",
		Check: func(ctx context.Context, _ *Env) (string, error) {
			if r.mode == ModeRepair {
				return "", nil
			}
			state, _, err := serviceState(serviceName)
			if err != nil || state != svc.Running || r.healthy(ctx, healthURL(r.cfg)) != nil {
				return "", err
			}
			return "running and healthy", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			state, found, err := serviceState(serviceName)
			if err != nil {
				return err
			}
			restart := r.mode == ModeRepair || (found && state != svc.Stopped)
			desc, detail := "Start-Service "+serviceName, "starting xDesign"
			if restart {
				desc, detail = "Restart-Service "+serviceName, "restarting xDesign"
			}
			w := env.waiting(ctx, detail)
			defer w.stop()
			if err := env.Do(desc, func() error {
				if restart {
					if err := stopWindowsService(ctx, serviceName); err != nil {
						return err
					}
				}
				return startWindowsService(serviceName)
			}); err != nil {
				return err
			}
			return r.waitReady(ctx, env, w)
		},
		Verify: func(context.Context, *Env) error { return nil }, // Act ran the health check
	}
}

// waitReady waits until the service runs and the website answers /api/health, up to
// healthWait, as on Linux. A service that stopped, or a website that did not answer, shows
// the last lines of the service's log (xdesign logs). w is the waiter of the step.
func (r *run) waitReady(ctx context.Context, env *Env, w *waiter) error {
	url := healthURL(r.cfg)
	if env.DryRun {
		env.Plan(fmt.Sprintf("wait up to %s until %s answers", formatElapsed(healthWait), url))
		return nil
	}
	if r.in.Get == nil {
		env.Warnf("the health check is left out: this build cannot ask the website")
		return nil
	}
	w.say("waiting for the website to answer")
	start := time.Now()
	var last error
	for {
		state, _, err := serviceState(serviceName)
		switch {
		case err != nil:
			last = err
		case state == svc.Stopped:
			r.showServiceLog(env)
			return fmt.Errorf("the service %s stopped; its log says why: xdesign logs --lines 50", serviceName)
		case state != svc.Running:
			last = fmt.Errorf("the service %s is %s", serviceName, stateWords(state))
		default:
			err := r.healthy(ctx, url)
			if err == nil {
				env.Factf("health", "the website answered after %s", formatElapsed(time.Since(start)))
				return nil
			}
			last = err
		}
		if time.Since(start) >= healthWait {
			r.showServiceLog(env)
			return fmt.Errorf("the website did not answer within %s (last: %w); see Get-Service %s and xdesign logs --lines 50",
				formatElapsed(healthWait), last, serviceName)
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("interrupted while waiting for the website to answer; the service %s keeps running (Get-Service %s)",
				serviceName, serviceName)
		case <-time.After(healthPoll):
		}
	}
}

// showServiceLog adds the last lines of the service's log, C:\ProgramData\xDesign\logs\
// xdesign.log, under the step's line, as Linux names the journal: what the service said
// before it stopped.
func (r *run) showServiceLog(env *Env) {
	data, err := r.sys.FS.ReadFile(platform.ServiceLog)
	if err != nil {
		env.Notef("the service's log cannot be read: %v", err)
		return
	}
	lines := strings.Split(strings.TrimRight(string(data), "\r\n"), "\n")
	if len(lines) > serviceLogLines {
		lines = lines[len(lines)-serviceLogLines:]
	}
	text := strings.TrimSpace(strings.Join(lines, "\n"))
	if text == "" {
		env.Notef("the service's log %s is empty", platform.ServiceLog)
		return
	}
	env.Notef("the last lines of %s:\n%s", platform.ServiceLog, strings.ReplaceAll(text, "\r", ""))
}

// stopForFiles stops the service xdesign before the files step replaces the release folder
// it runs from: Windows does not let a running program's files be removed (a repair of a
// damaged release). The start step starts it again.
func (r *run) stopForFiles(ctx context.Context, env *Env, dir string) error {
	state, found, err := serviceState(serviceName)
	if err != nil || !found || state == svc.Stopped || !r.junctionTo(currentLink, dir) {
		return err
	}
	return env.Do("Stop-Service "+serviceName+" (it runs from "+dir+")", func() error { return stopWindowsService(ctx, serviceName) })
}
