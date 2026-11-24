package front

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/exec"
	"slices"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// Supervision of the app (docs/plan/07-server-install-update.md section 1, D-30).
const (
	// firstBackoff is the wait before the first restart; it doubles after every exit up to
	// maxBackoff, and starts again at firstBackoff after the app was up for resetAfter.
	firstBackoff = time.Second
	maxBackoff   = 30 * time.Second
	resetAfter   = 2 * time.Minute
	// stopTimeout is how long the app has after SIGTERM before it is killed.
	stopTimeout = 10 * time.Second
	// healthInterval is the pause between two health checks while the app starts; each
	// check gets healthTimeout.
	healthInterval = 200 * time.Millisecond
	healthTimeout  = 2 * time.Second
	// maxHealthBody bounds the health answer read: {"ok":true,"version":"..."}.
	maxHealthBody = 4 << 10
)

// The app's channel (docs/plan/18-third-owner-list-2026-11-23.md section 8.2).
const (
	// socketHost is the host of the addresses on the Unix socket, which the dialer ignores.
	socketHost = "app"
	// proxySecretBytes is the size of the proxy secret, before it is written in hex.
	proxySecretBytes = 32
)

// AppState is the state of the app in AppStatus.
type AppState string

// Values of AppState.
const (
	// StateStarting: the app runs but does not answer <base path>api/health yet.
	StateStarting AppState = "starting"
	// StateRunning: the app answers, and the front passes requests to it.
	StateRunning AppState = "running"
	// StateRestarting: the app exited or did not start; the front waits before starting it
	// again.
	StateRestarting AppState = "restarting"
	// StateStopping: the front is shutting down and has asked the app to stop.
	StateStopping AppState = "stopping"
	// StateStopped: the app does not run and is not started again.
	StateStopped AppState = "stopped"
)

// AppStatus describes the app, for the control socket's GET /status.
type AppStatus struct {
	State AppState `json:"state"`
	// PID is the app's process ID, 0 when it does not run.
	PID int `json:"pid"`
	// Restarts counts the starts after the first.
	Restarts int `json:"restarts"`
	// LastExit is how the app last ended, nil before its first exit.
	LastExit *Exit `json:"last_exit"`
}

// Exit describes how the app's process ended, or why it did not start.
type Exit struct {
	At time.Time `json:"at"`
	// Code is the exit code, -1 when a signal ended the process or it did not start.
	Code int `json:"code"`
	// Signal names the signal that ended the process ("killed"), empty otherwise.
	Signal string `json:"signal,omitempty"`
	// Error says why the process did not start, empty otherwise.
	Error string `json:"error,omitempty"`
}

// ChildOptions say how the app is started.
type ChildOptions struct {
	// Node is the Node.js runtime and Script the app's bundle, server.mjs.
	Node   string
	Script string
	// Dir is the app's working folder.
	Dir string
	// Env holds the app's variables (XD_DATA_DIR, ... as name=value), which replace those
	// of the helper's environment; the front adds those of the app's channel at each start
	// (XD_SOCKET, or XD_PORT and XD_PROXY_SECRET).
	Env []string
	// Socket is the Unix socket the app listens on (its XD_SOCKET), where the front checks
	// its health and passes the requests. Empty on Windows: the app listens on a port of
	// 127.0.0.1 that the front picks at each start, and wants the proxy secret of that start
	// on every request (docs/plan/18-third-owner-list-2026-11-23.md section 8.2).
	Socket string
	// BasePath is the web base path the app answers under (its XD_BASE_PATH): "/" or
	// "/k3v9x2m1q8wz7r4t/". The front asks the app's health at <BasePath>api/health and
	// passes it only the requests under BasePath.
	BasePath string
	// Output receives the app's stdout and stderr lines: the helper's stderr, which is the
	// journal under systemd; the Windows service's log file (internal/logfile).
	Output io.Writer
}

// Child starts the app, watches it and restarts it when it exits, until its Run ends.
type Child struct {
	opts   ChildOptions
	env    []string
	health *http.Client
	log    *slog.Logger

	mu     sync.Mutex
	status AppStatus
	target appTarget
}

// appTarget is where the requests to the app's current start go: the host of their address
// (any name on the Unix socket, 127.0.0.1:<port> without it) and the proxy secret, empty on
// the Unix socket.
type appTarget struct {
	host   string
	secret string
}

// NewChild returns the supervisor of the app described by opts; Run starts it.
func NewChild(opts ChildOptions, log *slog.Logger) *Child {
	return &Child{
		opts:   opts,
		env:    appEnv(os.Environ(), opts.Env),
		health: &http.Client{Transport: &http.Transport{DialContext: appDialer(opts.Socket), DisableKeepAlives: true}},
		log:    log.With("part", "app"),
		status: AppStatus{State: StateStarting},
	}
}

