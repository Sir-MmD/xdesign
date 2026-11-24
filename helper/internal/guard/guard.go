// Package guard is the second safety net of an update (docs/plan/07-server-install-update.md
// section 6.3): the start-count guard of xmtp-panel's self-update
// (internal/panel/selfupdate/guard.go), copied and adapted to xDesign's release folders.
//
// The way back from an update whose new release does not start is the update's own
// health check (internal/install's second stage), which puts the old release back by
// itself. When that check never ends (the server lost power, the root helper was killed),
// the guard does it:
//
//   - The second stage writes a marker into the data folder (MarkerName) before it
//     switches /opt/xdesign/current: the version it replaces and the one it installs, the
//     SHA-256 of each xdesign file, a deadline Grace on, the time until which the second
//     stage watches the start itself, whether going back needs the backup made before the
//     update, and the starts so far.
//   - Every start of xdesign serve calls StartGuard first. When the marker is about the
//     running file, the start is counted in it: once the second stage no longer watches,
//     the start after MaxUnconfirmedStarts of them, or one past the deadline, asks the
//     root helper to go back to the old release (Options.GoBack: a rollback request in
//     the maintenance folder), and serve exits; xdesign-maintenance.service then stops
//     xdesign.service, puts the old release back and starts it.
//   - Guard.Watch asks the same at the deadline of a serve that runs but does not serve by
//     then, and stops it (Options.Stop).
//   - Guard.Confirm, called once the front serves and the app answers, removes the marker:
//     the update stands.
//
// serve runs as the xdesign user, which cannot change /opt/xdesign, so the guard never
// switches the release itself: the root helper does, as for a rollback asked for in
// Maintenance. The marker belongs to the xdesign user (mode 0600), so serve can count its
// starts in it; the second stage writes and removes it as root without following a link.
package guard

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// Guard settings.
const (
	// MarkerName is the update marker, in the data folder (/var/lib/xdesign) on Linux and
	// beside it on Windows (C:\ProgramData\xDesign): see Dir.
	MarkerName = "update-guard.json"
	// MaxUnconfirmedStarts is how many starts a new release gets to serve; the next start
	// goes back.
	MaxUnconfirmedStarts = 3
	// Grace is how long a new release has to serve, from the switch (or from its first
	// start, when that came later).
	Grace = 10 * time.Minute
)

// ErrWentBack is StartGuard's error when it asked for the old release: serve must exit,
// and the root helper puts the old release back.
var ErrWentBack = errors.New("the update did not start, so xDesign goes back to the release before it")

// Marker is the JSON layout of the update marker.
type Marker struct {
	// From is the version the update replaced, To the version it installed.
	From string `json:"from"`
	To   string `json:"to"`
	// SHA256 is the installed release's xdesign file, OldSHA256 the old release's.
	SHA256    string `json:"sha256"`
	OldSHA256 string `json:"old_sha256"`
	// Deadline is by when the installed release must serve.
	Deadline time.Time `json:"deadline"`
	// WatchedUntil is until when the update's second stage watches the start itself; the
	// guard leaves the way back to it until then.
	WatchedUntil time.Time `json:"watched_until"`
	// RestoreDB reports that the new release's migrations changed the database below what
	// From reads: going back puts the backup made before the update back too.
	RestoreDB bool `json:"restore_db,omitempty"`
	// Starts counts the starts of the installed release so far, none of which has served
	// yet.
	Starts int `json:"starts"`
	// Asked reports that the guard asked the root helper to go back.
	Asked bool `json:"asked,omitempty"`
}

// Options configure StartGuard.
type Options struct {
	// DataDir is the data folder that holds the marker.
	DataDir string
	// Executable is the running xdesign file. Default: the running executable (links
	// resolved).
	Executable string
	// GoBack asks the root helper to go back to the release of the marker's From (a
	// rollback request in the maintenance folder).
	GoBack func(m Marker) error
	// Stop ends serve once Watch asked to go back: the root helper then stops the service
	// and starts the old release.
	Stop func(err error)
	Log  *slog.Logger
}

// Guard watches over a start of a release that an update just installed. Its methods are
// safe for concurrent use, and do nothing on a nil *Guard (no update to watch over).
type Guard struct {
	opts Options
	log  *slog.Logger

	mu     sync.Mutex
	marker Marker
	done   bool // confirmed, or gone back: nothing left to do
	timer  *time.Timer
}

