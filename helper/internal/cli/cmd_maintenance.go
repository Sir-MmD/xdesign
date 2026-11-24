package cli

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/install"
	"github.com/Sir-MmD/xdesign/helper/internal/maintreq"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// The root helper of the maintenance asked for in the website
// (docs/plan/07-server-install-update.md section 6), copied from xWriter's
// cmd_maintenance.go and maintenance_kinds.go and cut to the update and the rollback, with
// the restore of a backup (section 5.4), the domain change of Settings > HTTPS (section 4)
// and the address change of Settings > Site address
// (docs/plan/17-second-owner-list-2026-11-23.md section 6) added:
// xdesign-maintenance.path starts xdesign-maintenance.service when serve writes the
// request file, and the unit runs `xdesign admin maintenance --request
// /var/lib/xdesign/maintenance/request.json` as root.
//
// The service user owns the maintenance folder, so nothing in it is trusted. The helper
// takes exactly that request path; it opens the folder, the request and each uploaded file
// once, without following links and relative to the folder's descriptor, and checks each
// on its open descriptor: a folder or a regular file of the xdesign user within its size
// limit (ownedDir). The request is claimed (deleted) once read, also when it is refused,
// so the path unit never starts the helper twice for it; it must be at most an hour old
// and of this file's version, and only the kinds of maintreq pass. An update's upload is
// copied into a folder of root's and its SHA-256 checked again, and xdesign update checks
// the copy as it checks any file; a restore copies the backup's archive into a folder of
// root's the same way and restores the copy. The update, the rollback, the domain change
// and the address change run in this process with
// their output in unlinked files of root's, never a pipe, and SIGPIPE ignored, so nothing
// that goes away can stop them halfway. The uninstall of Maintenance > Uninstall xDesign
// (docs/plan/19-uninstall-2026-11-24.md section 5) does not: it stops and removes this
// helper too, so it runs detached from it, and the request is done once it started. The
// helper writes its progress and its result through the folder's descriptor, owned by the
// xdesign user (mode 0600), for the website.

// RunMaintenance is `xdesign admin maintenance --request FILE`.
func RunMaintenance(ctx context.Context, env *Env, args []string) int {
	fs := flag.NewFlagSet("xdesign admin maintenance", flag.ContinueOnError)
	fs.SetOutput(env.Stderr)
	fs.Usage = func() { fmt.Fprint(env.Stderr, maintenanceUsage) }
	requestFile := fs.String("request", "", "")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return ExitOK
		}
		return ExitUsage
	}
	switch {
	case fs.NArg() > 0:
		fmt.Fprintf(env.Stderr, "xdesign admin maintenance: unexpected argument %q\n", fs.Arg(0))
		return ExitUsage
	case *requestFile == "":
		fmt.Fprintln(env.Stderr, "xdesign admin maintenance: --request names the request file")
		return ExitUsage
	}
	if !maintenanceAllowed(env) {
		fmt.Fprintln(env.Stderr, "xdesign admin maintenance: "+maintenanceRefused)
		return ExitError
	}
	// A journal stream that went away must never kill the helper halfway through an
	// update: with SIGPIPE ignored, a write to it only fails.
	signal.Ignore(syscall.SIGPIPE)
	res, err := maintenance(ctx, env, *requestFile)
	if err != nil {
		fmt.Fprintf(env.Stderr, "xdesign admin maintenance: %v\n", err)
		return ExitError
	}
	fmt.Fprintln(env.Stdout, res.Message)
	if !res.OK {
		return ExitError
	}
	return ExitOK
}

// maintenanceRun is one request the helper carries out.
type maintenanceRun struct {
	env *Env
	// dir is the maintenance folder, opened once.
	dir *ownedDir
	// owner is the xdesign user, who owns the progress and result files.
	owner host.Owner
	// cfg is the site's settings when the request was taken.
	cfg *config.Config
	req maintreq.Request
	// afterResult runs once a result that says OK is written: the start of the uninstaller,
	// which stops this helper, so the result has to be there before. When it fails, it
	// returns the result to write instead.
	afterResult func() *maintreq.Result
}

