package maintenance

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"net"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"sync"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
	"github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
	"github.com/Sir-MmD/xdesign/helper/internal/guard"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/install"
	"github.com/Sir-MmD/xdesign/helper/internal/maintreq"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// Maintenance > Update (section 6.2): the build this site runs, the upload and check of a
// new one, "Install and restart", the kept releases and "Roll back to <version>", copied
// from xWriter's services/maintenance/update.go. "Install and restart" asks the root
// helper to install the checked upload with xdesign update, which checks everything again
// as root; "Roll back to <version>" asks it to go back to a kept release with xdesign
// rollback, with the data of the backup made before that update when the owner asks or the
// database needs it.

const (
	// uploadTTL is how long a checked upload waits for "Install and restart", and how long
	// what an interrupted upload left stays.
	uploadTTL = 30 * time.Minute
	// requestedUploadAge is how long an upload stays once its update was asked for: the
	// helper refuses requests older than maintreq.RequestMaxAge, and copies the upload into
	// a folder of root's within seconds of taking one.
	requestedUploadAge = maintreq.RequestMaxAge + 10*time.Minute
	// heldMaxAge is the longest an upload or its check keeps PruneUploads and DiscardCheck
	// away. A hold older than that was left by a request that never ended.
	heldMaxAge = 2 * time.Hour
	// maxUploadsAtOnce bounds the uploads that arrive at the same time, so parallel
	// uploads cannot fill the disk past the free-space check each made alone.
	maxUploadsAtOnce = 2
	// uploadDiskMargin is the free space an upload leaves on the file system of the data
	// folder.
	uploadDiskMargin = 1 << 30
	// multipartSlack is what the form adds to its files: the boundaries, the headers of
	// the parts and the SHA-256 field.
	multipartSlack = 1 << 20
	// optMargin is the free space an update leaves under /opt besides the new release, and
	// releaseFactor the size of a release folder in sizes of its xdesign file (the file and
	// its payload unpacked), as xdesign update counts them.
	optMargin     = 100 << 20
	releaseFactor = 4
	// backupMargin is the free space the pre-update backup leaves in the data folder.
	backupMargin = 64 << 20
	// checkFileName is the record of a checked upload in its folder; the leading dot keeps
	// it apart from the uploaded files, whose names start with a letter or a digit.
	checkFileName = ".check.json"
	// releasesDir holds the kept releases, the folder the free space of a new release is
	// measured in.
	releasesDir = platform.ReleasesDir
)

// msgCheckExpired answers an update of a checked file that is gone: its time ended, the
// owner discarded it, or it was installed already.
const msgCheckExpired = "The checked file expired. Upload it again."

// Updates serves Maintenance > Update over the control socket. It is safe for concurrent
// use.
type Updates struct {
	h       *helper
	dataDir string
	dev     bool
	build   Build
	// domain is the site's domain, port its port and basePath its web base path (Config).
	domain   string
	port     int
	basePath string
	log      *slog.Logger
	fsys     host.FS
	machine  host.Machine

	mu    sync.Mutex
	holds map[string]*uploadHold
}

// uploadHold keeps PruneUploads and DiscardCheck away from an upload's folder (hold).
type uploadHold struct {
	since time.Time
	n     int
	// arriving reports that the upload's files are still arriving.
	arriving bool
}

// New returns the maintenance side of serve.
func New(cfg Config) *Updates {
	if cfg.Log == nil {
		cfg.Log = slog.New(slog.DiscardHandler)
	}
	log := cfg.Log.With("part", "maintenance")
	_, listenPort, _ := net.SplitHostPort(cfg.Listen) // config.Parse checked it
	port, _ := strconv.Atoi(listenPort)
	sys := host.OS()
	return &Updates{
		h:       &helper{folder: maintreq.Folder(cfg.DataDir), dev: cfg.Dev, version: cfg.Build.Version, running: cfg.Build, log: log},
		dataDir: cfg.DataDir, dev: cfg.Dev, build: cfg.Build, domain: cfg.Domain, port: port, basePath: cfg.BasePath, log: log,
		fsys: sys.FS, machine: sys.Machine, holds: map[string]*uploadHold{},
	}
}

// Status returns the helper's state and its work: a request it has not taken yet, the
// progress of the one it works on and the last result, with the build that runs.
func (u *Updates) Status() (Status, error) {
	u.PruneUploads()
	return u.h.Status()
}

