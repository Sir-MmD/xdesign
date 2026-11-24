// Package maintenance is xdesign serve's side of updates and going back
// (docs/plan/07-server-install-update.md section 6.2, Maintenance > Update): the upload of a
// new xdesign file into the maintenance folder, its checks, the requests "Install and
// restart" and "Roll back to <version>" that the root helper carries out, its progress and
// result, and the kept releases. The website reaches it over the control socket
// (internal/control) after the owner's "Confirm it's you"; the helper trusts only its own
// socket. Copied from xWriter's internal/services/maintenance (helper.go, update_upload.go,
// update.go, update_check.go, update_unpack.go) and adapted: xWriter's apperr, Docker
// install, audit log, events and alerts became plain errors ([RefusalError]) and callbacks,
// and the check reads the build information of the new file from its symbol table
// (internal/release) instead of running it.
package maintenance

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/maintreq"
)

// RefusalKind is why a request of the website is refused.
type RefusalKind int

// Kinds of refusals; the control socket answers them with 400, 409 and 413.
const (
	// RefusedInvalid: a wrong request (a missing file, an invalid ID or version).
	RefusedInvalid RefusalKind = iota + 1
	// RefusedNotNow: a request that cannot run now (another request waits or runs, the
	// helper is off, the check expired).
	RefusedNotNow
	// RefusedTooLarge: an upload larger than an update, or than the free space.
	RefusedTooLarge
)

// RefusalError is a request of the website that the helper refuses, in plain words for the
// owner.
type RefusalError struct {
	Kind RefusalKind
	Text string
}

func (e *RefusalError) Error() string { return e.Text }

func refused(kind RefusalKind, format string, args ...any) error {
	return &RefusalError{Kind: kind, Text: fmt.Sprintf(format, args...)}
}

// States of the maintenance helper on this server (HelperState.State).
const (
	// HelperReady: xdesign-maintenance.path is installed and enabled (on Windows: the
	// service xdesign-maintenance exists and serve may start it), so requests are carried
	// out.
	HelperReady = "ready"
	// HelperOff: the units are installed but the path unit is not enabled, or masked (on
	// Windows: the service exists but serve may not start it).
	HelperOff = "off"
	// HelperMissing: this installation has no maintenance helper.
	HelperMissing = "missing"
	// HelperDevelopment: `xdesign serve --dev` has no root helper ("Works on a server.").
	HelperDevelopment = "development"
)

// HelperState is whether the helper can carry out requests, and why not.
type HelperState struct {
	State string `json:"state"`
	// Message says why the helper cannot carry out requests and how to fix it; empty when
	// it is ready.
	Message string `json:"message,omitempty"`
}

// Status is what serve knows about the helper's work: a request it has not taken yet, the
// step of the one it works on, and the result of the last one; and the build this process
// runs, which the website compares before and after an update.
type Status struct {
	Helper   HelperState        `json:"helper"`
	Pending  *maintreq.Request  `json:"pending"`
	Progress *maintreq.Progress `json:"progress"`
	Last     *maintreq.Result   `json:"last"`
	Running  Build              `json:"running"`
}

// Build is the build this process runs and when the process started.
type Build struct {
	Version string `json:"version"`
	Commit  string `json:"commit"`
	BuiltAt string `json:"built_at"`
	// Arch is the CPU architecture of the build, which is the server's.
	Arch string `json:"arch"`
	// SchemaFloor is the oldest release that reads the database this build's migrations
	// make.
	SchemaFloor string    `json:"schema_floor"`
	StartedAt   time.Time `json:"started_at"`
}

// Config configures the maintenance side of serve.
type Config struct {
	// DataDir is the data folder; the maintenance folder is <DataDir>/maintenance.
	DataDir string
	// Dev reports `serve --dev`, which has no root helper: files are checked, nothing is
	// installed.
	Dev bool
	// Build is the build this process runs.
	Build Build
	// Domain is the site's domain in config.toml, which a domain change starts from.
	Domain string
	// Listen and BasePath are the address and port the front serves on and the web base
	// path in config.toml, which an address change starts from.
	Listen   string
	BasePath string
	Log      *slog.Logger
}

// helper is serve's side of the root helper: it tells whether the helper is installed,
// writes the requests into the maintenance folder, one at a time, and reads the helper's
// progress and results. It is safe for concurrent use.
type helper struct {
	folder  string
	dev     bool
	version string
	running Build
	log     *slog.Logger
	// mu makes the checks and the write of a request one step in this process.
	mu sync.Mutex
}

// Status reads the request that waits, the progress of the request the helper works on
// and the last result. A request older than maintreq.RequestMaxAge does not count: the
// helper refuses it. Progress counts while no result has its ID and it is younger than
// maintreq.ProgressMaxAge; older progress was left by a helper that was killed.
func (h *helper) Status() (Status, error) {
	st := Status{Helper: h.State(), Running: h.running}
	req, err := h.pending()
	if err != nil {
		return st, err
	}
	if req != nil && time.Since(req.RequestedAt) <= maintreq.RequestMaxAge {
		st.Pending = req
	}
	if st.Last, err = readFile(h, maintreq.ResultFileName, maintreq.ParseResult); err != nil {
		return st, err
	}
	progress, err := readFile(h, maintreq.ProgressFileName, maintreq.ParseProgress)
	if err != nil {
		return st, err
	}
	if progress != nil && (st.Last == nil || st.Last.ID != progress.ID) && time.Since(progress.At) <= maintreq.ProgressMaxAge {
		st.Progress = progress
	}
	return st, nil
}