// maintenance claims, checks and carries out the request in requestFile. A request
// refused after its ID was read, and the outcome of one carried out, end up in the result
// file; an error means not even that could be written.
func maintenance(ctx context.Context, env *Env, requestFile string) (maintreq.Result, error) {
	cfg, err := config.Load(config.DefaultPath)
	if err != nil {
		return maintreq.Result{}, err
	}
	folder := maintreq.Folder(cfg.DataDir)
	if want := filepath.Join(folder, maintreq.RequestFileName); filepath.Clean(requestFile) != want {
		return maintreq.Result{}, fmt.Errorf("the maintenance request must be %s", want)
	}
	dir, owner, err := openMaintenanceDir(env, folder)
	if err != nil {
		return maintreq.Result{}, err
	}
	defer func() { _ = dir.Close() }() // a folder opened for reading
	m := &maintenanceRun{env: env, dir: dir, owner: owner, cfg: cfg}
	data, err := readOwnedFile(dir, maintreq.RequestFileName, maintreq.MaxFileSize)
	// The entry goes at once, also when it is refused, so the path unit never starts the
	// helper twice for it, whatever happens next.
	if rerr := dir.remove(maintreq.RequestFileName); rerr != nil && err == nil {
		err = fmt.Errorf("remove the maintenance request: %w", rerr)
	}
	if err != nil {
		return maintreq.Result{}, fmt.Errorf("read the maintenance request: %w", err)
	}
	req, err := maintreq.ParseRequest(data)
	if err == nil {
		err = req.Check(time.Now())
	}
	if err == nil && req.PanelVersion != env.Build.Version {
		err = fmt.Errorf("the request was made by xDesign %s, but xDesign %s runs now; ask again in Maintenance",
			cmpOrUnknown(req.PanelVersion), env.Build.Version)
	}
	if err != nil {
		m.req = requestHead(data)
		if !maintreq.ValidID(m.req.ID) {
			return maintreq.Result{}, err // no result can name a request without an ID
		}
		return m.finish(m.refused(err))
	}
	m.req = req
	fmt.Fprintf(env.Stderr, "Maintenance request %s: %s\n", req.ID, req.Kind)
	return m.finish(m.carryOut(ctx))
}

// requestHead reads the ID and the kind of a request that was refused, so its result can
// name it: as much as a lenient decoding finds, and the kind only when it is one the
// helper knows.
func requestHead(data []byte) maintreq.Request {
	var head struct {
		ID   string        `json:"id"`
		Kind maintreq.Kind `json:"kind"`
	}
	_ = json.Unmarshal(data, &head) // a request that is not even JSON gets no result
	if !slices.Contains(maintreq.Kinds(), head.Kind) {
		head.Kind = ""
	}
	return maintreq.Request{ID: head.ID, Kind: head.Kind}
}

// cmpOrUnknown returns v, or "of an unknown version" for an empty one.
func cmpOrUnknown(v string) string {
	if v == "" {
		return "of an unknown version"
	}
	return v
}

// carryOut runs the request of a checked kind and returns its result.
func (m *maintenanceRun) carryOut(ctx context.Context) maintreq.Result {
	switch m.req.Kind {
	case maintreq.KindUpdate:
		return m.update(ctx)
	case maintreq.KindRollback:
		return m.rollback(ctx)
	case maintreq.KindRestore:
		return m.restore(ctx)
	case maintreq.KindDomain:
		return m.domain(ctx)
	case maintreq.KindAddress:
		return m.address(ctx)
	case maintreq.KindUninstall:
		return m.uninstall(ctx)
	}
	return m.refused(fmt.Errorf("the kind %q is not one the helper carries out", m.req.Kind))
}

// uninstall starts the uninstall of the request (Maintenance > Uninstall xDesign,
// docs/plan/19-uninstall-2026-11-24.md section 5): xdesign --uninstall --yes with the
// owner's choice and --no-backup, from a copy of this file outside the program and data
// folders on Windows (install.PrepareUninstaller), detached from this helper
// (install.StartUninstaller), as it stops and removes the maintenance helper too. The
// result says it started and is written first (finish runs afterResult once it is
// written); a copy that does not start writes the result again with why.
func (m *maintenanceRun) uninstall(ctx context.Context) maintreq.Result {
	m.progress("uninstall", "Starting the uninstaller")
	exe := executablePath(m.env)
	if exe == "" {
		return m.refused(errors.New("the running xdesign file is not known"))
	}
	at := time.Now()
	file, remove, err := install.PrepareUninstaller(m.env.System, exe, at)
	if err != nil {
		return m.refused(err)
	}
	args := install.UninstallArgs(m.req.Uninstall.KeepData)
	m.afterResult = func() *maintreq.Result {
		fmt.Fprintf(m.env.Stderr, "Starting %s %s\n", file, strings.Join(args, " "))
		if err := install.StartUninstaller(ctx, m.env.System, file, args, at); err != nil {
			remove()
			return &maintreq.Result{Message: "The uninstaller did not start: " + sentence(err.Error()) + " Nothing was changed."}
		}
		return nil
	}
	return maintreq.Result{OK: true, Message: "The uninstaller started."}
}

