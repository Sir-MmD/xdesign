package maintenance

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
	"github.com/Sir-MmD/xdesign/helper/internal/maintreq"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
	"github.com/Sir-MmD/xdesign/helper/internal/release"
	"github.com/Sir-MmD/xdesign/helper/internal/unpack"
)

// The checks of an update upload (section 6.2 step 2), in the order of xdesign update's
// first stage: opening a packed file, the checksum and the signature, the build
// information of the xdesign file (read from its symbol table, never by running it), the
// version rules, and the free space. The root helper and xdesign update check everything
// again as root; what serve checks here only decides whether "Install and restart" is
// offered. Copied from xWriter's update_check.go and update_unpack.go.

const (
	// unpackTimeout bounds the opening of a packed file: a file that asks for more than it
	// should must not hold the request.
	unpackTimeout = 5 * time.Minute
	// maxInsideName bounds the name of the file inside a packed file, as the check shows
	// it.
	maxInsideName = 200
)

// The results of the checksum and signature checks (UpdateCheck), in the words the rows
// show after "Checksum: " and "Signature: ".
const (
	ChecksumMatches  = "matches"
	ChecksumNotGiven = "not given"
	ChecksumMismatch = "does not match"
	SignatureValid   = "valid"
	SignatureNone    = "not signed"
	SignatureInvalid = "invalid"
)

// UpdateCheck is what the check of an upload found (POST /maintenance/uploads).
type UpdateCheck struct {
	// UploadID names the checked upload for StartUpdate; "" when it was refused.
	UploadID string `json:"upload_id"`
	// ExpiresAt is when the checked upload goes; zero when it was refused.
	ExpiresAt time.Time `json:"expires_at"`
	// File is the name the xdesign file is stored under; SizeBytes and SHA256 describe it:
	// the file inside a packed file, not the packed file.
	File      string `json:"file"`
	SizeBytes int64  `json:"size_bytes"`
	SHA256    string `json:"sha256"`
	// PackedAs names the format of the packed file the xdesign file came out of ("zip",
	// "tar.xz"), Inside its own name in it and OuterSHA256 the SHA-256 of the packed file
	// as uploaded; all three are empty when the upload was the xdesign file itself.
	PackedAs    string `json:"packed_as,omitempty"`
	Inside      string `json:"inside,omitempty"`
	OuterSHA256 string `json:"outer_sha256,omitempty"`
	// Version, Commit, BuiltAt and Arch describe the uploaded build, as far as the check
	// got; FromVersion is the running version.
	Version     string `json:"version"`
	FromVersion string `json:"from_version"`
	Commit      string `json:"commit"`
	BuiltAt     string `json:"built_at"`
	Arch        string `json:"arch"`
	// DevelopmentBuild reports a development build.
	DevelopmentBuild bool `json:"development_build"`
	// MinUpgradeFrom and SchemaFloor are the update limits of the uploaded build.
	MinUpgradeFrom string `json:"min_upgrade_from"`
	SchemaFloor    string `json:"schema_floor"`
	// Checksum is ChecksumMatches, ChecksumNotGiven or ChecksumMismatch; ChecksumSource
	// says what matched ("SHA256SUMS", "the SHA-256 you typed", or both).
	Checksum       string `json:"checksum"`
	ChecksumSource string `json:"checksum_source,omitempty"`
	// Signature is SignatureValid, SignatureNone or SignatureInvalid.
	Signature string `json:"signature"`
	// Rows are the checks as the page shows them (section 6.2 step 2): "1.0.0 to 1.1.0",
	// "System: Linux", "CPU: amd64", "Checksum: matches", "Signature: valid", "Disk space: enough", "Can
	// update from 1.0.0: yes"; only those that passed.
	Rows []string `json:"rows"`
	// Warnings are shown before "Install and restart".
	Warnings []string `json:"warnings"`
	// Refusal says why the file cannot be installed here; nothing is kept then.
	Refusal string `json:"refusal,omitempty"`
}