// Whether a kept release can be gone back to (PreviousRelease.Rollback).
const (
	// RollbackAllowed: "Roll back to <version>" works and keeps the data, or puts back
	// the data from before the update when the owner asks and a backup is there.
	RollbackAllowed = "allowed"
	// RollbackNeedsRestore: the release cannot read the database of the running one, so
	// going back puts back the backup made before that update.
	RollbackNeedsRestore = "needs_restore"
	// RollbackMissing: the release is not on the server any more, its files cannot be
	// used, or the backup it needs is gone.
	RollbackMissing = "missing"
)

// Releases is GET /maintenance/releases: the "Go back" card.
type Releases struct {
	// KeepReleases is how many releases an update keeps.
	KeepReleases int `json:"keep_releases"`
	// Running is the version that runs; SchemaFloor the oldest release that reads its
	// database.
	Running     string `json:"running"`
	SchemaFloor string `json:"schema_floor"`
	// Previous are the releases "Roll back" can go back to, newest first.
	Previous []PreviousRelease `json:"previous"`
}

// PreviousRelease is a kept release older than the running one.
type PreviousRelease struct {
	Version string `json:"version"`
	// InstalledAt is when the release was last installed, from install.json; zero when
	// not known.
	InstalledAt time.Time `json:"installed_at"`
	// Rollback is RollbackAllowed, RollbackNeedsRestore or RollbackMissing.
	Rollback string `json:"rollback"`
	// Backup is the backup made before the update from this release, which "Also restore
	// the data from before the update" puts back; "" when there is none.
	Backup string `json:"backup,omitempty"`
	// Note says why going back is not possible; empty when it is.
	Note string `json:"note,omitempty"`
}

// Releases lists the kept releases older than the running one, with whether each can be
// gone back to: one at or above the running release's schema floor keeps the data (or
// takes the data of its pre-update backup when the owner asks); one below needs that
// backup. serve --dev has no kept releases.
func (u *Updates) Releases() (Releases, error) {
	out := Releases{KeepReleases: install.KeepReleases, Running: u.build.Version, SchemaFloor: u.build.SchemaFloor,
		Previous: []PreviousRelease{}}
	if u.dev {
		return out, nil
	}
	st, _, err := install.ReadState(u.fsys)
	if err != nil {
		u.log.Warn("install.json cannot be read", "error", err)
		st = install.State{}
	}
	rels, skipped, err := install.KeptReleases(u.fsys)
	if err != nil {
		return out, err
	}
	cur := u.build.Version
	for _, r := range rels {
		if !goesBack(r.Version, cur) {
			continue
		}
		p := PreviousRelease{Version: r.Version, InstalledAt: installedAt(st, r.Version), Rollback: RollbackAllowed}
		if e, _, err := install.PreUpdateBackup(r.Version); err == nil {
			p.Backup = e.Name
		}
		switch below := belowFloor(r.Version, u.build.SchemaFloor); {
		case r.Info.Arch != u.build.Arch:
			p.Rollback = RollbackMissing
			p.Note = fmt.Sprintf("The folder of xDesign %s holds the %s build, but this server is %s.", r.Version, r.Info.Arch, u.build.Arch)
		case below && p.Backup == "":
			p.Rollback = RollbackMissing
			p.Note = fmt.Sprintf("Going back below %s needs the backup made before that update, and it is not kept any more.",
				u.build.SchemaFloor)
		case below:
			p.Rollback = RollbackNeedsRestore
			p.Note = fmt.Sprintf("xDesign %s cannot read the database of %s: going back puts back the data from before the update.",
				r.Version, cur)
		}
		out.Previous = append(out.Previous, p)
	}
	for _, name := range skipped {
		if goesBack(name, cur) {
			out.Previous = append(out.Previous, PreviousRelease{Version: name, InstalledAt: installedAt(st, name), Rollback: RollbackMissing,
				Note: fmt.Sprintf("The files of xDesign %s in %s cannot be used, so the website cannot go back to it.", name, releasesDir)})
		}
	}
	return out, nil
}

// goesBack reports whether xdesign rollback takes the release v while cur runs: another
// version that is not newer.
func goesBack(v, cur string) bool {
	if v == cur {
		return false
	}
	c, err := buildinfo.CompareVersions(v, cur)
	return err == nil && c <= 0
}

// belowFloor reports whether the release v cannot read a database whose schema floor is
// floor.
func belowFloor(v, floor string) bool {
	if floor == "" || !isReleaseVersion(v) {
		return false
	}
	c, err := buildinfo.CompareVersions(v, floor)
	return err == nil && c < 0
}