// refused is the result of a request the helper refused before it changed anything.
func (m *maintenanceRun) refused(err error) maintreq.Result {
	return maintreq.Result{Message: "The request was refused: " + sentence(err.Error()) + " Nothing was changed."}
}

// sentence ends text with a full stop.
func sentence(text string) string {
	text = strings.TrimSpace(text)
	if text == "" || strings.HasSuffix(text, ".") {
		return text
	}
	return text + "."
}

// update installs the uploaded xdesign file of the request (section 6.2 step 3): the
// upload is copied into a folder of root's and checked again, then xdesign update installs
// the copy with its backup, migrations, health check and going back.
func (m *maintenanceRun) update(ctx context.Context) maintreq.Result {
	u := m.req.Update
	m.progress("copy", "Copying the uploaded file into "+protectedFolder)
	file, cleanup, err := m.stageUpload(u)
	if err != nil {
		return m.refused(err)
	}
	defer cleanup()
	fmt.Fprintf(m.env.Stderr, "Updating with %s\n", file)
	var res install.UpdateResult
	// --sha256 makes the update check the copy against the checksum the website checked,
	// besides the SHA256SUMS that came with it.
	code, perr := m.runInProcess(ctx, RunUpdate, []string{"--yes", "--json", "--sha256", u.SHA256, file}, &res)
	out := maintreq.Result{From: res.From, To: res.To, RolledBack: res.RolledBack, FailureLog: res.FailureLog}
	switch {
	case errors.Is(perr, errNotStarted):
		return m.refused(perr)
	case perr != nil:
		out.Message = fmt.Sprintf("The update ended with exit status %d and no result: %s. Check %s on the server.",
			code, perr, maintenanceJournal)
	case res.Status == "updated":
		out.OK = true
		out.Message = fmt.Sprintf("xDesign was updated from %s to %s. xDesign %s runs now.", res.From, res.To, res.To)
	case res.Status == "rolled_back" || res.RolledBack:
		out.RolledBack = true
		out.Message = install.WentBackText(orUnknown(res.From), res.FailureLog)
	default:
		out.Message = "The update failed: " + sentence(res.Error) + logNote(res.Log)
	}
	return out
}

// rollback goes back to the kept release of the request with xdesign rollback, with the
// data from before the update when it asks for it. A rollback the start-count guard asked
// for says that the update went back by itself.
func (m *maintenanceRun) rollback(ctx context.Context) maintreq.Result {
	rb := m.req.Rollback
	m.progress("rollback", "Going back to xDesign "+rb.To)
	args := []string{"--to", rb.To, "--yes", "--json"}
	if rb.RestoreDB {
		args = append(args, "--restore-db")
	}
	var res install.RollbackResult
	code, perr := m.runInProcess(ctx, RunRollback, args, &res)
	out := maintreq.Result{From: res.From, To: res.To}
	switch {
	case errors.Is(perr, errNotStarted):
		return m.refused(perr)
	case perr != nil:
		out.Message = fmt.Sprintf("The rollback ended with exit status %d and no result: %s. Check %s on the server.",
			code, perr, maintenanceJournal)
	case res.Status == "rolled_back" && rb.Guard:
		out.OK, out.RolledBack = true, true
		out.From, out.To = res.To, res.From // the update's versions: from the release before, to the one that did not start
		out.Message = fmt.Sprintf("The update to %s did not start, so it went back by itself. xDesign %s runs.", orUnknown(res.From),
			orUnknown(res.To))
	case res.Status == "rolled_back":
		out.OK = true
		out.Message = fmt.Sprintf("xDesign went back from %s to %s. xDesign %s runs now.", orUnknown(res.From), orUnknown(res.To),
			orUnknown(res.To))
	default:
		out.Message = "The rollback failed: " + sentence(res.Error) + logNote(res.Log)
	}
	return out
}

// restorePhase is a phase of backup.Restore as its progress line starts, with its step ID
// and the percent of the whole restore that progress.json shows for it (-1: as before).
type restorePhase struct {
	line, step string
	percent    int
}

// restorePhases are the phases of backup.Restore in the order they run.
func restorePhases() []restorePhase {
	return []restorePhase{
		{"Checking the backup", "check", 5},
		{"Making a backup of the site first", "backup", 15},
		{"Unpacking the backup", "unpack", 40},
		{"Stopping xDesign", "stop", 55},
		{"Putting the backup in place", "swap", 60},
		{"Running the database migrations", "migrations", 70},
		{"Starting xDesign", "start", 85},
		{"The restore failed", "failed", -1},
		{"Putting the site back as it was before the restore", "back", -1},
	}
}

