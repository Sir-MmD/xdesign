package app

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"

	"golang.org/x/sys/windows/svc"

	"github.com/Sir-MmD/xdesign/helper/internal/cli"
	"github.com/Sir-MmD/xdesign/helper/internal/logfile"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// The service xdesign-maintenance (docs/plan/18-third-owner-list-2026-11-23.md section
// 8.6), which the installer creates: "C:\Program Files\xDesign\current\xdesign.exe" admin
// maintenance --request C:\ProgramData\xDesign\maintenance\request.json, as LocalSystem,
// started by serve once it wrote the request file.
const (
	maintenanceServiceName = "xdesign-maintenance"
	// maxMaintenanceRuns bounds the requests one start of the service carries out: the one
	// it was started for, and those written while it ran (as the Linux path unit starts the
	// helper again for a request file it finds when the helper ends).
	maxMaintenanceRuns = 10
)

// runMaintenance is `xdesign admin maintenance --request FILE`. Started by the service
// manager, it answers it (maintenanceService) and writes its lines to
// C:\ProgramData\xDesign\logs\maintenance.log (internal/logfile), as the journal keeps the
// Linux helper's. From a terminal opened as Administrator it runs as on Linux.
func runMaintenance(ctx context.Context, args []string, stdout, stderr io.Writer) int {
	isService, err := svc.IsWindowsService()
	if err != nil {
		fmt.Fprintf(stderr, "xdesign admin maintenance: ask whether this runs as a service: %v\n", err)
		return exitError
	}
	if !isService {
		return cli.RunMaintenance(ctx, cli.OSEnv(os.Stdin, stdout, stderr), args)
	}
	// Only the end of the work stops the service: the console events a service still gets
	// (a user signing out of the server), which Go turns into SIGTERM, must not.
	ctx = context.WithoutCancel(ctx)
	// Without its log file the work still runs, and its lines are lost.
	out := io.Discard
	if lf, err := logfile.Open(platform.MaintenanceLog); err == nil {
		defer func() { _ = lf.Close() }() // written line by line
		lf.CrashOutput()
		out = lf.Writer()
	}
	request := requestFlag(args)
	h := &maintenanceService{log: out, run: func() int {
		code := exitOK
		for range maxMaintenanceRuns {
			code = cli.RunMaintenance(ctx, cli.OSEnv(os.Stdin, out, out), args)
			if _, err := os.Lstat(request); err != nil {
				break // no request was written meanwhile
			}
			fmt.Fprintln(out, "xdesign admin maintenance: a new request was written meanwhile")
		}
		return code
	}}
	if err := svc.Run(maintenanceServiceName, h); err != nil {
		fmt.Fprintf(out, "xdesign admin maintenance: the service manager: %v\n", err)
		return exitError
	}
	return h.code
}

// requestFlag is the value of --request in args, "" without one (RunMaintenance refuses
// that).
func requestFlag(args []string) string {
	for i, a := range args {
		if v, ok := strings.CutPrefix(strings.TrimPrefix(a, "-"), "-request="); ok {
			return v
		}
		if (a == "--request" || a == "-request") && i+1 < len(args) {
			return args[i+1]
		}
	}
	return ""
}

// maintenanceService is the handler of the service xdesign-maintenance.
type maintenanceService struct {
	// run carries out the requests and returns the exit status.
	run func() int
	// log is the service's log file.
	log io.Writer
	// code is run's exit status once Execute returned.
	code int
}

// Execute is the service: it reports Start pending, starts the work and reports Running at
// once (Windows waits 30 seconds for that), then Stopped when the work ends, with the
// service-specific exit code 1 when it failed. Stop is not accepted while it works: an
// update or a restore must not stop halfway (Stop-Service answers that the service cannot
// take the control now). Shutdown is: the service reports Stop pending and the work goes on
// for as long as Windows waits; an update's guard (internal/guard) takes over from there.
func (h *maintenanceService) Execute(_ []string, requests <-chan svc.ChangeRequest, changes chan<- svc.Status) (bool, uint32) {
	changes <- svc.Status{State: svc.StartPending, WaitHint: startWaitHint}
	done := make(chan int, 1)
	go func() { done <- h.run() }()
	changes <- svc.Status{State: svc.Running, Accepts: svc.AcceptShutdown}
	stopping := false
	for {
		select {
		case r := <-requests:
			if r.Cmd == svc.Interrogate {
				changes <- r.CurrentStatus
			}
			if r.Cmd == svc.Shutdown && !stopping {
				stopping = true
				fmt.Fprintln(h.log, "xdesign admin maintenance: Windows shuts down while the request is carried out")
				changes <- svc.Status{State: svc.StopPending, WaitHint: stopWaitHint}
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