// StartGuard is serve's first act on every start, before anything that can fail. It
// returns:
//
//   - nil, nil when there is no update to watch over: no marker, or one about another
//     file than the running one, which it drops.
//   - a guard, nil when this file is the one an update installed, and this start is
//     within MaxUnconfirmedStarts and the deadline, or the second stage still watches:
//     call Watch, and Confirm once the front serves and the app answers.
//   - nil, an error wrapping ErrWentBack when this start is one too many, or past the
//     deadline: the root helper was asked to go back. serve must exit.
//
// Problems on the way (an unreadable marker, a request the root helper does not take
// now) are logged and let serve run, or exit to be counted again at the next start.
func StartGuard(opts Options) (*Guard, error) {
	g := &Guard{opts: opts, log: opts.Log}
	if g.log == nil {
		g.log = slog.New(slog.DiscardHandler)
	}
	if g.opts.Executable == "" {
		exe, err := runningExecutable()
		if err != nil {
			g.log.Warn("update guard: the running file cannot be found, so no update is watched over", "error", err)
			return nil, nil
		}
		g.opts.Executable = exe
	}
	m, found, err := ReadMarker(opts.DataDir)
	if err != nil {
		g.log.Warn("update guard: the update marker is unreadable; dropping it", "error", err)
		g.drop()
		return nil, nil
	}
	if !found {
		return nil, nil
	}
	if !g.isUpdated(m) {
		g.drop()
		return nil, nil
	}
	now := time.Now()
	m.Starts++
	if d := now.Add(Grace); m.Starts == 1 && d.After(m.Deadline) {
		m.Deadline = d.UTC()
	}
	if err := writeMarker(opts.DataDir, m, nil); err != nil {
		g.log.Warn("update guard: this start cannot be counted in the update marker", "error", err)
	}
	g.marker = m
	if now.Before(m.WatchedUntil) {
		g.log.Info("update guard: the update watches this start of a new release itself", "version", m.To, "from", m.From,
			"start", m.Starts, "watched_until", m.WatchedUntil.Format(time.RFC3339))
		return g, nil
	}
	detail := ""
	switch {
	case m.Starts > MaxUnconfirmedStarts:
		detail = fmt.Sprintf("it started %d times without serving", m.Starts-1)
	case !now.Before(m.Deadline):
		detail = "its deadline passed without it serving"
	}
	if detail != "" {
		g.goBack(detail)
		return nil, fmt.Errorf("%w (%s, %s): %s", ErrWentBack, m.To, m.From, detail)
	}
	g.log.Info("update guard: running a freshly installed release; it goes back unless it serves",
		"version", m.To, "from", m.From, "start", m.Starts, "of", MaxUnconfirmedStarts, "deadline", m.Deadline.Format(time.RFC3339))
	return g, nil
}

// isUpdated reports whether the marker is about the running file, by its SHA-256. When the
// running file cannot be read, it assumes so: going back only returns to the release before,
// which the root helper checks before it puts it back.
func (g *Guard) isUpdated(m Marker) bool {
	sum, err := fileSHA256(g.opts.Executable)
	switch {
	case err != nil:
		g.log.Warn("update guard: the running file cannot be read; assuming the update marker is about it", "error", err)
		return true
	case strings.EqualFold(sum, m.SHA256):
		return true
	case strings.EqualFold(sum, m.OldSHA256):
		g.log.Info("update guard: the release the update replaced runs again; dropping the update marker", "update", m.To, "running", m.From)
	default:
		g.log.Info("update guard: the update marker is about another release; dropping it", "update", m.To)
	}
	return false
}

// drop removes the marker, logging a failure.
func (g *Guard) drop() {
	if err := Disarm(g.opts.DataDir); err != nil {
		g.log.Warn("update guard: clear the update marker", "error", err)
	}
}

// goBack asks the root helper for the old release once, and records it in the marker.
func (g *Guard) goBack(detail string) {
	m := g.marker
	g.log.Error("update guard: going back to the release before the update", "version", m.To, "to", m.From, "why", detail)
	if m.Asked {
		return
	}
	if g.opts.GoBack == nil {
		g.log.Error("update guard: this serve cannot ask " + helperWords + "; go back on the server with " + rollbackWords)
		return
	}
	if err := g.opts.GoBack(m); err != nil {
		g.log.Error("update guard: "+helperWords+" could not be asked to go back; the next start asks again", "error", err)
		return
	}
	m.Asked = true
	if err := writeMarker(g.opts.DataDir, m, nil); err != nil {
		g.log.Warn("update guard: the update marker cannot record the request", "error", err)
	}
}