// restore puts the backup of the request back (section 5.4): its archive is copied into a
// folder of root's, then backup.Restore checks the copy, makes a backup of the site, stops
// xDesign, replaces the database, the media, the settings and the certificates, runs the
// migrations and starts xDesign with its health check, putting the site back as it was when
// a step after the stop fails.
func (m *maintenanceRun) restore(ctx context.Context) maintreq.Result {
	name := m.req.Restore.Backup
	m.progress("copy", "Copying the backup into "+protectedFolder)
	file, cleanup, err := m.stageBackup(name)
	if err != nil {
		return m.refused(err)
	}
	defer cleanup()
	fmt.Fprintf(m.env.Stderr, "Restoring %s\n", file)
	percent := 0
	res, err := backup.Restore(ctx, backup.RestoreOptions{
		Options: install.BackupOptions(m.env.Build.Version),
		Site:    install.Service{Sys: m.env.System, Get: m.env.Get},
		Progress: func(line string) {
			fmt.Fprintln(m.env.Stderr, line)
			p := maintreq.Progress{Step: "restore", Title: strings.TrimSuffix(line, "...")}
			for _, ph := range restorePhases() {
				if strings.HasPrefix(line, ph.line) {
					p.Step = ph.step
					if ph.percent >= 0 {
						percent = ph.percent
					}
					break
				}
			}
			p.Title = truncateRunes(p.Title, maxProgressDetail)
			p.Percent = &percent
			m.writeProgressFile(p)
		},
	}, file)
	out := maintreq.Result{Backup: filepath.Base(res.PreRestore)}
	if res.PreRestore == "" {
		out.Backup = ""
	}
	if err != nil {
		out.Message = "The restore did not finish: " + sentence(err.Error())
		return out
	}
	out.OK = true
	out.Message = fmt.Sprintf("xDesign was restored from %s.", name)
	if out.Backup != "" {
		out.Message += " The backup made before the restore is " + out.Backup + "."
	}
	return out
}

// stageBackup copies the archive of the backup name into a new private folder of root's
// (install.MakePrivateDir), reading it through a descriptor it opened once and checked
// (ownedDir: a regular file of the xdesign user, never a link), so the file the restore
// checks and unpacks is one only root can change. It returns the copy and the function
// that removes the folder.
func (m *maintenanceRun) stageBackup(name string) (string, func(), error) {
	dir, err := openOwnedDir(install.BackupOptions(m.env.Build.Version).Dir(), m.owner.UID)
	if err != nil {
		return "", nil, err
	}
	defer func() { _ = dir.Close() }() // a folder opened for reading
	f, err := dir.openFile(name+backup.Ext, maxBackupArchive)
	if err != nil {
		return "", nil, err
	}
	defer func() { _ = f.Close() }() // read-only: closing cannot lose data
	fi, err := f.Stat()
	if err != nil {
		return "", nil, fmt.Errorf("read the backup %s: %w", name, err)
	}
	priv, err := install.MakePrivateDir(m.env.System, m.env.Rand, "xdesign-maintenance-")
	if err != nil {
		return "", nil, err
	}
	cleanup := func() {
		if err := os.RemoveAll(priv); err != nil {
			fmt.Fprintf(m.env.Stderr, "xdesign admin maintenance: remove %s: %v\n", priv, err)
		}
	}
	if space, err := platform.DiskSpace(priv); err == nil {
		free := int64(space.Free) //nolint:gosec // G115: the free bytes of a file system fit in an int64
		if need := fi.Size() + backupCopyMargin; free < need {
			cleanup()
			return "", nil, fmt.Errorf("there is not enough free space in %s to copy the backup: it needs %s, and %s are free",
				filepath.Dir(priv), backup.FormatBytes(need), backup.FormatBytes(free))
		}
	}
	file := filepath.Join(priv, name+backup.Ext)
	if _, err := copyToRootFile(f, file, maxBackupArchive); err != nil {
		cleanup()
		return "", nil, err
	}
	return file, cleanup, nil
}

// maxBackupArchive bounds the archive a restore copies: the reader's limit of everything
// inside it, which compression only makes smaller. backupCopyMargin is the free space the
// copy leaves.
const (
	maxBackupArchive = 512 << 30
	backupCopyMargin = 64 << 20
)