// Ready reports whether the app answers its health check, so requests can go to it.
func (c *Child) Ready() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.status.State == StateRunning
}

// Status returns the app's state now.
func (c *Child) Status() AppStatus {
	c.mu.Lock()
	defer c.mu.Unlock()
	s := c.status
	if s.LastExit != nil {
		last := *s.LastExit
		s.LastExit = &last
	}
	return s
}

func (c *Child) update(change func(s *AppStatus)) {
	c.mu.Lock()
	defer c.mu.Unlock()
	change(&c.status)
}

// currentTarget returns where the requests to the app go now.
func (c *Child) currentTarget() appTarget {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.target
}

// Run starts the app and starts it again whenever it exits, after a wait of 1 second that
// doubles up to 30 seconds and starts again at 1 second once the app was up for 2 minutes.
// When ctx ends it stops the app (SIGTERM, then SIGKILL after 10 seconds; on Windows its
// standard input closes, and its job object ends it after 10 seconds) and returns.
func (c *Child) Run(ctx context.Context) {
	wait := firstBackoff
	for {
		up := c.runOnce(ctx)
		if ctx.Err() != nil {
			break
		}
		if up >= resetAfter {
			wait = firstBackoff
		}
		c.log.Info("restarting the app", "after", wait.String())
		timer := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			timer.Stop()
		case <-timer.C:
		}
		if ctx.Err() != nil {
			break
		}
		wait = min(wait*2, maxBackoff)
		c.update(func(s *AppStatus) { s.Restarts++ })
	}
	c.update(func(s *AppStatus) { s.State, s.PID = StateStopped, 0 })
	c.log.Info("app stopped")
}

// runOnce starts the app and waits until it exits; when ctx ends first, it stops the app.
// It returns how long the app was up.
func (c *Child) runOnce(ctx context.Context) time.Duration {
	c.update(func(s *AppStatus) { s.State, s.PID = StateStarting, 0 })
	target, vars, err := c.newTarget(ctx)
	if err != nil {
		c.notStarted(ctx, err)
		return 0
	}
	c.mu.Lock()
	c.target = target
	c.mu.Unlock()
	//nolint:gosec // G204: the runtime and the bundle of this release (or the repository's build), never request input
	cmd := exec.CommandContext(ctx, c.opts.Node, c.opts.Script)
	cmd.Dir = c.opts.Dir
	cmd.Env = append(slices.Clip(c.env), vars...)
	// Lines go straight to the helper's stderr when it is a file (the journal's stream);
	// the Windows service's log writer gets them through a pipe, both on one.
	cmd.Stdout, cmd.Stderr = c.opts.Output, c.opts.Output
	// A process group of its own: Ctrl-C in a terminal reaches only the front, which then
	// stops the app in order instead of restarting it. On Windows a job object, so the app
	// ends with the helper, and a pipe on its standard input, which stops it.
	proc, err := platform.PrepareChild(cmd)
	if err != nil {
		c.notStarted(ctx, err)
		return 0
	}
	defer proc.Release()
	cmd.Cancel = func() error {
		c.update(func(s *AppStatus) { s.State = StateStopping })
		c.log.Info("stopping the app", "pid", cmd.Process.Pid)
		return proc.Stop()
	}
	// After SIGTERM (on Windows, its standard input closed) the app has stopTimeout to exit
	// before it is killed.
	cmd.WaitDelay = stopTimeout

	if err := cmd.Start(); err != nil {
		c.notStarted(ctx, err)
		return 0
	}
	if err := proc.Started(); err != nil {
		// Outside its job object the app would outlive the helper: it ends at once.
		_ = cmd.Process.Kill() // it may have exited already
		_ = cmd.Wait()         // the error is the kill's
		c.notStarted(ctx, err)
		return 0
	}
	started := time.Now()
	pid := cmd.Process.Pid
	c.update(func(s *AppStatus) { s.PID = pid })
	c.log.Info("app started", "pid", pid)

	healthCtx, stopHealth := context.WithCancel(ctx)
	healthDone := make(chan struct{})
	go func() {
		defer close(healthDone)
		if !c.waitHealthy(healthCtx, target) {
			return
		}
		ready := false
		c.update(func(s *AppStatus) {
			if ready = s.State == StateStarting && s.PID == pid; ready {
				s.State = StateRunning
			}
		})
		if ready {
			c.log.Info("app is ready", "pid", pid, "ms", time.Since(started).Milliseconds())
		}
	}()
	err = cmd.Wait()
	stopHealth()
	<-healthDone

	up := time.Since(started)
	exit := exitOf(cmd.ProcessState)
	c.update(func(s *AppStatus) { s.State, s.PID, s.LastExit = afterExit(ctx), 0, &exit })
	attrs := []any{"pid", pid, "code", exit.Code, "up", up.Round(time.Second).String()}
	if exit.Signal != "" {
		attrs = append(attrs, "signal", exit.Signal)
	}
	// Wait returns the context's error for an app the front stopped, an *exec.ExitError for
	// an exit status; anything else means the wait itself failed.
	if _, ok := errors.AsType[*exec.ExitError](err); err != nil && !ok && !errors.Is(err, context.Canceled) {
		attrs = append(attrs, "error", err.Error())
	}
	level := slog.LevelWarn
	if ctx.Err() != nil {
		level = slog.LevelInfo // stopped by the front
	}
	c.log.Log(ctx, level, "app exited", attrs...)
	return up
}

