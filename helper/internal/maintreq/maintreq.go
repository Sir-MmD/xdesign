// Package maintreq holds the folder layout and the file shapes of the maintenance
// helper (docs/plan/07-server-install-update.md section 6), which xdesign serve and the
// root helper share. The service is unprivileged, so installing a build and going back to
// an earlier one go through one root helper: serve writes a request file into the
// maintenance folder, last and by an atomic rename; the systemd path unit
// xdesign-maintenance.path starts xdesign-maintenance.service, which runs `xdesign admin
// maintenance --request` as root; the helper claims the request, writes its progress and
// finally its result next to it, and serve reads both for the website. Copied from
// xWriter's internal/cli/maintreq and cut to the update and the rollback; the restore of a
// backup (section 5.4), the domain change of Settings > HTTPS (section 4), the address
// change of Settings > Site address (docs/plan/17-second-owner-list-2026-11-23.md section
// 6) and Maintenance > Uninstall xDesign (docs/plan/19-uninstall-2026-11-24.md section 5)
// go through the same helper.
package maintreq

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"slices"
	"time"
	"unicode/utf8"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
	"github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
	"github.com/Sir-MmD/xdesign/helper/internal/config"
)

// The folder and its files. The folder <data dir>/maintenance belongs to the xdesign
// user, mode 0700; uploads/<id>/ holds the uploaded files of an update, request.json
// the request (mode 0600, written last by an atomic rename), and progress.json and
// result.json what the helper writes back (owned by the xdesign user, mode 0600).
const (
	// FolderName is the maintenance folder inside the data folder:
	// /var/lib/xdesign/maintenance on a server.
	FolderName = "maintenance"
	// UploadsFolderName holds the uploads of updates, each in a folder named by its ID.
	UploadsFolderName = "uploads"
	// RequestFileName, ProgressFileName and ResultFileName are the files of the
	// maintenance folder.
	RequestFileName  = "request.json"
	ProgressFileName = "progress.json"
	ResultFileName   = "result.json"
	// MaxFileSize bounds the request, progress and result files, and the SHA256SUMS and
	// SHA256SUMS.sig of an upload.
	MaxFileSize = 64 << 10
	// MaxUploadFile bounds the uploaded xdesign file, or the packed file that holds it.
	MaxUploadFile = 512 << 20
	// RequestMaxAge is how old a request may be when the helper carries it out: an older
	// one, found for example when the path unit is enabled again by an update, is
	// refused.
	RequestMaxAge = time.Hour
	// ProgressMaxAge is how long a progress file without a result counts as a task that
	// still runs: the TimeoutStartSec of xdesign-maintenance.service, and some slack. An
	// older one was left by a helper that was killed.
	ProgressMaxAge = 13 * time.Hour
)

// The systemd units of the helper.
const (
	// PathUnit watches for the request file and starts ServiceUnit.
	PathUnit = "xdesign-maintenance.path"
	// ServiceUnit runs the helper as root, one request at a time.
	ServiceUnit = "xdesign-maintenance.service"
	// UnitDir holds the installed unit files, and WantsDir the links of the units
	// enabled at boot (the path unit's WantedBy=multi-user.target).
	UnitDir  = "/etc/systemd/system"
	WantsDir = "/etc/systemd/system/multi-user.target.wants"
)

// Kind is what a request asks for.
type Kind string

// The kinds the helper knows; it refuses anything else.
const (
	// KindUpdate installs an uploaded xdesign file with xdesign update.
	KindUpdate Kind = "update"
	// KindRollback goes back to a kept release with xdesign rollback.
	KindRollback Kind = "rollback"
	// KindRestore puts a backup of the backups' folder back with backup.Restore (section
	// 5.4).
	KindRestore Kind = "restore"
	// KindDomain changes the site's domain (Settings > HTTPS, section 4): config.toml and a
	// restart.
	KindDomain Kind = "domain"
	// KindAddress moves the site to another port or web base path, or both (Settings >
	// Site address): xdesign admin set-port and set-path.
	KindAddress Kind = "address"
	// KindUninstall removes xDesign from the server (Maintenance > Uninstall xDesign,
	// docs/plan/19-uninstall-2026-11-24.md section 5): the helper starts xdesign --uninstall
	// detached from itself, and the request is done once it started.
	KindUninstall Kind = "uninstall"
)