// domain changes the site's domain with the domain change of internal/install (Settings >
// HTTPS, section 4): config.toml and a restart with the health check, going back to the
// domain from before when a step fails.
func (m *maintenanceRun) domain(ctx context.Context) maintreq.Result {
	d := m.req.Domain.Domain
	m.progress("domain", "Changing the domain to "+d)
	var res install.DomainResult
	code, perr := m.runInProcess(ctx, runDomainChange, []string{"--json", d}, &res)
	out := maintreq.Result{Address: res.Address}
	switch {
	case errors.Is(perr, errNotStarted):
		return m.refused(perr)
	case perr != nil:
		out.Message = fmt.Sprintf("The domain change ended with exit status %d and no result: %s. Check %s on the "+
			"server.", code, perr, maintenanceJournal)
	case res.Status == "changed":
		out.OK = true
		out.Message = fmt.Sprintf("The domain is %s now. xDesign opens at %s.", res.To, res.Address)
	case res.Status == "went_back":
		out.Message = fmt.Sprintf("The domain change failed, so xDesign went back to %s: %s%s", res.From, sentence(res.Error),
			logNote(res.Log))
	default:
		out.Message = "The domain change failed: " + sentence(res.Error) + logNote(res.Log)
	}
	return out
}

// runDomainChange runs the domain change of args ([--json] DOMAIN) for runInProcess.
func runDomainChange(ctx context.Context, env *Env, args []string) int {
	o, err := install.DomainArgs(args)
	if err != nil {
		fmt.Fprintf(env.Stderr, "xdesign domain change: %v\n", err)
		return ExitUsage
	}
	return updater(env, true).ChangeDomain(ctx, o)
}

// address moves the site to the request's port and web base path (Settings > Site
// address) with set-port and set-path of internal/install: the new port opened in the
// firewall and labeled under SELinux, config.toml, a restart with the health check,
// install.json's history, and going back when xDesign does not answer. Each changes one
// part, so a new port moves first and a new path follows once xDesign answers on the port.
func (m *maintenanceRun) address(ctx context.Context) maintreq.Result {
	a, from := m.req.Address, m.cfg
	listenHost, _, err := net.SplitHostPort(from.Listen)
	if err != nil {
		return m.refused(fmt.Errorf("%s: listen %q has no port", config.DefaultPath, from.Listen))
	}
	to := *from
	to.Listen, to.BasePath = net.JoinHostPort(listenHost, strconv.Itoa(a.Port)), a.BasePath
	var moves []install.AddressOptions
	if to.Listen != from.Listen {
		moves = append(moves, install.AddressOptions{Port: a.Port})
	}
	if to.BasePath != from.BasePath {
		moves = append(moves, install.AddressOptions{BasePath: a.BasePath})
	}
	if len(moves) == 0 {
		return m.refused(errors.New("xDesign already uses this address"))
	}
	m.progress("address", "Moving xDesign to "+to.PublicURL())
	at := from.PublicURL()
	for i, o := range moves {
		res, err := m.moveAddress(ctx, o)
		if res.Address != "" {
			at = res.Address
		}
		if err == nil {
			continue
		}
		why := sentence(err.Error()) + logNote(res.Log)
		out := maintreq.Result{Address: at}
		switch {
		case i > 0 && res.Status == "went_back":
			out.Message = fmt.Sprintf("xDesign moved to port %d, but the web base path change failed, so xDesign opens at %s: %s",
				a.Port, at, why)
		case i > 0:
			out.Message = fmt.Sprintf("xDesign moved to port %d, but the web base path change failed: %s", a.Port, why)
		case res.Status == "went_back":
			out.Message = fmt.Sprintf("The address change failed, so xDesign went back to %s: %s", at, why)
		default:
			out.Message = "The address change failed: " + why
		}
		return out
	}
	return maintreq.Result{OK: true, Address: at, Message: fmt.Sprintf("xDesign opens at %s now.", at)}
}

// moveAddress runs set-port or set-path o in this process with --yes and --json, and
// without their check of xdesign-maintenance.service, which is this run. The error says
// why xDesign does not answer at the new address.
func (m *maintenanceRun) moveAddress(ctx context.Context, o install.AddressOptions) (install.AddressResult, error) {
	o.Yes, o.JSON, o.InMaintenance = true, true, true
	run := func(ctx context.Context, env *Env, _ []string) int { return updater(env, true).ChangeAddress(ctx, o) }
	var res install.AddressResult
	code, err := m.runInProcess(ctx, run, nil, &res)
	switch {
	case errors.Is(err, errNotStarted):
		return res, err
	case err != nil:
		return res, fmt.Errorf("the change ended with exit status %d and no result: %w; check %s on the server",
			code, err, maintenanceJournal)
	case res.Status != "changed":
		return res, errors.New(res.Error)
	}
	return res, nil
}