// installedAt returns when the version v was last installed, updated to, gone back to or
// repaired, from the history of install.json; zero when it does not say.
func installedAt(st install.State, v string) time.Time {
	for _, h := range slices.Backward(st.History) {
		if h.Version == v && h.Installs() {
			t, err := time.Parse(time.RFC3339, h.At)
			if err != nil {
				return time.Time{}
			}
			return t.UTC()
		}
	}
	return time.Time{}
}

// Check returns the check of the upload id (GET /maintenance/uploads/<id>).
func (u *Updates) Check(id string) (UpdateCheck, error) {
	if !maintreq.ValidID(id) {
		return UpdateCheck{}, refused(RefusedInvalid, "This is not the ID of a checked file.")
	}
	rec, err := readCheckRecord(u.uploadDir(id))
	if errors.Is(err, fs.ErrNotExist) {
		return UpdateCheck{}, refused(RefusedNotNow, msgCheckExpired)
	}
	return rec.Check, err
}

// StartUpdate asks the root helper to install the checked upload with xdesign update
// ("Install and restart"): it refuses while the helper cannot take it, and an upload
// whose check expired, was installed already or was made while another version ran; then
// it writes the request with the build that answers now.
func (u *Updates) StartUpdate(ctx context.Context, uploadID string) (maintreq.Request, error) {
	if !maintreq.ValidID(uploadID) {
		return maintreq.Request{}, refused(RefusedInvalid, "This is not the ID of a checked file.")
	}
	release := u.hold(uploadID, false)
	defer release()
	dir := u.uploadDir(uploadID)
	rec, err := readCheckRecord(dir)
	switch {
	case errors.Is(err, fs.ErrNotExist):
		return maintreq.Request{}, refused(RefusedNotNow, msgCheckExpired)
	case err != nil:
		return maintreq.Request{}, err
	case rec.RequestedAt != nil:
		return maintreq.Request{}, refused(RefusedNotNow, "This file was sent to the server already. Upload it again to install it again.")
	case time.Since(rec.CheckedAt) > uploadTTL:
		return maintreq.Request{}, refused(RefusedNotNow, msgCheckExpired)
	case rec.Check.FromVersion != u.build.Version:
		return maintreq.Request{}, refused(RefusedNotNow, "The file was checked while xDesign %s ran, and %s runs now. Upload it again.",
			rec.Check.FromVersion, u.build.Version)
	}
	up := &maintreq.UpdateRequest{Upload: uploadID, File: rec.Check.File, SHA256: rec.Check.SHA256}
	if rec.Sums {
		up.Sums = maintreq.SumsFileName
	}
	if rec.Sig {
		up.Sig = maintreq.SigFileName
	}
	written, err := u.h.Submit(ctx, maintreq.Request{Kind: maintreq.KindUpdate, FromBuild: u.fromBuild(), Update: up})
	if err != nil {
		return maintreq.Request{}, err
	}
	at := time.Now().UTC()
	rec.RequestedAt, rec.RequestID = &at, written.ID
	if err := writeCheckRecord(dir, rec); err != nil {
		// The request is written; the upload then counts from its check, which is enough
		// for the helper, who takes requests within seconds.
		u.log.WarnContext(ctx, "the checked upload could not be marked as sent", "upload_id", uploadID, "error", err)
	}
	return written, nil
}

// StartRollback asks the root helper to go back to the kept release to with xdesign
// rollback ("Roll back to <version>"), with the data from before the update when
// restoreData is set: it refuses a release the website cannot go back to (not kept, newer,
// the running one, below the schema floor without its backup).
func (u *Updates) StartRollback(ctx context.Context, to string, restoreData bool) (maintreq.Request, error) {
	if _, err := buildinfo.ParseVersion(to); err != nil || len(to) > 64 {
		return maintreq.Request{}, refused(RefusedInvalid, "Choose a version such as 1.0.0.")
	}
	cur := u.build.Version
	switch {
	case to == cur:
		return maintreq.Request{}, refused(RefusedNotNow, "xDesign %s runs already.", to)
	case !goesBack(to, cur):
		return maintreq.Request{}, refused(RefusedNotNow, "xDesign %s is newer than the running %s: going forward is an update. "+
			"Upload its file above.", to, cur)
	}
	rels, err := u.Releases()
	if err != nil {
		return maintreq.Request{}, err
	}
	i := slices.IndexFunc(rels.Previous, func(p PreviousRelease) bool { return p.Version == to })
	switch {
	case i < 0:
		return maintreq.Request{}, refused(RefusedNotNow, "xDesign %s is not kept on this server: xDesign keeps the last %d versions.",
			to, install.KeepReleases)
	case rels.Previous[i].Rollback == RollbackMissing:
		return maintreq.Request{}, refused(RefusedNotNow, "%s", rels.Previous[i].Note)
	case rels.Previous[i].Rollback == RollbackNeedsRestore:
		restoreData = true
	case restoreData && rels.Previous[i].Backup == "":
		return maintreq.Request{}, refused(RefusedNotNow, "There is no backup from before the update from xDesign %s, so its data "+
			"cannot be put back.", to)
	}
	req := maintreq.Request{Kind: maintreq.KindRollback, FromBuild: u.fromBuild(),
		Rollback: &maintreq.RollbackRequest{To: to, RestoreDB: restoreData}}
	return u.h.Submit(ctx, req)
}