// Kinds returns the kinds in their usual order.
func Kinds() []Kind {
	return []Kind{KindUpdate, KindRollback, KindRestore, KindDomain, KindAddress, KindUninstall}
}

// The files of an update upload besides the xdesign file itself.
const (
	SumsFileName = "SHA256SUMS"
	SigFileName  = "SHA256SUMS.sig"
)

// Request is the request file: its ID, its kind with the matching part, when it was
// asked for, the version of the helper that wrote it and, for an update or a rollback,
// the build that answered then.
type Request struct {
	// ID names the request; the progress and the result carry it.
	ID   string `json:"id"`
	Kind Kind   `json:"kind"`
	// RequestedAt is when the owner asked.
	RequestedAt time.Time `json:"requested_at"`
	// PanelVersion is the version of the xdesign serve that wrote the request; the root
	// helper refuses a request of another version than its own.
	PanelVersion string `json:"panel_version"`
	// FromBuild is the build that answered when the request was written; nil for a
	// restore, a domain change, an address change and an uninstall, which keep the build.
	FromBuild *Build `json:"from_build,omitempty"`
	// Exactly the part of Kind is set.
	Update    *UpdateRequest    `json:"update,omitempty"`
	Rollback  *RollbackRequest  `json:"rollback,omitempty"`
	Restore   *RestoreRequest   `json:"restore,omitempty"`
	Domain    *DomainRequest    `json:"domain,omitempty"`
	Address   *AddressRequest   `json:"address,omitempty"`
	Uninstall *UninstallRequest `json:"uninstall,omitempty"`
}

// UpdateRequest names an upload: the folder uploads/<Upload>/ with the xdesign file
// File, its SHA-256 as the check computed it, and the optional SHA256SUMS and
// SHA256SUMS.sig next to it.
type UpdateRequest struct {
	Upload string `json:"upload"`
	File   string `json:"file"`
	SHA256 string `json:"sha256"`
	// Sums is SumsFileName when the upload has a SHA256SUMS file, otherwise empty.
	Sums string `json:"sums,omitempty"`
	// Sig is SigFileName when the upload has a SHA256SUMS.sig file, otherwise empty.
	Sig string `json:"sig,omitempty"`
}

// RollbackRequest names the kept release to go back to.
type RollbackRequest struct {
	To string `json:"to"`
	// RestoreDB also puts back the backup made before the update from To ("Also restore
	// the data from before the update", section 6.2).
	RestoreDB bool `json:"restore_db,omitempty"`
	// Guard reports a request of the start-count guard of a new release that did not
	// serve (internal/guard): the result says that the update went back by itself.
	Guard bool `json:"guard,omitempty"`
}

// RestoreRequest names the backup to put back: its name in the backups' folder
// (xdesign-<time> or pre-update-<version>-<time>).
type RestoreRequest struct {
	Backup string `json:"backup"`
}

// DomainRequest names the site's new domain: a domain name, or the server's IP address.
type DomainRequest struct {
	Domain string `json:"domain"`
}

// AddressRequest names the site's new address: its port and its web base path, the one
// from before for the part that does not change.
type AddressRequest struct {
	Port     int    `json:"port"`
	BasePath string `json:"base_path"`
}

// UninstallRequest is the owner's choice: "Keep the data" (xdesign --uninstall
// --keep-data) or "Remove everything" (--remove-everything).
type UninstallRequest struct {
	KeepData bool `json:"keep_data"`
}

// Build is the build that answered when an update or a rollback request was written,
// and when its process started. The helper copies it into the progress file, so a
// Maintenance page that follows the request from another tab compares the build that
// answers with this one and not with the build it saw when it opened, which may be the
// new one already.
type Build struct {
	Version string `json:"version"`
	// Commit and BuiltAt are empty when the build does not know them.
	Commit    string    `json:"commit,omitempty"`
	BuiltAt   string    `json:"built_at,omitempty"`
	StartedAt time.Time `json:"started_at"`
}

// maxBuildText bounds each text of a Build.
const maxBuildText = 100

// valid reports whether b is absent or holds short texts the helper may copy into the
// progress file the website reads.
func (b *Build) valid() bool {
	if b == nil {
		return true
	}
	for _, s := range []string{b.Version, b.Commit, b.BuiltAt} {
		if !utf8.ValidString(s) || len(s) > maxBuildText {
			return false
		}
	}
	return true
}