// orUnknown returns v, or "an unknown version" for an empty one.
func orUnknown(v string) string {
	if v == "" {
		return "an unknown version"
	}
	return v
}

// logNote names the log of the steps, when there is one.
func logNote(log string) string {
	if log == "" {
		return ""
	}
	return " The log is " + log + " on the server."
}

// stageUpload copies the files of an update's upload into a new private folder of root's
// (install.MakePrivateDir). It reads them through descriptors it opened once and checked
// (ownedDir): regular files of the xdesign user, within their limits, never a link. Then it
// checks the copy's SHA-256 against the request, so the file xdesign update checks and
// installs is the one the website checked, and only root can change it from now on. It
// returns the copy of the xdesign file and the function that removes the folder.
func (m *maintenanceRun) stageUpload(u *maintreq.UpdateRequest) (string, func(), error) {
	uploads, err := m.dir.openDir(maintreq.UploadsFolderName)
	if err != nil {
		return "", nil, err
	}
	defer func() { _ = uploads.Close() }() // a folder opened for reading
	up, err := uploads.openDir(u.Upload)
	if err != nil {
		return "", nil, err
	}
	defer func() { _ = up.Close() }() // a folder opened for reading
	type upload struct {
		name  string
		limit int64
		f     *os.File
	}
	files := []*upload{{name: u.File, limit: maintreq.MaxUploadFile}}
	for _, name := range []string{u.Sums, u.Sig} {
		if name != "" {
			files = append(files, &upload{name: name, limit: maintreq.MaxFileSize})
		}
	}
	defer func() {
		for _, f := range files {
			if f.f != nil {
				_ = f.f.Close() // read-only: closing cannot lose data
			}
		}
	}()
	for _, f := range files {
		if f.f, err = up.openFile(f.name, f.limit); err != nil {
			return "", nil, err
		}
	}
	dir, err := install.MakePrivateDir(m.env.System, m.env.Rand, "xdesign-maintenance-")
	if err != nil {
		return "", nil, err
	}
	cleanup := func() {
		if err := os.RemoveAll(dir); err != nil {
			fmt.Fprintf(m.env.Stderr, "xdesign admin maintenance: remove %s: %v\n", dir, err)
		}
	}
	for i, f := range files {
		sum, err := copyToRootFile(f.f, filepath.Join(dir, f.name), f.limit)
		if err == nil && i == 0 && sum != u.SHA256 {
			err = fmt.Errorf("%s changed after the website checked it (its SHA-256 differs); upload it again", f.name)
		}
		if err != nil {
			cleanup()
			return "", nil, err
		}
	}
	return filepath.Join(dir, u.File), cleanup, nil
}

// copyToRootFile copies at most limit bytes of src into the new file dst of root's (mode
// 0600, never an existing file or a link) and returns the SHA-256 of what it copied.
func copyToRootFile(src io.Reader, dst string, limit int64) (string, error) {
	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600) //nolint:gosec // G304: a new file in a folder of root's
	if err != nil {
		return "", fmt.Errorf("copy to %s: %w", dst, err)
	}
	h := sha256.New()
	n, err := io.Copy(io.MultiWriter(out, h), io.LimitReader(src, limit+1))
	if err == nil && n > limit {
		err = fmt.Errorf("the file is larger than %d bytes", limit)
	}
	if err == nil {
		err = out.Sync()
	}
	if cerr := out.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return "", fmt.Errorf("copy to %s: %w", dst, err)
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// progress writes the step the helper is at into progress.json and says it in the
// journal.
func (m *maintenanceRun) progress(step, title string) {
	fmt.Fprintln(m.env.Stderr, title)
	m.writeProgressFile(maintreq.Progress{Step: step, Title: title})
}

// writeProgressFile writes progress.json with p, which names the step and may carry the
// percent and the detail the follower read; the request, the kind, the build from before
// and the time are the helper's. A failure is only logged: the result counts.
func (m *maintenanceRun) writeProgressFile(p maintreq.Progress) {
	p.ID, p.Kind, p.FromBuild, p.At = m.req.ID, m.req.Kind, m.req.FromBuild, time.Now().UTC()
	data, err := maintreq.Encode(p)
	if err == nil {
		err = m.dir.writeFile(maintreq.ProgressFileName, data, m.owner)
	}
	if err != nil {
		fmt.Fprintf(m.env.Stderr, "xdesign admin maintenance: write the progress: %v\n", err)
	}
}