// CheckUpload checks the received files of up; typed is the SHA-256 the owner typed, ""
// without one. A form without the xdesign file, or with an invalid SHA-256, is refused. A
// file that cannot be installed comes back with Refusal, and the upload is removed; one
// that passed waits uploadTTL for StartUpdate. A packed file is opened first: the result
// and the record StartUpdate reads describe the xdesign file inside it.
func (u *Updates) CheckUpload(ctx context.Context, up *Upload, typed string) (UpdateCheck, error) {
	defer up.release()
	files, err := up.stored()
	if err == nil {
		typed, err = normalizeSHA256(typed)
	}
	if err != nil {
		up.Abort()
		return UpdateCheck{}, err
	}
	c := &checker{u: u, up: up, files: files, typed: typed}
	f := files.update
	res := UpdateCheck{
		File: f.name, SizeBytes: f.size, SHA256: f.sha256, FromVersion: u.build.Version,
		Checksum: ChecksumNotGiven, Signature: SignatureNone, Rows: []string{}, Warnings: []string{},
	}
	for _, step := range []func(context.Context, *UpdateCheck) (string, error){
		c.unpack, c.checksum, c.signature, c.contents, c.versionRules, c.space,
	} {
		refusal, err := step(ctx, &res)
		if err != nil {
			up.Abort()
			return UpdateCheck{}, err
		}
		if refusal != "" {
			res.Refusal = refusal
			up.Abort()
			u.log.InfoContext(ctx, "update file refused", "file", res.File, "packed_as", res.PackedAs, "version", res.Version,
				"refusal", refusal)
			return res, nil
		}
	}
	now := time.Now().UTC()
	f = c.files.update
	res.UploadID, res.ExpiresAt = up.id, now.Add(uploadTTL)
	rec := checkRecord{Check: res, Sums: c.files.sums != nil, Sig: c.files.sig != nil, CheckedAt: now}
	if err := writeCheckRecord(up.dir, rec); err != nil {
		up.Abort()
		return UpdateCheck{}, err
	}
	u.log.InfoContext(ctx, "update file checked", "upload_id", up.id, "file", f.name, "packed_as", res.PackedAs,
		"from", res.FromVersion, "to", res.Version, "checksum", res.Checksum, "signature", res.Signature)
	return res, nil
}

// normalizeSHA256 returns the SHA-256 the owner typed in lower case: 64 hexadecimal
// digits, or a sha256sum line that starts with them; "" stays "".
func normalizeSHA256(typed string) (string, error) {
	fields := strings.Fields(typed)
	if len(fields) == 0 {
		return "", nil
	}
	sum := strings.ToLower(fields[0])
	if !release.ValidSHA256(sum) {
		return "", refused(RefusedInvalid, "Enter the 64 letters and digits sha256sum prints for the file.")
	}
	return sum, nil
}

// checker runs the checks of one upload.
type checker struct {
	u  *Updates
	up *Upload
	// files are the files the checks look at. The first step replaces a packed file by the
	// xdesign file inside it, and may add the SHA256SUMS and SHA256SUMS.sig that lay next
	// to it in the packed file (unpack).
	files uploadFiles
	typed string
	// outer is the packed file, nil when the upload was the xdesign file itself;
	// insideName is the file's own name in it, the name SHA256SUMS lists it by; sumsInside
	// reports that SHA256SUMS (and its signature) came out of the packed file.
	outer      *uploadedFile
	insideName string
	sumsInside bool
	// sumsData is SHA256SUMS; sumsLine the line that lists the file ("" when none does).
	sumsData []byte
	sumsLine string
	bin      release.Binary
}