// Progress is the progress file: the step the helper is at, and how far the whole
// request is.
type Progress struct {
	ID   string `json:"id"`
	Kind Kind   `json:"kind"`
	// Step is the step's ID, such as "backup" of an update; Title says it for the owner.
	Step  string `json:"step"`
	Title string `json:"title"`
	// Percent is the percent of the whole request, 0 to 100, as the command reports it
	// (it never goes down); nil until the command has said, and for the steps the helper
	// does itself. Detail says what the step is doing; it may be empty.
	Percent *int   `json:"percent,omitempty"`
	Detail  string `json:"detail,omitempty"`
	// FromBuild is the request's build from before, copied into every progress file of an
	// update or a rollback; nil for a request without one.
	FromBuild *Build `json:"from_build,omitempty"`
	// At is when the helper wrote the file.
	At time.Time `json:"at"`
}

// Result is the result file: the outcome of the request named by ID.
type Result struct {
	ID   string `json:"id"`
	Kind Kind   `json:"kind"`
	// OK reports that the request was carried out.
	OK bool `json:"ok"`
	// Message says what happened, for the website.
	Message string `json:"message"`
	// From and To are the versions of an update or a rollback.
	From string `json:"from,omitempty"`
	To   string `json:"to,omitempty"`
	// RolledBack reports an update that failed after xDesign stopped and went back to
	// From by itself.
	RolledBack bool `json:"rolled_back,omitempty"`
	// FailureLog is the saved journal of a failed update.
	FailureLog string `json:"failure_log,omitempty"`
	// Backup is the backup a restore made of the site first (its archive's name).
	Backup string `json:"backup,omitempty"`
	// Address is the site's address after a domain change or an address change.
	Address string    `json:"address,omitempty"`
	At      time.Time `json:"at"`
}

// idRE is the ID of a request or an upload: 16 random bytes in lower-case hex.
var idRE = regexp.MustCompile(`^[0-9a-f]{32}$`)