// finish writes the result file through the folder's descriptor, then removes the
// progress file, and returns the result. A result that says OK is followed by afterResult,
// when the request has one; when that fails, the result says why instead.
func (m *maintenanceRun) finish(res maintreq.Result) (maintreq.Result, error) {
	res.ID, res.Kind, res.At = m.req.ID, m.req.Kind, time.Now().UTC()
	data, err := maintreq.Encode(res)
	if err != nil {
		return res, err
	}
	if err := m.dir.writeFile(maintreq.ResultFileName, data, m.owner); err != nil {
		return res, err
	}
	if err := m.dir.remove(maintreq.ProgressFileName); err != nil {
		fmt.Fprintf(m.env.Stderr, "xdesign admin maintenance: %v\n", err)
	}
	if after := m.afterResult; after != nil && res.OK {
		m.afterResult = nil
		if failed := after(); failed != nil {
			return m.finish(*failed)
		}
	}
	return res, nil
}

// errNotStarted marks a command that runInProcess could not start.
var errNotStarted = errors.New("the command could not start")

// runInProcess runs a command of this file in this process, as the helper's update and
// rollback do: no terminal, nothing to answer, --yes and --json among args (or in the
// options an address change's run holds). Its output goes to two files of root's, never to
// a pipe, so no reader that goes away can stop it halfway; an update's second stage, a
// program of its own, inherits the same files. They are unlinked at once and live on in
// their descriptors only. A goroutine follows the progress
// file: its JSON progress lines go on to the journal and into progress.json. The result
// object, the last JSON object of the output, is decoded into out. It returns the
// command's exit status and the decoding error (errNotStarted when the command never ran).
func (m *maintenanceRun) runInProcess(ctx context.Context, run func(context.Context, *Env, []string) int, args []string,
	out any,
) (int, error) {
	stdout, err := outputFile("result")
	if err != nil {
		return 0, fmt.Errorf("%w: %w", errNotStarted, err)
	}
	defer func() { _ = stdout.Close() }() // unlinked: closing frees it
	stderr, err := outputFile("progress")
	if err != nil {
		return 0, fmt.Errorf("%w: %w", errNotStarted, err)
	}
	defer func() { _ = stderr.Close() }() // unlinked: closing frees it
	f := &follower{m: m, f: stderr, stop: make(chan struct{}), done: make(chan struct{})}
	go f.run()
	sub := *m.env
	sub.Stdin, sub.Stdout, sub.Stderr, sub.Terminal = strings.NewReader(""), stdout, stderr, false
	code := run(ctx, &sub, args)
	close(f.stop)
	<-f.done
	data, err := readFileAt(stdout, maxCommandOutput)
	if err != nil {
		return code, err
	}
	return code, lastJSONObject(data, out)
}

// maxCommandOutput bounds what the helper reads of a command's standard output: its
// result object.
const maxCommandOutput = 1 << 20

// readFileAt reads the first limit bytes of f, whatever its offset.
func readFileAt(f *os.File, limit int64) ([]byte, error) {
	fi, err := f.Stat()
	if err != nil {
		return nil, fmt.Errorf("read the output of the command: %w", err)
	}
	data := make([]byte, min(fi.Size(), limit))
	n, err := f.ReadAt(data, 0)
	if err != nil && !errors.Is(err, io.EOF) {
		return nil, fmt.Errorf("read the output of the command: %w", err)
	}
	return data[:n], nil
}

// readOwnedFile reads the file name of dir, of at most limit bytes, through the one
// descriptor that ownedDir.openFile opened and checked.
func readOwnedFile(dir *ownedDir, name string, limit int64) ([]byte, error) {
	f, err := dir.openFile(name, limit)
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }() // read-only: closing cannot lose data
	data, err := io.ReadAll(io.LimitReader(f, limit+1))
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", f.Name(), err)
	}
	if int64(len(data)) > limit {
		return nil, fmt.Errorf("%s is larger than %d bytes", f.Name(), limit)
	}
	return data, nil
}

// followInterval is how often the follower reads what the command added to its progress
// file.
const followInterval = 500 * time.Millisecond

// progressWriteInterval is the shortest time between two writes of progress.json that
// only change the percent or the detail; a step that starts is written at once.
const progressWriteInterval = 2 * time.Second

// maxProgressDetail bounds the detail kept in progress.json.
const maxProgressDetail = 200

// maxProgressLine bounds a progress line kept while its end has not arrived.
const maxProgressLine = 64 << 10