// newTarget returns where the app of a new start listens, with the app's variables that say
// so: its Unix socket (XD_SOCKET); without one a free port of 127.0.0.1 (XD_PORT) and a new
// proxy secret that every request must carry (XD_PROXY_SECRET). The port is free when the
// front closes its listener, just before the start: if another program takes it in between,
// the app fails to listen and exits, and the next start picks again.
func (c *Child) newTarget(ctx context.Context) (appTarget, []string, error) {
	if c.opts.Socket != "" {
		return appTarget{host: socketHost}, []string{"XD_SOCKET=" + c.opts.Socket}, nil
	}
	var lc net.ListenConfig
	ln, err := lc.Listen(ctx, "tcp", "127.0.0.1:0")
	if err != nil {
		return appTarget{}, nil, fmt.Errorf("pick a port for the app: %w", err)
	}
	addr := ln.Addr().String()
	_ = ln.Close() // only probed
	_, port, err := net.SplitHostPort(addr)
	if err != nil {
		return appTarget{}, nil, fmt.Errorf("pick a port for the app: %w", err)
	}
	b := make([]byte, proxySecretBytes)
	_, _ = rand.Read(b) // never fails (crypto/rand)
	secret := hex.EncodeToString(b)
	return appTarget{host: addr, secret: secret}, []string{"XD_PORT=" + port, "XD_PROXY_SECRET=" + secret}, nil
}

// notStarted records a start that failed before the app ran.
func (c *Child) notStarted(ctx context.Context, err error) {
	c.log.Error("the app did not start", "error", err.Error())
	c.update(func(s *AppStatus) {
		s.State, s.LastExit = afterExit(ctx), &Exit{At: time.Now().UTC(), Code: -1, Error: err.Error()}
	})
}

// afterExit is the app's state once its process ended: restarting, or stopping while the
// front shuts down.
func afterExit(ctx context.Context) AppState {
	if ctx.Err() != nil {
		return StateStopping
	}
	return StateRestarting
}

// waitHealthy asks the app's <base path>api/health at target until it answers {"ok":
// true}; false when ctx ends first (the app exited, or the front stops).
func (c *Child) waitHealthy(ctx context.Context, target appTarget) bool {
	ticker := time.NewTicker(healthInterval)
	defer ticker.Stop()
	for {
		if c.healthy(ctx, target) {
			return true
		}
		select {
		case <-ctx.Done():
			return false
		case <-ticker.C:
		}
	}
}

func (c *Child) healthy(ctx context.Context, target appTarget) bool {
	ctx, cancel := context.WithTimeout(ctx, healthTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://"+target.host+c.opts.BasePath+"api/health", http.NoBody)
	if err != nil {
		return false
	}
	if target.secret != "" {
		req.Header.Set(proxyHeader, target.secret)
	}
	resp, err := c.health.Do(req)
	if err != nil {
		return false // not listening yet
	}
	defer func() { _ = resp.Body.Close() }() // read-only
	var body struct {
		OK bool `json:"ok"`
	}
	err = json.NewDecoder(io.LimitReader(resp.Body, maxHealthBody)).Decode(&body)
	return resp.StatusCode == http.StatusOK && err == nil && body.OK
}

// exitOf describes a process that Wait saw end.
func exitOf(state *os.ProcessState) Exit {
	exit := Exit{At: time.Now().UTC(), Code: -1}
	if state == nil {
		return exit
	}
	exit.Code = state.ExitCode()
	if ws, ok := state.Sys().(syscall.WaitStatus); ok && ws.Signaled() {
		exit.Signal = ws.Signal().String()
	}
	return exit
}

// appEnv returns the app's environment: the helper's, without its XD_ variables, its
// NODE_ENV and the systemd variables meant for the helper alone, then NODE_ENV=production
// (the app checks designs strictly only outside production) and vars.
func appEnv(base, vars []string) []string {
	env := make([]string, 0, len(base)+1+len(vars))
	for _, kv := range base {
		name, _, _ := strings.Cut(kv, "=")
		if strings.HasPrefix(name, "XD_") || strings.HasPrefix(name, "LISTEN_") || name == "NOTIFY_SOCKET" || name == "NODE_ENV" {
			continue
		}
		env = append(env, kv)
	}
	env = append(env, "NODE_ENV=production")
	return append(env, vars...)
}