// fileNameRE is the name of an uploaded xdesign file: one plain file name, such as
// xdesign-1.1.0-linux-amd64 or xdesign.
var fileNameRE = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._+-]{0,199}$`)

// sha256RE is a SHA-256 in lower-case hex.
var sha256RE = regexp.MustCompile(`^[0-9a-f]{64}$`)

// NewID returns a new random ID for a request or an upload.
func NewID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b) // crypto/rand never fails since Go 1.24
	return hex.EncodeToString(b)
}

// ValidID reports whether id is the ID of a request or an upload.
func ValidID(id string) bool {
	return idRE.MatchString(id)
}

// Check checks a request found at now: its ID, a known kind with exactly its part, an
// age below RequestMaxAge, the build from before, and the part itself. The helper checks
// the uploaded files itself, and serve checks the request before it writes it, with the
// same rules.
func (r Request) Check(now time.Time) error {
	switch {
	case !ValidID(r.ID):
		return fmt.Errorf("the maintenance request has the invalid ID %q", r.ID)
	case !slices.Contains(Kinds(), r.Kind):
		return fmt.Errorf("the maintenance request asks for %q, which is not update, rollback, restore, domain, address or uninstall",
			r.Kind)
	case r.RequestedAt.IsZero() || now.Sub(r.RequestedAt) > RequestMaxAge || r.RequestedAt.Sub(now) > time.Minute:
		return fmt.Errorf("the maintenance request is from %s, which is not within the last hour; ask again in Maintenance",
			r.RequestedAt.UTC().Format(time.RFC3339))
	case !utf8.ValidString(r.PanelVersion) || len(r.PanelVersion) > 100:
		return errors.New("the maintenance request has an invalid version")
	case !r.FromBuild.valid():
		return errors.New("the maintenance request has an invalid build from before")
	}
	parts := 0
	given := []bool{r.Update != nil, r.Rollback != nil, r.Restore != nil, r.Domain != nil, r.Address != nil, r.Uninstall != nil}
	for _, set := range given {
		if set {
			parts++
		}
	}
	switch r.Kind {
	case KindUpdate:
		if r.Update == nil || parts != 1 {
			return errors.New("the update request must carry exactly its update part")
		}
		return r.Update.check()
	case KindRollback:
		if r.Rollback == nil || parts != 1 {
			return errors.New("the rollback request must carry exactly its rollback part")
		}
		if _, err := buildinfo.ParseVersion(r.Rollback.To); err != nil || len(r.Rollback.To) > 64 {
			return fmt.Errorf("the rollback request names the invalid version %q", r.Rollback.To)
		}
	case KindRestore:
		if r.Restore == nil || parts != 1 {
			return errors.New("the restore request must carry exactly its restore part")
		}
		if !backup.ValidName(r.Restore.Backup) {
			return fmt.Errorf("the restore request names the invalid backup %q", r.Restore.Backup)
		}
	case KindDomain:
		if r.Domain == nil || parts != 1 {
			return errors.New("the domain request must carry exactly its domain part")
		}
		if d, err := config.CheckDomain(r.Domain.Domain); err != nil || d != r.Domain.Domain {
			return fmt.Errorf("the domain request names the invalid domain %q", r.Domain.Domain)
		}
	case KindAddress:
		if r.Address == nil || parts != 1 {
			return errors.New("the address request must carry exactly its address part")
		}
		return r.Address.check()
	case KindUninstall:
		if r.Uninstall == nil || parts != 1 {
			return errors.New("the uninstall request must carry exactly its uninstall part")
		}
	}
	return nil
}

// check checks the port and the web base path of an address change as set-port and
// set-path do: port 80 cannot serve HTTPS.
func (a *AddressRequest) check() error {
	switch {
	case a.Port < 1 || a.Port > 65535 || a.Port == 80:
		return fmt.Errorf("the address request names the invalid port %d", a.Port)
	case config.CheckBasePath(a.BasePath) != nil:
		return fmt.Errorf("the address request names the invalid web base path %q", a.BasePath)
	}
	return nil
}

// check checks the names and the checksum of an update upload.
func (u *UpdateRequest) check() error {
	switch {
	case !ValidID(u.Upload):
		return fmt.Errorf("the update request names the invalid upload %q", u.Upload)
	case !fileNameRE.MatchString(u.File) || u.File == SumsFileName || u.File == SigFileName:
		return fmt.Errorf("the update request names the invalid file %q", u.File)
	case !sha256RE.MatchString(u.SHA256):
		return errors.New("the update request has no valid SHA-256 of the file")
	case u.Sums != "" && u.Sums != SumsFileName:
		return fmt.Errorf("the update request names the checksum file %q instead of %s", u.Sums, SumsFileName)
	case u.Sig != "" && u.Sig != SigFileName:
		return fmt.Errorf("the update request names the signature file %q instead of %s", u.Sig, SigFileName)
	case u.Sig != "" && u.Sums == "":
		return fmt.Errorf("the update request has %s without %s", SigFileName, SumsFileName)
	}
	return nil
}

// ParseRequest decodes a request file. Fields this version does not know are refused:
// the helper carries out exactly what it understands.
func ParseRequest(data []byte) (Request, error) {
	var r Request
	if err := decodeStrict(data, &r); err != nil {
		return Request{}, fmt.Errorf("the maintenance request is not valid: %w", err)
	}
	return r, nil
}

// ParseProgress decodes a progress file.
func ParseProgress(data []byte) (Progress, error) {
	var p Progress
	if len(data) > MaxFileSize {
		return p, fmt.Errorf("the maintenance progress is larger than %d bytes", MaxFileSize)
	}
	if err := json.Unmarshal(data, &p); err != nil {
		return p, fmt.Errorf("the maintenance progress is not valid JSON: %w", err)
	}
	return p, nil
}

// ParseResult decodes a result file.
func ParseResult(data []byte) (Result, error) {
	var r Result
	if len(data) > MaxFileSize {
		return r, fmt.Errorf("the maintenance result is larger than %d bytes", MaxFileSize)
	}
	if err := json.Unmarshal(data, &r); err != nil {
		return r, fmt.Errorf("the maintenance result is not valid JSON: %w", err)
	}
	return r, nil
}

// Encode returns the content of a request, progress or result file: indented JSON with
// a final newline.
func Encode(v any) ([]byte, error) {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("encode the maintenance file: %w", err)
	}
	return append(data, '\n'), nil
}

// decodeStrict decodes one JSON object into v, refusing unknown fields, trailing data
// and files above MaxFileSize.
func decodeStrict(data []byte, v any) error {
	if len(data) > MaxFileSize {
		return fmt.Errorf("it is larger than %d bytes", MaxFileSize)
	}
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(v); err != nil {
		return fmt.Errorf("decode it: %w", err)
	}
	if dec.More() {
		return errors.New("it holds more than one JSON object")
	}
	return nil
}