// Watch asks to go back when the deadline passes before Confirm: a release that runs but
// does not serve by then. It then stops serve (Options.Stop). Watch returns at once;
// calling it again does nothing.
func (g *Guard) Watch() {
	if g == nil {
		return
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.done || g.timer != nil {
		return
	}
	g.timer = time.AfterFunc(time.Until(g.marker.Deadline), g.expire)
}

// expire is Watch's timer: the deadline passed without Confirm.
func (g *Guard) expire() {
	g.mu.Lock()
	if g.done {
		g.mu.Unlock()
		return
	}
	g.done = true // Confirm is a no-op from here on
	g.mu.Unlock()
	g.goBack("it did not serve by its deadline")
	if g.opts.Stop != nil {
		g.opts.Stop(fmt.Errorf("%w (%s, %s): it did not serve by its deadline", ErrWentBack, g.marker.To, g.marker.From))
	}
}

// Confirm records that the new release serves: the marker is removed and the update
// stands. It returns an error only when the marker could not be removed (the guard still
// stands down in this process).
func (g *Guard) Confirm() error {
	if g == nil {
		return nil
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.done {
		return nil
	}
	g.done = true
	if g.timer != nil {
		g.timer.Stop()
	}
	if err := Disarm(g.opts.DataDir); err != nil {
		return fmt.Errorf("update guard: clear the update marker: %w", err)
	}
	g.log.Info("update confirmed: the new release serves", "version", g.marker.To, "from", g.marker.From, "starts", g.marker.Starts)
	return nil
}

// Owner is the numeric owner of the marker that root writes for the service user.
type Owner struct {
	UID, GID int
}

// Path is the marker of the data folder dataDir: /var/lib/xdesign/update-guard.json, or
// C:\ProgramData\xDesign\update-guard.json on Windows.
func Path(dataDir string) string {
	return filepath.Join(Dir(dataDir), MarkerName)
}

// Arm writes the marker m for the data folder dataDir for the service user owner (on
// Windows the service's account, whatever owner says): the second stage of an update does
// it as root or LocalSystem before the switch. The file is written under a new name and
// renamed over the marker, never through a link.
func Arm(dataDir string, m Marker, owner Owner) error {
	return writeMarker(dataDir, m, &owner)
}

// Disarm removes the marker of dataDir; a missing one is fine. Removing a link removes the
// link itself.
func Disarm(dataDir string) error {
	return removeFile(Dir(dataDir), MarkerName)
}

// ReadMarker reads the marker in dataDir without following a link; found is false when
// there is none.
func ReadMarker(dataDir string) (m Marker, found bool, err error) {
	f, err := os.OpenFile(Path(dataDir), os.O_RDONLY|noFollow, 0)
	if errors.Is(err, fs.ErrNotExist) {
		return Marker{}, false, nil
	}
	if err != nil {
		return Marker{}, false, fmt.Errorf("read the update marker: %w", err)
	}
	defer func() { _ = f.Close() }() // read-only: closing cannot lose data
	if err := platform.RefuseLink(f); err != nil {
		return Marker{}, false, fmt.Errorf("read the update marker: %w", err)
	}
	data, err := io.ReadAll(io.LimitReader(f, maxMarker))
	if err != nil {
		return Marker{}, false, fmt.Errorf("read the update marker: %w", err)
	}
	if err := json.Unmarshal(data, &m); err != nil {
		return Marker{}, false, fmt.Errorf("read the update marker: %w", err)
	}
	return m, true, nil
}

// maxMarker bounds what is read of a marker.
const maxMarker = 64 << 10

// noFollow refuses a link in the marker's place instead of following it.
const noFollow = platform.NoFollow

// runningExecutable is the running executable, links resolved.
func runningExecutable() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("find the running file: %w", err)
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	return exe, nil
}

// writeMarker durably replaces the marker of the data folder dataDir with m: a new file
// next to it, synced, given to owner when owner is set, renamed over it, and the folder
// synced.
func writeMarker(dataDir string, m Marker, owner *Owner) error {
	dir := Dir(dataDir)
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return fmt.Errorf("encode the update marker: %w", err)
	}
	tmp, err := os.CreateTemp(dir, ".tmp-"+MarkerName+"-*")
	if err != nil {
		return fmt.Errorf("write the update marker: %w", err)
	}
	tmpName := tmp.Name()
	defer func() { _ = os.Remove(tmpName) }() // gone after the rename
	_, err = tmp.Write(data)
	if err == nil && owner != nil {
		err = giveTo(tmp, *owner)
	}
	if err == nil {
		err = tmp.Sync()
	}
	if cerr := tmp.Close(); err == nil {
		err = cerr
	}
	if err == nil {
		err = os.Rename(tmpName, filepath.Join(dir, MarkerName))
	}
	if err != nil {
		return fmt.Errorf("write the update marker: %w", err)
	}
	return syncDir(dir)
}

// removeFile durably removes the file name in dir; a missing one is fine.
func removeFile(dir, name string) error {
	if err := os.Remove(filepath.Join(dir, name)); err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil
		}
		return fmt.Errorf("remove %s: %w", name, err)
	}
	return syncDir(dir)
}

// FileSHA256 is the hex SHA-256 of a file's content (the second stage hashes the old and
// the new xdesign file with it).
func FileSHA256(path string) (string, error) {
	return fileSHA256(path)
}

// fileSHA256 is the hex SHA-256 of a file's content.
func fileSHA256(path string) (string, error) {
	f, err := os.Open(path) //nolint:gosec // G304: an xdesign file of a release
	if err != nil {
		return "", fmt.Errorf("read %s: %w", path, err)
	}
	defer func() { _ = f.Close() }() // read-only: closing cannot lose data
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", fmt.Errorf("read %s: %w", path, err)
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
