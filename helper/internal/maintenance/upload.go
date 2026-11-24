package maintenance

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"

	"github.com/Sir-MmD/xdesign/helper/internal/maintreq"
	"github.com/Sir-MmD/xdesign/helper/internal/release"
)

// The files of an update upload (section 6.2 step 1): the xdesign file, or a tar.gz, zip,
// tar.xz or tar.zst file that holds it, told by its first bytes (ELF, gzip, zip and the
// like), and SHA256SUMS and SHA256SUMS.sig, told by their content, so a browser that renamed
// a download ("SHA256SUMS (1)") changes nothing. They are stored under the names the
// helper takes: the xdesign file under its own name made safe, the others as SHA256SUMS
// and SHA256SUMS.sig. A packed file is opened by the check (checker.unpack), which keeps the
// xdesign file inside under a name of its own and removes the packed file, so the root
// helper only ever sees a plain xdesign file. Copied from xWriter's update_upload.go.

const (
	// sshSigBegin starts an armored SSH signature, SHA256SUMS.sig.
	sshSigBegin = "-----BEGIN SSH SIGNATURE-----"
	// maxUploadFiles is how many files one check takes: the xdesign file, SHA256SUMS and
	// SHA256SUMS.sig.
	maxUploadFiles = 3
)

// fileRole is what an uploaded file is.
type fileRole int

const (
	roleUpdate fileRole = iota + 1
	roleSums
	roleSig
)

// unsafeNameChars are the characters the helper does not take in an upload's file name.
var unsafeNameChars = regexp.MustCompile(`[^A-Za-z0-9._+-]`)

// Upload is an update being uploaded for a check, in its own folder of the maintenance
// folder (never /tmp). It is safe for concurrent use.
type Upload struct {
	id  string
	dir string
	// release ends the upload's hold on its folder (Updates.hold).
	release func()
	mu      sync.Mutex
	files   []*uploadedFile
}

// uploadedFile is one stored file of an upload.
type uploadedFile struct {
	role fileRole
	// name is the name it is stored under in the upload's folder.
	name string
	path string
	size int64
	// kind and sha256 are those of the xdesign file. A packed file has the kind
	// release.KindPacked until the check opens it (checker.unpack), which then replaces it
	// by the file inside.
	kind   release.Kind
	sha256 string
}

// uploadFiles are the stored files of an upload by their role.
type uploadFiles struct {
	update, sums, sig *uploadedFile
}

// BeginUpload starts an upload of size bytes, the request's Content-Length (-1 when it is
// not known). It refuses one larger than the largest update with its two small files,
// and one the file system of the data folder has no room for, before anything is
// stored; and a third upload while two arrive. Uploads whose time ended are removed first.
func (u *Updates) BeginUpload(size int64) (*Upload, error) {
	u.PruneUploads()
	if size > maintreq.MaxUploadFile+2*maintreq.MaxFileSize+multipartSlack {
		return nil, refused(RefusedTooLarge, "The upload is too large: an xdesign file has at most %d MiB.", maintreq.MaxUploadFile>>20)
	}
	if u.arriving() >= maxUploadsAtOnce {
		return nil, refused(RefusedNotNow, "Two files are being uploaded already. Wait for them to finish.")
	}
	root := u.uploadsDir()
	if err := os.MkdirAll(root, 0o700); err != nil {
		return nil, fmt.Errorf("create the folder of the update uploads: %w", err)
	}
	free, err := freeSpaceOf(root)
	if err != nil {
		return nil, fmt.Errorf("check the free space of the data folder: %w", err)
	}
	want := size
	if want < 0 {
		want = maintreq.MaxUploadFile // the length is not known: the largest file
	}
	if free < want+uploadDiskMargin {
		return nil, refused(RefusedTooLarge, "The server does not have enough free space for the upload (%s free in %s, and %s must "+
			"stay free). Free some space, then upload the file again.", formatBytes(free), u.dataDir, formatBytes(uploadDiskMargin))
	}
	id := maintreq.NewID()
	release := u.hold(id, true)
	dir := filepath.Join(root, id)
	if err := os.Mkdir(dir, 0o700); err != nil {
		release()
		return nil, fmt.Errorf("create the folder of the upload: %w", err)
	}
	return &Upload{id: id, dir: dir, release: release}, nil
}