// unpack opens the uploaded file when it is a packed file and makes the xdesign file
// inside the file of the check: it is stored in the upload's folder under a name of its
// own, the packed file is removed, and the SHA256SUMS and SHA256SUMS.sig that lay next to
// it are stored too, unless the owner uploaded a SHA256SUMS of their own.
func (c *checker) unpack(ctx context.Context, res *UpdateCheck) (string, error) {
	packed := c.files.update
	if packed.kind != release.KindPacked {
		return "", nil
	}
	file, err := os.Open(packed.path)
	if err != nil {
		return "", fmt.Errorf("read the upload: %w", err)
	}
	defer func() { _ = file.Close() }() // read-only: closing cannot lose data
	opened, cancel := context.WithTimeout(ctx, unpackTimeout)
	defer cancel()
	found, err := unpack.Resolve(opened, file, packed.size, c.up.dir, unpack.Options{
		Name: packed.name, Path: packed.path, Arch: c.u.build.Arch,
		Limits: unpack.Limits{Payload: maintreq.MaxUploadFile}, Before: c.room,
	})
	if err != nil {
		return unpackFailure(ctx, err, res)
	}
	if found.Kind != release.KindBinary {
		if found.Unpacked {
			_ = os.Remove(found.Path) // what the unpacking stored
		}
		return "This file holds an xWriter-style release archive, not an xdesign file.", nil
	}
	payload := *packed
	payload.kind = found.Kind
	payload.name = safeFileName(found.Name)
	payload.path = filepath.Join(c.up.dir, payload.name)
	payload.size, payload.sha256 = found.Size, found.SHA256
	// The packed file goes first: it has done its work, and it may have the payload's name.
	if err := os.Remove(packed.path); err != nil {
		_ = os.Remove(found.Path)
		return "", fmt.Errorf("remove the packed file: %w", err)
	}
	if err := os.Rename(found.Path, payload.path); err != nil {
		_ = os.Remove(found.Path)
		return "", fmt.Errorf("store the unpacked file: %w", err)
	}
	c.files.update, c.outer, c.insideName = &payload, packed, found.Name
	res.File, res.SizeBytes, res.SHA256 = payload.name, payload.size, payload.sha256
	res.PackedAs, res.Inside, res.OuterSHA256 = strings.Join(found.Layers, ", "), insideName(found.Name), packed.sha256
	return "", c.keepSums(found, res)
}

// noRoomError is the refusal of an unpack that would leave the data folder too little free
// space. Options.Before returns it, and the unpack step turns it into the check's refusal.
type noRoomError struct{ msg string }

func (e *noRoomError) Error() string { return e.msg }

// unpackFailure turns the error of unpack.Resolve into the check's answer: the sentence of
// a refusal (and the format it names), or an error when the failure is the server's.
func unpackFailure(ctx context.Context, err error, res *UpdateCheck) (string, error) {
	var refusal *unpack.Error
	var short *noRoomError
	switch {
	case errors.As(err, &refusal):
		res.PackedAs = refusal.Format
		return refusal.Error(), nil
	case errors.As(err, &short):
		return short.Error(), nil
	case ctx.Err() == nil && errors.Is(err, context.DeadlineExceeded):
		return fmt.Sprintf("Opening this file took longer than %d minutes, so xDesign stopped. Pack the update again without the "+
			"strongest compression, or upload the xdesign file itself.", int(unpackTimeout.Minutes())), nil
	}
	return "", fmt.Errorf("open the packed file: %w", err)
}

// room is unpack.Options.Before: the file inside, of the size its packed file declares or,
// when the format does not say, of at most the largest update file, must fit in the data
// folder on top of what an upload leaves free.
func (c *checker) room(found unpack.Found) error {
	need, upTo := found.Size, ""
	if need < 0 {
		need, upTo = maintreq.MaxUploadFile, "up to "
	}
	free, err := freeSpaceOf(c.up.dir)
	if err != nil {
		return fmt.Errorf("check the free space of the data folder: %w", err)
	}
	if free >= need+uploadDiskMargin {
		return nil
	}
	return &noRoomError{msg: fmt.Sprintf("There is not enough free space to open this file: the file inside needs %s%s, and the server "+
		"has %s free in %s, of which %s must stay free. Free some space, then check the file again.", upTo,
		formatBytes(need), formatBytes(free), c.u.dataDir, formatBytes(uploadDiskMargin))}
}