// follower follows the progress file of a command: it reads what was added (with its own
// offset, so the command's writes are not disturbed), passes the lines on to the journal
// and writes progress.json: at once for each step that starts (install.StepEvent), and when
// the percent of the whole run or the detail of the step changed (install.ProgressLine), at
// most every 2 seconds.
type follower struct {
	m       *maintenanceRun
	f       *os.File
	off     int64
	partial []byte
	// stop asks for a last read; done closes after it.
	stop, done chan struct{}

	// shown is what the website is to see; written is what progress.json holds, at
	// wroteAt; zero before the first write.
	shown, written progressView
	wroteAt        time.Time
}

// progressView is the part of progress.json that the follower tracks.
type progressView struct {
	step, title string
	// percent is -1 until the command reports one.
	percent int
	detail  string
}

func (f *follower) run() {
	defer close(f.done)
	f.shown, f.written = progressView{percent: -1}, progressView{percent: -1}
	t := time.NewTicker(followInterval)
	defer t.Stop()
	for {
		f.read()
		f.flush(false)
		select {
		case <-f.stop:
			f.read() // what came last
			if len(f.partial) > 0 {
				f.line(f.partial)
			}
			f.flush(true)
			return
		case <-t.C:
		}
	}
}

// flush writes progress.json when what the website is to see differs from what it holds:
// at once with force, otherwise when the last write is 2 seconds old.
func (f *follower) flush(force bool) {
	if f.shown == f.written {
		return
	}
	now := time.Now()
	if !force && !f.wroteAt.IsZero() && now.Sub(f.wroteAt) < progressWriteInterval {
		return
	}
	p := maintreq.Progress{Step: f.shown.step, Title: f.shown.title, Detail: f.shown.detail}
	if f.shown.percent >= 0 {
		percent := f.shown.percent
		p.Percent = &percent
	}
	f.m.writeProgressFile(p)
	f.written, f.wroteAt = f.shown, now
}

// read reads everything added since the last read and handles its complete lines.
func (f *follower) read() {
	buf := make([]byte, 32<<10)
	for {
		n, err := f.f.ReadAt(buf, f.off)
		if n > 0 {
			f.off += int64(n)
			// The journal; with SIGPIPE ignored, a write that fails only returns its error.
			_, _ = f.m.env.Stderr.Write(buf[:n])
			f.partial = append(f.partial, buf[:n]...)
			for {
				i := bytes.IndexByte(f.partial, '\n')
				if i < 0 {
					break
				}
				f.line(f.partial[:i])
				f.partial = f.partial[i+1:]
			}
			if len(f.partial) > maxProgressLine {
				f.partial = f.partial[:0] // not a progress line
			}
		}
		if err != nil || n < len(buf) {
			return // io.EOF: everything so far is read
		}
	}
}

// line handles one line of the command's progress: a step that starts is written at
// once, a percent or a detail waits for flush.
func (f *follower) line(line []byte) {
	line = bytes.TrimSpace(line)
	var head struct {
		Event string `json:"event"`
	}
	if json.Unmarshal(line, &head) != nil {
		return
	}
	switch head.Event {
	case "step":
		var ev install.StepEvent
		if json.Unmarshal(line, &ev) != nil {
			return
		}
		f.setPercent(ev.Percent)
		if ev.Status == "started" && ev.Title != "" {
			f.shown.step, f.shown.title, f.shown.detail = ev.ID, ev.Title, ""
			f.flush(true)
		}
	case "progress":
		var ev install.ProgressLine
		if json.Unmarshal(line, &ev) != nil || ev.Step != f.shown.step {
			return // a reading of a step the website is not shown
		}
		f.setPercent(ev.Percent)
		f.shown.detail = truncateRunes(ev.Detail, maxProgressDetail)
	}
}

// setPercent takes the percent of the whole run that a line of the command reports; it
// never goes down, whatever order the lines come in.
func (f *follower) setPercent(percent *int) {
	if percent != nil {
		f.shown.percent = max(f.shown.percent, min(*percent, 100))
	}
}

// truncateRunes cuts s to at most n runes.
func truncateRunes(s string, n int) string {
	if r := []rune(s); len(r) > n {
		return string(r[:n])
	}
	return s
}

// lastJSONObject decodes the last JSON object of output, the result object of a command
// with --json, into out. Output after the objects that is not JSON is ignored.
func lastJSONObject(output []byte, out any) error {
	dec := json.NewDecoder(bytes.NewReader(output))
	var last json.RawMessage
	for {
		var raw json.RawMessage
		if err := dec.Decode(&raw); err != nil {
			break
		}
		if len(raw) > 0 && raw[0] == '{' {
			last = raw
		}
	}
	if last == nil {
		return errors.New("the command printed no result")
	}
	if err := json.Unmarshal(last, out); err != nil {
		return fmt.Errorf("read the result of the command: %w", err)
	}
	return nil
}