// AddFile stores one uploaded file, sent as name, from r: the xdesign file, or a packed
// file that holds it (at most maintreq.MaxUploadFile), SHA256SUMS or SHA256SUMS.sig (at most
// maintreq.MaxFileSize each). Anything else, a second file of a kind and a fourth file are
// refused, a file above its limit too; the caller then aborts the upload.
func (up *Upload) AddFile(name string, r io.Reader) error {
	up.mu.Lock()
	n := len(up.files)
	up.mu.Unlock()
	if n >= maxUploadFiles {
		return refused(RefusedInvalid, "Choose at most three files: the xdesign file, SHA256SUMS and SHA256SUMS.sig.")
	}
	br := bufio.NewReaderSize(r, 4096)
	head, _ := br.Peek(release.KindHeadLen) // a shorter file shows all it has
	f := &uploadedFile{kind: release.DetectKind(head)}
	limit := int64(maintreq.MaxFileSize)
	switch {
	case f.kind == release.KindBinary || f.kind == release.KindPacked:
		f.role, limit = roleUpdate, maintreq.MaxUploadFile
	case bytes.HasPrefix(head, []byte(sshSigBegin)):
		f.role = roleSig
	default:
		f.role = roleSums // checked once stored
	}
	// A file taken for SHA256SUMS is checked for a second one once its content passed.
	if f.role != roleSums && up.has(f.role) {
		return duplicateFile(f.role)
	}
	f.path = filepath.Join(up.dir, fmt.Sprintf(".part-%d", n))
	out, err := os.OpenFile(f.path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return fmt.Errorf("store the upload: %w", err)
	}
	h := sha256.New()
	f.size, err = io.Copy(io.MultiWriter(out, h), io.LimitReader(br, limit+1))
	if err == nil {
		err = out.Sync()
	}
	if cerr := out.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return fmt.Errorf("store the upload: %w", err)
	}
	if f.size > limit {
		if f.role == roleUpdate {
			return refused(RefusedTooLarge, "%s is larger than %d MiB, more than an xdesign file has.", displayName(name),
				maintreq.MaxUploadFile>>20)
		}
		return notAnUpdateFile(name)
	}
	f.sha256 = hex.EncodeToString(h.Sum(nil))
	switch f.role {
	case roleUpdate:
		f.name = safeFileName(name)
	case roleSums:
		data, err := os.ReadFile(f.path)
		if err != nil {
			return fmt.Errorf("store the upload: %w", err)
		}
		if _, err := release.ParseSums(data); err != nil {
			return notAnUpdateFile(name)
		}
		if up.has(roleSums) {
			return duplicateFile(roleSums)
		}
		f.name = maintreq.SumsFileName
	case roleSig:
		f.name = maintreq.SigFileName
	}
	final := filepath.Join(up.dir, f.name)
	if err := os.Rename(f.path, final); err != nil {
		return fmt.Errorf("store the upload: %w", err)
	}
	f.path = final
	up.mu.Lock()
	up.files = append(up.files, f)
	up.mu.Unlock()
	return nil
}

// Abort removes the upload and everything stored for it.
func (up *Upload) Abort() {
	_ = os.RemoveAll(up.dir) // best effort: PruneUploads removes leftovers later
	up.release()
}

// has reports whether a file of role is stored.
func (up *Upload) has(role fileRole) bool {
	up.mu.Lock()
	defer up.mu.Unlock()
	for _, f := range up.files {
		if f.role == role {
			return true
		}
	}
	return false
}

// stored returns the stored files by their role, once every file arrived: exactly one
// xdesign file, and SHA256SUMS.sig only with SHA256SUMS.
func (up *Upload) stored() (uploadFiles, error) {
	up.mu.Lock()
	defer up.mu.Unlock()
	var fs uploadFiles
	for _, f := range up.files {
		switch f.role {
		case roleUpdate:
			fs.update = f
		case roleSums:
			fs.sums = f
		case roleSig:
			fs.sig = f
		}
	}
	switch {
	case fs.update == nil:
		return fs, refused(RefusedInvalid, "Choose the new xdesign file.")
	case fs.sig != nil && fs.sums == nil:
		return fs, refused(RefusedInvalid, "SHA256SUMS.sig signs SHA256SUMS: add SHA256SUMS too.")
	}
	return fs, nil
}

// roleWords names a kind of uploaded file for the owner.
func roleWords(role fileRole) string {
	switch role {
	case roleUpdate:
		return "xdesign file"
	case roleSums:
		return "SHA256SUMS file"
	case roleSig:
		return "SHA256SUMS.sig file"
	}
	return "file"
}

// duplicateFile refuses a second file of role.
func duplicateFile(role fileRole) error {
	return refused(RefusedInvalid, "Choose one %s only.", roleWords(role))
}

// notAnUpdateFile refuses a file that is none of the three an update takes.
func notAnUpdateFile(name string) error {
	return refused(RefusedInvalid, "%s is not an xdesign file, a tar.gz, zip, tar.xz or tar.zst file that holds one, SHA256SUMS or "+
		"SHA256SUMS.sig.", displayName(name))
}

// displayName is the name a file was sent with, made printable for a message.
func displayName(name string) string {
	name = strings.TrimSpace(strings.ToValidUTF8(name, "?"))
	if name == "" {
		return "A file"
	}
	if len(name) > 100 {
		name = name[:100] + "..."
	}
	return name
}

// safeFileName is the name the xdesign file is stored under: the name it was sent with,
// with the characters the helper does not take replaced by "_", starting with a letter or
// a digit, at most 200 characters, never the name of another file of the upload; or
// xdesign when nothing is left. SHA256SUMS lists a file by name, but the check also finds
// a renamed file by its checksum.
func safeFileName(name string) string {
	s := unsafeNameChars.ReplaceAllString(name, "_")
	s = strings.TrimLeftFunc(s, func(r rune) bool {
		return (r < 'a' || r > 'z') && (r < 'A' || r > 'Z') && (r < '0' || r > '9')
	})
	if len(s) > 200 {
		s = s[:200]
	}
	if s == "" || s == maintreq.SumsFileName || s == maintreq.SigFileName {
		return "xdesign"
	}
	return s
}