// GoBack asks the root helper to go back to the release before an update whose new release
// does not serve (the start-count guard's Options.GoBack).
func (u *Updates) GoBack(ctx context.Context, m guard.Marker) error {
	req := maintreq.Request{Kind: maintreq.KindRollback, FromBuild: u.fromBuild(),
		Rollback: &maintreq.RollbackRequest{To: m.From, RestoreDB: m.RestoreDB, Guard: true}}
	_, err := u.h.Submit(ctx, req)
	return err
}

// fromBuild is the build that answers now, which an update or a rollback request records
// and the helper copies into its progress.
func (u *Updates) fromBuild() *maintreq.Build {
	b := u.build
	return &maintreq.Build{Version: b.Version, Commit: b.Commit, BuiltAt: b.BuiltAt, StartedAt: b.StartedAt.UTC()}
}

// PruneUploads removes the uploads whose time ended: a checked upload uploadTTL after its
// check, one whose update was asked for requestedUploadAge after the request, and what an
// interrupted upload left uploadTTL after it last changed. An upload that arrives or is
// checked (hold) stays, and so does the one a pending request names. A new upload and the
// status run it.
func (u *Updates) PruneUploads() {
	root := u.uploadsDir()
	entries, err := os.ReadDir(root)
	if err != nil {
		return
	}
	pending, _ := u.h.pending()
	for _, e := range entries {
		id := e.Name()
		p := filepath.Join(root, id)
		if !e.IsDir() || !maintreq.ValidID(id) {
			// Nothing serve writes; whatever it is goes.
			if err := os.RemoveAll(p); err != nil {
				u.log.Warn("remove a stray entry of the update uploads", "entry", id, "error", err)
			}
			continue
		}
		if u.held(id) || (pending != nil && pending.Update != nil && pending.Update.Upload == id &&
			time.Since(pending.RequestedAt) <= maintreq.RequestMaxAge) {
			continue
		}
		if !u.expired(p) {
			continue
		}
		if err := os.RemoveAll(p); err != nil {
			u.log.Warn("remove an old update upload", "upload_id", id, "error", err)
			continue
		}
		u.log.Info("removed an update upload whose time ended", "upload_id", id)
	}
}

// expired reports whether the upload in dir can go.
func (u *Updates) expired(dir string) bool {
	rec, err := readCheckRecord(dir)
	switch {
	case err == nil && rec.RequestedAt != nil:
		return time.Since(*rec.RequestedAt) > requestedUploadAge
	case err == nil:
		return time.Since(rec.CheckedAt) > uploadTTL
	}
	fi, err := os.Stat(dir)
	return err != nil || time.Since(fi.ModTime()) > uploadTTL
}

// DiscardCheck removes a checked upload at once: the owner chose another file or left the
// page. An upload that is gone already is no error. It refuses while the upload arrives
// or is checked, and once its update was asked for.
func (u *Updates) DiscardCheck(id string) error {
	if !maintreq.ValidID(id) {
		return refused(RefusedInvalid, "This is not the ID of a checked file.")
	}
	if u.held(id) {
		return refused(RefusedNotNow, "This file is still being uploaded or checked.")
	}
	dir := u.uploadDir(id)
	if _, err := os.Lstat(dir); errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if rec, err := readCheckRecord(dir); err == nil && rec.RequestedAt != nil {
		return refused(RefusedNotNow, "This file was sent to the server to be installed; it is removed by itself later.")
	}
	if err := os.RemoveAll(dir); err != nil {
		return fmt.Errorf("remove the checked file: %w", err)
	}
	u.log.Info("checked update file discarded", "upload_id", id)
	return nil
}

// uploadsDir is <data dir>/maintenance/uploads.
func (u *Updates) uploadsDir() string {
	return filepath.Join(maintreq.Folder(u.dataDir), maintreq.UploadsFolderName)
}

