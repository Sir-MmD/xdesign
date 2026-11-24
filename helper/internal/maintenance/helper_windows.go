package maintenance

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"golang.org/x/sys/windows"

	"github.com/Sir-MmD/xdesign/helper/internal/maintreq"
)

// On Windows the helper is the service xdesign-maintenance
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.6): LocalSystem, manual start,
// and its permissions let serve's account NT SERVICE\xdesign query its state and start it,
// nothing else. serve writes the request file, then starts it, in place of the Linux path
// unit.
const (
	helperService = "xdesign-maintenance"
	// repairWords end the messages of a helper serve cannot start.
	repairWords = "Run the installer again on the server to repair it: xdesign --install"
	// restartWait bounds how long serve waits for a helper that ran when a request was
	// written to stop, so as to start it again for that request.
	restartWait = 2 * time.Minute
	// restartPoll is how often serve looks at that helper.
	restartPoll = time.Second
	// programWords names where the releases are, for the free space of an update's checks.
	programWords = `C:\Program Files\xDesign`
)

// State tells whether the helper can carry out requests: the service exists and serve may
// start it (it opens with the rights to start it and to ask its state).
func (h *helper) State() HelperState {
	if h.dev {
		return HelperState{State: HelperDevelopment, Message: "Works on a server: xdesign serve --dev has no maintenance helper."}
	}
	s, err := openHelperService()
	switch {
	case errors.Is(err, windows.ERROR_SERVICE_DOES_NOT_EXIST):
		return HelperState{State: HelperMissing, Message: "This installation has no maintenance helper (the service " + helperService +
			"). " + repairWords}
	case err != nil:
		return HelperState{State: HelperOff, Message: "xDesign may not start its maintenance helper (" + err.Error() + "). " + repairWords}
	}
	_ = windows.CloseServiceHandle(s) // only opened
	return HelperState{State: HelperReady}
}

// openHelperService opens the service xdesign-maintenance with the rights its permissions
// give serve (mgr.OpenService asks for every right, which they refuse).
func openHelperService() (windows.Handle, error) {
	m, err := windows.OpenSCManager(nil, nil, windows.SC_MANAGER_CONNECT)
	if err != nil {
		return 0, fmt.Errorf("connect to the service manager: %w", err)
	}
	defer func() { _ = windows.CloseServiceHandle(m) }() // the service's handle stays valid
	name, err := windows.UTF16PtrFromString(helperService)
	if err != nil {
		return 0, fmt.Errorf("the service %s: %w", helperService, err)
	}
	s, err := windows.OpenService(m, name, windows.SERVICE_START|windows.SERVICE_QUERY_STATUS)
	if err != nil {
		return 0, fmt.Errorf("open the service %s: %w", helperService, err)
	}
	return s, nil
}

// start starts the service xdesign-maintenance for the request just written. One that
// runs already takes a request written while it ran before it stops; should it stop
// first, restartWhenStopped starts it again. A service that cannot be started takes the
// request back.
func (h *helper) start(ctx context.Context) error {
	s, err := openHelperService()
	if err == nil {
		err = windows.StartService(s, 0, nil)
		_ = windows.CloseServiceHandle(s) // only started
		if err != nil {
			err = fmt.Errorf("start the service %s: %w", helperService, err)
		}
	}
	switch {
	case err == nil:
		return nil
	case errors.Is(err, windows.ERROR_SERVICE_ALREADY_RUNNING):
		go h.restartWhenStopped(context.WithoutCancel(ctx))
		return nil
	}
	if rerr := os.Remove(h.path(maintreq.RequestFileName)); rerr != nil {
		h.log.WarnContext(ctx, "the maintenance request cannot be taken back", "error", rerr)
	}
	return refused(RefusedNotNow, "xDesign could not start its maintenance helper (%v). %s", err, repairWords)
}

// restartWhenStopped watches the helper that ran when a request was written: once the
// request is gone it was taken; once the service stopped with the request still there, it
// starts the service again. It gives up after restartWait.
func (h *helper) restartWhenStopped(ctx context.Context) {
	deadline := time.Now().Add(restartWait)
	for time.Now().Before(deadline) {
		time.Sleep(restartPoll)
		if _, err := os.Lstat(h.path(maintreq.RequestFileName)); errors.Is(err, os.ErrNotExist) {
			return
		}
		s, err := openHelperService()
		if err != nil {
			h.log.WarnContext(ctx, "the maintenance helper cannot be started again", "error", err)
			return
		}
		var st windows.SERVICE_STATUS
		err = windows.QueryServiceStatus(s, &st)
		if err == nil && st.CurrentState == windows.SERVICE_STOPPED {
			err = windows.StartService(s, 0, nil)
			_ = windows.CloseServiceHandle(s) // only started
			if err != nil && !errors.Is(err, windows.ERROR_SERVICE_ALREADY_RUNNING) {
				h.log.WarnContext(ctx, "the maintenance helper cannot be started again", "error", err)
			}
			return
		}
		_ = windows.CloseServiceHandle(s) // only asked
		if err != nil {
			h.log.WarnContext(ctx, "the maintenance helper's state cannot be read", "error", err)
			return
		}
	}
}

// syncDir does nothing on Windows: a folder cannot be flushed there, and NTFS journals the
// rename itself.
func syncDir(string) error {
	return nil
}