// Submit writes req, completed with a new ID, the time and this version, as the request
// file and returns it. It refuses while the helper is not on, and while another request
// waits or runs.
func (h *helper) Submit(ctx context.Context, req maintreq.Request) (maintreq.Request, error) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if s := h.State(); s.State != HelperReady {
		return maintreq.Request{}, refused(RefusedNotNow, "%s", s.Message)
	}
	st, err := h.Status()
	if err != nil {
		return maintreq.Request{}, err
	}
	switch {
	case st.Pending != nil:
		return maintreq.Request{}, refused(RefusedNotNow, "The server has not taken the %s asked for at %s yet. Wait for it to finish.",
			kindWords(st.Pending.Kind), st.Pending.RequestedAt.UTC().Format("15:04 UTC"))
	case st.Progress != nil:
		return maintreq.Request{}, refused(RefusedNotNow, "The server is busy with the %s (%s). Wait for it to finish.",
			kindWords(st.Progress.Kind), st.Progress.Title)
	}
	now := time.Now()
	req.ID, req.RequestedAt, req.PanelVersion = maintreq.NewID(), now.UTC(), h.version
	if err := req.Check(now); err != nil {
		return maintreq.Request{}, fmt.Errorf("build the maintenance request: %w", err)
	}
	if err := h.write(req); err != nil {
		return maintreq.Request{}, err
	}
	if err := h.start(ctx); err != nil {
		return maintreq.Request{}, err
	}
	h.log.InfoContext(ctx, "maintenance asked for", "request_id", req.ID, "kind", string(req.Kind))
	return req, nil
}

// kindWords names a kind of request for the owner.
func kindWords(k maintreq.Kind) string {
	switch k {
	case maintreq.KindUpdate:
		return "update"
	case maintreq.KindRollback:
		return "rollback"
	case maintreq.KindRestore:
		return "restore"
	case maintreq.KindDomain:
		return "domain change"
	case maintreq.KindAddress:
		return "address change"
	case maintreq.KindUninstall:
		return "uninstall"
	}
	return "maintenance task"
}

// write writes the request file, last and by an atomic rename, into the maintenance
// folder (mode 0700), which it creates when needed.
func (h *helper) write(req maintreq.Request) error {
	data, err := maintreq.Encode(req)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(h.folder, 0o700); err != nil {
		return fmt.Errorf("create the maintenance folder: %w", err)
	}
	tmp := h.path("." + maintreq.RequestFileName + ".partial")
	_ = os.Remove(tmp) // what a failed write left
	if err := writeSynced(tmp, data); err != nil {
		return err
	}
	if err := os.Rename(tmp, h.path(maintreq.RequestFileName)); err != nil {
		_ = os.Remove(tmp) // best effort: the error below is what matters
		return fmt.Errorf("write the maintenance request: %w", err)
	}
	return syncDir(h.folder)
}

// pending reads the request file; nil when there is none.
func (h *helper) pending() (*maintreq.Request, error) {
	data, err := os.ReadFile(h.path(maintreq.RequestFileName))
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read the maintenance request: %w", err)
	}
	req, err := maintreq.ParseRequest(data)
	if err != nil {
		// The helper refuses it too; a new request may replace it.
		h.log.Warn("the maintenance request cannot be read", "error", err)
		return nil, nil
	}
	return &req, nil
}

// path returns the file name of the maintenance folder.
func (h *helper) path(name string) string {
	return filepath.Join(h.folder, name)
}

// readFile reads and parses the file name of the maintenance folder; nil when it does
// not exist, or cannot be parsed (the helper writes the next one whole).
func readFile[T any](h *helper, name string, parse func([]byte) (T, error)) (*T, error) {
	data, err := os.ReadFile(h.path(name))
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", name, err)
	}
	v, err := parse(data)
	if err != nil {
		h.log.Warn("a file of the maintenance helper cannot be read", "file", name, "error", err)
		return nil, nil
	}
	return &v, nil
}

// writeSynced writes data to the new file p (mode 0600) and flushes it to disk.
func writeSynced(p string, data []byte) error {
	f, err := os.OpenFile(p, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600) //nolint:gosec // G304: a fixed name in the maintenance folder
	if err != nil {
		return fmt.Errorf("write %s: %w", filepath.Base(p), err)
	}
	_, err = f.Write(data)
	if err == nil {
		err = f.Sync()
	}
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		_ = os.Remove(p) // best effort: the error below is what matters
		return fmt.Errorf("write %s: %w", filepath.Base(p), err)
	}
	return nil
}