// keepSums stores the SHA256SUMS and SHA256SUMS.sig that lay next to the xdesign file in
// the packed file, unless the owner uploaded a SHA256SUMS of their own: a signature signs
// the SHA256SUMS it was made with, so the two come from the same place.
func (c *checker) keepSums(found unpack.Found, res *UpdateCheck) error {
	if found.Sums == nil || c.files.sums != nil {
		return nil
	}
	if _, err := release.ParseSums(found.Sums); err != nil {
		res.Warnings = append(res.Warnings, "The "+maintreq.SumsFileName+" inside the "+res.PackedAs+" file could not be read ("+
			strings.TrimSuffix(err.Error(), ".")+"), so it was not used.")
		return nil
	}
	sums, err := c.storeFile(roleSums, maintreq.SumsFileName, found.Sums)
	if err != nil {
		return err
	}
	c.files.sums, c.sumsInside = sums, true
	if found.Sig == nil || c.files.sig != nil {
		return nil
	}
	sig, err := c.storeFile(roleSig, maintreq.SigFileName, found.Sig)
	if err != nil {
		return err
	}
	c.files.sig = sig
	return nil
}

// storeFile stores data in the upload's folder under name, as a file of the upload.
func (c *checker) storeFile(role fileRole, name string, data []byte) (*uploadedFile, error) {
	p := filepath.Join(c.up.dir, name)
	if err := writeSynced(p, data); err != nil {
		return nil, fmt.Errorf("store the upload: %w", err)
	}
	return &uploadedFile{role: role, name: name, path: p, size: int64(len(data))}, nil
}

// insideName is the file's name in its packed file as the check shows it: valid UTF-8, at
// most maxInsideName bytes.
func insideName(name string) string {
	name = strings.ToValidUTF8(name, "?")
	if len(name) <= maxInsideName {
		return name
	}
	name = name[:maxInsideName]
	for !utf8.ValidString(name) {
		name = name[:len(name)-1]
	}
	return name + "..."
}

// checksum checks the file against its line in SHA256SUMS (by name, else by checksum: the
// same file saved under another name) and against the SHA-256 the owner typed, which may
// be that of the file or, for a packed file, that of the packed file. A file checked by
// neither passes with "Checksum: not given".
func (c *checker) checksum(_ context.Context, res *UpdateCheck) (string, error) {
	f := c.files.update
	subject, object, name := "The file", "this file", f.name
	if c.outer != nil {
		subject = "The file inside the " + res.PackedAs + " file"
		object, name = "the file inside the "+res.PackedAs+" file", c.insideName
	}
	var checked []string
	if s := c.files.sums; s != nil {
		data, err := os.ReadFile(s.path)
		if err != nil {
			return "", fmt.Errorf("read the uploaded %s: %w", maintreq.SumsFileName, err)
		}
		sums, err := release.ParseSums(data)
		if err != nil {
			return "", err // AddFile parsed it
		}
		c.sumsData = data
		line, listed := release.MatchSum(sums, name, f.sha256)
		switch {
		case line == "" && listed:
			res.Checksum = ChecksumMismatch
			return subject + " does not match its line in SHA256SUMS: it is damaged, or not the file the developer built. " +
				"Download it again.", nil
		case line == "" && c.typed == "":
			return "SHA256SUMS does not list " + object + ", so it cannot be checked. Add the SHA256SUMS of the same release, or " +
				"type the file's SHA-256.", nil
		case line == "":
			res.Warnings = append(res.Warnings, "SHA256SUMS does not list "+object+"; the SHA-256 you typed was checked instead.")
		default:
			c.sumsLine = line
			if c.sumsInside {
				checked = append(checked, maintreq.SumsFileName+" inside the "+res.PackedAs+" file")
			} else {
				checked = append(checked, maintreq.SumsFileName)
			}
			if line != name {
				res.Warnings = append(res.Warnings, "SHA256SUMS lists "+object+" as "+line+".")
			}
		}
	}
	if c.typed != "" {
		switch {
		case c.typed == f.sha256:
			checked = append(checked, "the SHA-256 you typed")
		case c.outer != nil && c.typed == c.outer.sha256:
			checked = append(checked, "the SHA-256 you typed for the "+res.PackedAs+" file")
		default:
			res.Checksum = ChecksumMismatch
			return "The file does not match the SHA-256 you typed: it is damaged, or not the file the developer built. " +
				"Download it again, or check the SHA-256.", nil
		}
	}
	if len(checked) == 0 {
		res.Warnings = append(res.Warnings, "The file was not checked against a checksum: add SHA256SUMS from the release, "+
			"or type the SHA-256 the developer gave you.")
		return "", nil
	}
	res.Checksum, res.ChecksumSource = ChecksumMatches, strings.Join(checked, " and ")
	return "", nil
}