// uploadDir is the folder of the upload id.
func (u *Updates) uploadDir(id string) string {
	return filepath.Join(u.uploadsDir(), id)
}

// hold keeps PruneUploads and DiscardCheck away from the upload id while it arrives
// (arriving), is checked, or its update is asked for. The returned function ends the
// hold; calling it again does nothing.
func (u *Updates) hold(id string, arriving bool) func() {
	u.mu.Lock()
	h := u.holds[id]
	if h == nil {
		h = &uploadHold{since: time.Now()}
		u.holds[id] = h
	}
	h.n++
	h.arriving = h.arriving || arriving
	u.mu.Unlock()
	var once sync.Once
	return func() {
		once.Do(func() {
			u.mu.Lock()
			defer u.mu.Unlock()
			if h.n--; h.n <= 0 && u.holds[id] == h {
				delete(u.holds, id)
			}
		})
	}
}

// held reports whether the upload id is held, for at most heldMaxAge.
func (u *Updates) held(id string) bool {
	u.mu.Lock()
	defer u.mu.Unlock()
	h := u.holds[id]
	return h != nil && time.Since(h.since) < heldMaxAge
}

// arriving counts the uploads whose files are still arriving.
func (u *Updates) arriving() int {
	u.mu.Lock()
	defer u.mu.Unlock()
	n := 0
	for _, h := range u.holds {
		if h.arriving && time.Since(h.since) < heldMaxAge {
			n++
		}
	}
	return n
}

// checkRecord is .check.json: what the check of an upload found, for StartUpdate.
type checkRecord struct {
	Check     UpdateCheck `json:"check"`
	Sums      bool        `json:"sums"`
	Sig       bool        `json:"sig"`
	CheckedAt time.Time   `json:"checked_at"`
	// RequestedAt and RequestID are set once the update of the upload was asked for.
	RequestedAt *time.Time `json:"requested_at,omitempty"`
	RequestID   string     `json:"request_id,omitempty"`
}

// readCheckRecord reads the check record of the upload in dir; fs.ErrNotExist when the
// upload was not checked (or is gone).
func readCheckRecord(dir string) (checkRecord, error) {
	var rec checkRecord
	data, err := os.ReadFile(filepath.Join(dir, checkFileName)) //nolint:gosec // G304: a fixed name in an upload folder
	if err != nil {
		return rec, fmt.Errorf("read the check of the upload: %w", err)
	}
	if err := json.Unmarshal(data, &rec); err != nil {
		return rec, fmt.Errorf("read the check of the upload: %w", err)
	}
	return rec, nil
}

// writeCheckRecord writes the check record of the upload in dir (mode 0600), through a
// temporary file and a rename.
func writeCheckRecord(dir string, rec checkRecord) error {
	data, err := json.MarshalIndent(rec, "", "  ")
	if err != nil {
		return fmt.Errorf("encode the check of the upload: %w", err)
	}
	tmp := filepath.Join(dir, checkFileName+".partial")
	_ = os.Remove(tmp) // what a failed write left
	if err := writeSynced(tmp, append(data, '\n')); err != nil {
		return err
	}
	if err := os.Rename(tmp, filepath.Join(dir, checkFileName)); err != nil {
		_ = os.Remove(tmp) // best effort: the error below is what matters
		return fmt.Errorf("write the check of the upload: %w", err)
	}
	return nil
}

// freeSpaceOf returns the space free for this process's user in the file system of dir,
// or of its nearest existing parent.
func freeSpaceOf(dir string) (int64, error) {
	for {
		space, err := platform.DiskSpace(dir)
		if err == nil {
			return int64(min(space.Free, 1<<62)), nil // capped below 2^62
		}
		parent := filepath.Dir(dir)
		if !errors.Is(err, fs.ErrNotExist) || parent == dir {
			return 0, err // "statfs <dir>: ..."
		}
		dir = parent
	}
}

// siteSize is the size of the database and the media of dataDir, which the pre-update
// backup holds at most; what cannot be read counts nothing.
func siteSize(dataDir string) int64 {
	var total int64
	if fi, err := os.Stat(filepath.Join(dataDir, "xdesign.db")); err == nil {
		total += fi.Size()
	}
	_ = filepath.WalkDir(filepath.Join(dataDir, "media"), func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil //nolint:nilerr // an unreadable part counts nothing; the backup itself says more
		}
		if fi, err := d.Info(); err == nil && fi.Mode().IsRegular() {
			total += fi.Size()
		}
		return nil
	})
	return total
}

// formatBytes is a size for the owner.
func formatBytes(n int64) string {
	return backup.FormatBytes(n)
}
