package app

import (
	"context"
	"fmt"
	"io"
	"sync"

	"golang.org/x/sys/windows/svc"

	"github.com/Sir-MmD/xdesign/helper/internal/logfile"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// nodeFile is the Node.js runtime in a release's runtime folder (section 8.2).
const nodeFile = "node.exe"

// The service xdesign (docs/plan/18-third-owner-list-2026-11-23.md section 8.2), which the
// installer creates: "C:\Program Files\xDesign\current\xdesign.exe" serve --config
// C:\ProgramData\xDesign\config.toml, as NT SERVICE\xdesign.
const (
	serviceName = "xdesign"
	// startWaitHint and stopWaitHint, in milliseconds, are how long the service manager is
	// told a start or a stop may take. The start lasts until the front listens; the stop
	// gives the requests in flight 5 seconds, the app 10 and the control server 5, within
	// the 30 seconds of systemd's TimeoutStopSec.
	startWaitHint = 30_000
	stopWaitHint  = 30_000
	// serviceFailed is the service-specific exit code of a serve that ended with an error;
	// the log file says which.
	serviceFailed = 1
)

// runServe runs serve as the service xdesign when the service manager started this
// process: its lines and the app's output go to C:\ProgramData\xDesign\logs\xdesign.log
// (internal/logfile). From a console, for a developer, it runs as on Linux, with both on
// stderr.
func runServe(ctx context.Context, stderr io.Writer, run serveFunc) int {
	isService, err := svc.IsWindowsService()
	if err != nil {
		fmt.Fprintf(stderr, "xdesign serve: ask whether this runs as a service: %v\n", err)
		return exitError
	}
	if !isService {
		return serveExit(stderr, run(ctx, serveOutput{log: stderr, app: stderr, listening: func() {}}))
	}
	// Only the service manager stops the service: Go turns the console events a service
	// still gets (a user signing out of the server) into SIGTERM, which must not.
	ctx, stop := context.WithCancel(context.WithoutCancel(ctx))
	defer stop()
	// Without its log file the site still runs, and its lines are lost.
	logOut, appOut := io.Discard, io.Discard
	if lf, err := logfile.Open(platform.ServiceLog); err == nil {
		defer func() { _ = lf.Close() }() // written line by line
		lf.CrashOutput()
		logOut, appOut = lf.Writer(), lf.Writer()
	}
	h := &service{stop: stop, serve: func(listening func()) int {
		return serveExit(logOut, run(ctx, serveOutput{log: logOut, app: appOut, listening: listening}))
	}}
	if err := svc.Run(serviceName, h); err != nil {
		fmt.Fprintf(logOut, "xdesign serve: the service manager: %v\n", err)
		return exitError
	}
	return h.code
}

// service is the handler of the service xdesign.
type service struct {
	// serve runs serve until stop, calls listening once the front listens and returns the
	// exit status.
	serve func(listening func()) int
	stop  context.CancelFunc
	// code is serve's exit status once Execute returned.
	code int
}

// Execute is the service: it reports Start pending and runs serve, reports Running once
// the front listens, and takes Stop and Shutdown from then on: at either it reports Stop
// pending and ends serve, which lets the requests in flight finish, stops the app (its
// standard input closed, its job object after 10 seconds) and closes the control server.
// A serve that ends with an error ends the service with the service-specific exit code 1.
func (h *service) Execute(_ []string, requests <-chan svc.ChangeRequest, changes chan<- svc.Status) (bool, uint32) {
	changes <- svc.Status{State: svc.StartPending, WaitHint: startWaitHint}
	listening := make(chan struct{})
	var once sync.Once
	done := make(chan int, 1)
	go func() { done <- h.serve(func() { once.Do(func() { close(listening) }) }) }()
	stopping := false
	for {
		select {
		case <-listening:
			listening = nil // a nil channel is never ready again
			if !stopping {
				changes <- svc.Status{State: svc.Running, Accepts: svc.AcceptStop | svc.AcceptShutdown}
			}
		case r := <-requests:
			if r.Cmd == svc.Interrogate {
				changes <- r.CurrentStatus
			}
			if (r.Cmd == svc.Stop || r.Cmd == svc.Shutdown) && !stopping {
				stopping = true
				changes <- svc.Status{State: svc.StopPending, WaitHint: stopWaitHint}
				h.stop()
			}
		case code := <-done:
			h.code = code
			if code != exitOK {
				return true, serviceFailed
			}
			return false, 0
		}
	}
}