// signature checks SHA256SUMS.sig over SHA256SUMS with the release keys of this build
// (release.CheckSignature): "not signed" without a signature or a key, "valid", or a
// refusal when no trusted key verifies it.
func (c *checker) signature(_ context.Context, res *UpdateCheck) (string, error) {
	var sig []byte
	if c.files.sig != nil {
		data, err := os.ReadFile(c.files.sig.path)
		if err != nil {
			return "", fmt.Errorf("read the uploaded %s: %w", maintreq.SigFileName, err)
		}
		sig = data
	}
	s, err := release.CheckSignature(c.sumsData, sig)
	if err != nil {
		res.Signature = SignatureInvalid
		return fmt.Sprintf("SHA256SUMS.sig does not verify (%s): the files were changed after the developer signed them, or "+
			"they come from someone else. Do not install them.", err), nil
	}
	if s == release.SignatureValid && c.sumsLine == "" {
		res.Signature = SignatureInvalid
		return "The signed SHA256SUMS does not list this file, so its signature does not cover it. Upload the file of the same " +
			"release.", nil
	}
	res.Signature = s.String()
	return "", nil
}

// contents reads what the xdesign file says about its build, from its symbol table
// (internal/release), without running it.
func (c *checker) contents(_ context.Context, res *UpdateCheck) (string, error) {
	file, err := os.Open(c.files.update.path)
	if err != nil {
		return "", fmt.Errorf("read the upload: %w", err)
	}
	bin, err := release.InspectBinary(file)
	_ = file.Close() // read-only: closing cannot lose data
	if err != nil {
		return "This file is not an xdesign file: " + sentence(strings.TrimPrefix(err.Error(), release.ErrNotXDesign.Error()+": ")), nil
	}
	c.bin = bin
	res.Version, res.Commit, res.BuiltAt, res.Arch, res.DevelopmentBuild = bin.Version, bin.Commit, bin.BuiltAt, bin.Arch, bin.Dev
	res.MinUpgradeFrom, res.SchemaFloor = bin.MinUpgradeFrom, bin.SchemaFloor
	if bin.PayloadSHA256 == "" {
		return "This xdesign file carries no payload: it is a development build. Build a release with ./build.sh or make release.", nil
	}
	return "", nil
}

// versionRules applies the version rules of section 6.3 step 2: the server's system (an
// ELF file for Linux, a PE file for Windows) and CPU; a
// release only newer than the running release, which must be min_upgrade_from or newer; a
// development build only over a development build; and anything over a development build.
func (c *checker) versionRules(_ context.Context, res *UpdateCheck) (string, error) {
	b, cur := c.bin, c.u.build.Version
	if b.OS != runtime.GOOS {
		return SystemRefusal(b.OS), nil
	}
	if b.Arch != c.u.build.Arch {
		return fmt.Sprintf("This file is for %s, but this server is %s. Upload the %s file instead.", b.Arch, c.u.build.Arch,
			c.u.build.Arch), nil
	}
	curDev := !isReleaseVersion(cur)
	switch {
	case b.Version == cur:
		return fmt.Sprintf("This is xDesign %s, which runs already.", cur), nil
	case b.Dev && !curDev:
		return fmt.Sprintf("This is a development build (%s), which installs only over a development build; this server runs the "+
			"release %s.", b.Version, cur), nil
	case curDev:
		res.Warnings = append(res.Warnings, fmt.Sprintf("A development build runs (%s), so neither the version order nor the oldest "+
			"version xDesign %s updates from is checked.", cur, b.Version))
		res.Rows = append(res.Rows, cur+" to "+b.Version, "System: "+platform.Name, "CPU: "+b.Arch, "Checksum: "+res.Checksum,
			"Signature: "+res.Signature)
		return "", nil
	}
	cmp, err := buildinfo.CompareVersions(b.Version, cur)
	switch {
	case err != nil:
		return fmt.Sprintf("xDesign %s cannot be compared with the running %s.", b.Version, cur), nil //nolint:nilerr // a refusal: the check itself did not fail
	case cmp < 0:
		return fmt.Sprintf("This is xDesign %s, older than the running %s. Use Go back to return to it.", b.Version, cur), nil
	}
	if cmp, err := buildinfo.CompareVersions(cur, b.MinUpgradeFrom); err == nil && cmp < 0 {
		return fmt.Sprintf("xDesign %s updates installations of %s or newer, and this server runs %s. Update to %s first, then to %s.",
			b.Version, b.MinUpgradeFrom, cur, b.MinUpgradeFrom, b.Version), nil
	}
	if cmp, err := buildinfo.CompareVersions(cur, b.SchemaFloor); err == nil && cmp < 0 {
		res.Warnings = append(res.Warnings, fmt.Sprintf("After this update, going back to %s needs the backup the update makes first: "+
			"xDesign %s changes the database in a way %s cannot read.", cur, b.Version, cur))
	}
	res.Rows = append(res.Rows, cur+" to "+b.Version, "System: "+platform.Name, "CPU: "+b.Arch, "Checksum: "+res.Checksum,
		"Signature: "+res.Signature)
	return "", nil
}

// SystemRefusal refuses a file for the other system
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.6): "This file is for Linux; this
// server runs Windows." goos is the file's system (release.Binary's OS).
func SystemRefusal(goos string) string {
	return "This file is for " + release.SystemName(goos) + "; this server runs " + platform.Name + "."
}

// space checks the free space: the new release plus 100 MB under the program folder
// (programWords), and the database and the media for the backup the update makes first.
// serve --dev installs nothing, so it checks the file only.
func (c *checker) space(_ context.Context, res *UpdateCheck) (string, error) {
	cur := c.u.build.Version
	if c.u.dev {
		res.Warnings = append(res.Warnings, "Updates are installed on a server: xdesign serve --dev only checks the file.")
		res.Rows = append(res.Rows, "Can update from "+cur+": yes")
		return "", nil
	}
	optFree, err := freeSpaceOf(releasesDir)
	if err != nil {
		return "", fmt.Errorf("check the free space under %s: %w", programWords, err)
	}
	if need := c.files.update.size*releaseFactor + optMargin; optFree < need {
		return fmt.Sprintf("There is not enough free space under %s: %s free, and the new release needs %s. Free some space, "+
			"then check the file again.", programWords, formatBytes(optFree), formatBytes(need)), nil
	}
	site := siteSize(c.u.dataDir)
	dataFree, err := freeSpaceOf(c.u.dataDir)
	if err != nil {
		return "", fmt.Errorf("check the free space for the backup: %w", err)
	}
	if need := site + backupMargin; dataFree < need {
		return fmt.Sprintf("There is not enough free space for the backup the update makes first in %s: %s free, about %s "+
			"needed (the database and the media). Delete old backups in Maintenance > Backups, then check the file again.",
			c.u.dataDir, formatBytes(dataFree), formatBytes(need)), nil
	}
	res.Rows = append(res.Rows, "Disk space: enough", "Can update from "+cur+": yes")
	return "", nil
}

// isReleaseVersion reports whether v is a release version X.Y.Z.
func isReleaseVersion(v string) bool {
	sv, err := buildinfo.ParseVersion(v)
	return err == nil && sv.IsRelease()
}

// sentence ends text with a full stop.
func sentence(text string) string {
	text = strings.TrimSpace(text)
	if text == "" || strings.HasSuffix(text, ".") {
		return text
	}
	return text + "."
}
