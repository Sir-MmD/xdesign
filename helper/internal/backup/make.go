package backup

import (
	"archive/tar"
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"hash"
	"io"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"syscall"
	"time"

	"github.com/klauspost/compress/zstd"
	_ "modernc.org/sqlite" // the pure-Go SQLite driver "sqlite"

	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// Modes of the backups (section 5.1): files 0600 in a folder 0700.
const (
	fileMode = 0o600
	dirMode  = 0o700
)

// FolderName is the backups' folder: in the data folder on Linux, beside it on Windows
// ([Options.Dir]).
const FolderName = "backups"

// lockName is the lock file in the backups' folder: one backup or restore at a time.
const lockName = ".lock"

// busyTimeout is how long VACUUM INTO waits for the app's writes.
const busyTimeout = 30 * time.Second

// ErrBusy is returned while another backup or restore runs.
var ErrBusy = errors.New("a backup is being made or restored now: try again when it is done")

// Options say where a site's data is.
type Options struct {
	// DataDir is the data folder, /var/lib/xdesign: xdesign.db, media/ and backups/ (on
	// Windows C:\ProgramData\xDesign\data, with the backups beside it).
	DataDir string
	// ConfigPath is the settings file, /etc/xdesign/config.toml; "" or a missing file
	// leaves it out (serve --dev has none).
	ConfigPath string
	// CertsDir is the HTTPS manager's folder, /var/lib/xdesign/certs; a missing folder is
	// backed up empty.
	CertsDir string
	// Version is this xDesign's.
	Version string
	// Now returns the time; nil is time.Now.
	Now func() time.Time
}

func (o Options) now() time.Time {
	if o.Now != nil {
		return o.Now()
	}
	return time.Now()
}

// Result is what Make made.
type Result struct {
	// Backup is the new backup; Path its archive.
	Backup Entry  `json:"backup"`
	Path   string `json:"path"`
	// Deleted are the backups the retention deleted after it.
	Deleted []string `json:"deleted"`
}

// Make makes a backup of kind now (section 5.1 and 5.2): the copy of the database, the
// archive under its partial name, the rename, the metadata file last, then the retention.
func Make(ctx context.Context, o Options, kind Kind) (Result, error) {
	if !kind.Valid() {
		return Result{}, fmt.Errorf("unknown kind of backup %q", kind)
	}
	dir := o.Dir()
	owner, err := ensureDir(o.DataDir, dir)
	if err != nil {
		return Result{}, err
	}
	unlock, err := lock(dir, owner)
	if err != nil {
		return Result{}, err
	}
	defer unlock()
	return makeLocked(ctx, o, kind, owner, true)
}

// makeLocked is Make once the lock is taken (Restore takes it for its whole run); retain
// runs the retention after the backup.
func makeLocked(ctx context.Context, o Options, kind Kind, w *owner, retain bool) (Result, error) {
	dir := o.Dir()
	m := &maker{o: o, dir: dir, owner: w}
	defer m.removeWritten()
	res, err := m.run(ctx, kind)
	if err != nil || !retain {
		return res, err
	}
	res.Deleted, err = prune(dir, o.now())
	return res, err
}

// owner is the user and group the files get when root writes them; nil when the process
// is not root, and always on Windows (dataOwner).
type owner struct{ uid, gid int }

// chown gives path to the owner; nothing when the process is not root.
func (w *owner) chown(path string) error {
	if w == nil {
		return nil
	}
	if err := os.Lchown(path, w.uid, w.gid); err != nil {
		return fmt.Errorf("give %s to the service user: %w", path, err)
	}
	return nil
}

// ensureDir makes the backups' folder 0700 when it is missing and returns the owner of
// root's files.
func ensureDir(dataDir, dir string) (*owner, error) {
	w, err := dataOwner(dataDir)
	if err != nil {
		return nil, err
	}
	if err := os.Mkdir(dir, dirMode); err != nil && !errors.Is(err, fs.ErrExist) {
		return nil, fmt.Errorf("the backups' folder: %w", err)
	}
	if err := os.Chmod(dir, dirMode); err != nil {
		return nil, fmt.Errorf("the backups' folder: %w", err)
	}
	if err := w.chown(dir); err != nil {
		return nil, err
	}
	return w, nil
}

// lock takes the lock file of dir, or returns ErrBusy. Root gives the file to w each time,
// also one an earlier root run left its own: the xdesign user's daily backup must open it.
func lock(dir string, w *owner) (func(), error) {
	p := filepath.Join(dir, lockName)
	f, err := os.OpenFile(p, os.O_RDWR|os.O_CREATE, fileMode) //nolint:gosec // G304: the backups' own lock file
	if err != nil {
		return nil, fmt.Errorf("the backups' lock: %w", err)
	}
	if err := w.chown(p); err != nil {
		_ = f.Close() // only opened
		return nil, err
	}
	if err := platform.TryLock(f); err != nil {
		_ = f.Close() // only opened
		if errors.Is(err, platform.ErrLocked) {
			return nil, ErrBusy
		}
		return nil, fmt.Errorf("the backups' lock: %w", err)
	}
	return func() { _ = f.Close() }, nil // closing releases the lock
}

// Running reports whether a backup or a restore holds the lock of dir now. It never
// creates the lock file: one that root made (sudo xdesign status, set-port) would keep the
// xdesign user's backups out. Without the file no backup ever ran there. A link in the
// lock file's place is refused (on Windows a symbolic link or a junction).
func Running(dir string) bool {
	p := filepath.Join(dir, lockName)
	f, err := os.OpenFile(p, os.O_RDONLY|platform.NoFollow|syscall.O_NONBLOCK, 0) //nolint:gosec // G304: the backups' own lock file
	if err != nil {
		return false
	}
	defer func() { _ = f.Close() }() // closing releases a lock taken here
	if platform.RefuseLink(f) != nil {
		return false
	}
	return errors.Is(platform.TryLock(f), platform.ErrLocked)
}

// maker is one run of Make.
type maker struct {
	o     Options
	dir   string
	owner *owner
	// written are the partial files to remove when the run stops halfway.
	written []string
}

// source is one member to pack: a file on disk, or the content of the settings file.
type source struct {
	File
	disk string
	data []byte
}

func (m *maker) run(ctx context.Context, kind Kind) (Result, error) {
	now := m.o.now().UTC().Truncate(time.Second)
	name, err := m.freeName(stem(kind, m.o.Version, now))
	if err != nil {
		return Result{}, err
	}
	meta := Meta{Format: Format, Name: name, Version: m.o.Version, CreatedAt: now, Kind: kind, System: system}
	dbCopy := m.partial(name + ".db")
	if err := vacuumInto(ctx, filepath.Join(m.o.DataDir, DatabaseName), dbCopy); err != nil {
		return Result{}, err
	}
	sources, err := m.collect(dbCopy)
	if err != nil {
		return Result{}, err
	}
	meta.Parts = []Part{{Name: PartDatabase}, {Name: PartConfig}, {Name: PartMedia}, {Name: PartCerts}}
	for _, s := range sources {
		meta.Files = append(meta.Files, s.File)
		part, _ := partOf(s.Path)
		p := &meta.Parts[slices.IndexFunc(meta.Parts, func(p Part) bool { return p.Name == part })]
		p.Size += s.Size
		p.Files++
	}
	if err := meta.Validate(); err != nil {
		return Result{}, fmt.Errorf("the backup cannot be made: %w", err)
	}
	archive := filepath.Join(m.dir, name+Ext)
	sum, err := m.writeArchive(ctx, meta, sources, archive)
	if err != nil {
		return Result{}, err
	}
	_ = os.Remove(dbCopy) // packed; removeWritten retries
	meta.Archive = &sum
	data, err := meta.encode()
	if err != nil {
		return Result{}, err
	}
	if err := m.writeFile(name+MetaExt, data); err != nil {
		return Result{}, err
	}
	m.written = nil
	return Result{Backup: entryOf(meta, name+Ext), Path: archive}, nil
}

// freeName returns name, or name-2, name-3 and so on when a backup of that name exists.
func (m *maker) freeName(name string) (string, error) {
	for i := 1; i < 100; i++ {
		n := name
		if i > 1 {
			n = name + "-" + strconv.Itoa(i)
		}
		_, errA := os.Lstat(filepath.Join(m.dir, n+Ext))
		_, errM := os.Lstat(filepath.Join(m.dir, n+MetaExt))
		if errors.Is(errA, fs.ErrNotExist) && errors.Is(errM, fs.ErrNotExist) {
			return n, nil
		}
	}
	return "", fmt.Errorf("found no free name for the backup %s in %s", name, m.dir)
}

// vacuumInto writes a consistent copy of the database db to out with VACUUM INTO, while
// the app may write to it (WAL mode).
func vacuumInto(ctx context.Context, db, out string) error {
	if _, err := os.Stat(db); err != nil {
		return fmt.Errorf("the database: %w", err)
	}
	// mode=rw never creates an empty database where the file went missing. A Windows path
	// is written file:/C:/..., which SQLite opens as C:\...
	p := filepath.ToSlash(db)
	if filepath.VolumeName(db) != "" {
		p = "/" + p
	}
	dsn := "file:" + (&url.URL{Path: p}).EscapedPath() + "?mode=rw&_pragma=busy_timeout(" +
		strconv.Itoa(int(busyTimeout/time.Millisecond)) + ")"
	conn, err := sql.Open("sqlite", dsn)
	if err != nil {
		return fmt.Errorf("open the database: %w", err)
	}
	defer func() { _ = conn.Close() }() // read only: closing cannot lose data
	conn.SetMaxOpenConns(1)
	if _, err := conn.ExecContext(ctx, "VACUUM INTO ?", out); err != nil {
		return fmt.Errorf("copy the database with VACUUM INTO: %w", err)
	}
	if err := os.Chmod(out, fileMode); err != nil {
		return fmt.Errorf("the database's copy: %w", err)
	}
	return nil
}

// collect lists the members with their sizes and SHA-256 in the order of the archive:
// the database's copy, the settings file, the media (without media/tmp, where uploads are
// written) and the certificates. Only regular files are taken.
func (m *maker) collect(dbCopy string) ([]source, error) {
	db, err := hashFile(dbCopy)
	if err != nil {
		return nil, err
	}
	sources := []source{{File: File{Path: DatabaseName, Size: db.Size, SHA256: db.SHA256}, disk: dbCopy}}
	if m.o.ConfigPath != "" {
		data, err := os.ReadFile(m.o.ConfigPath)
		switch {
		case errors.Is(err, fs.ErrNotExist):
		case err != nil:
			return nil, fmt.Errorf("read the settings: %w", err)
		default:
			h := sha256.Sum256(data)
			sources = append(sources, source{File: File{Path: ConfigName, Size: int64(len(data)), SHA256: hex.EncodeToString(h[:])},
				data: data})
		}
	}
	for _, tree := range []struct{ name, dir string }{{MediaDir, filepath.Join(m.o.DataDir, MediaDir)}, {CertsDir, m.o.CertsDir}} {
		if tree.dir == "" {
			continue
		}
		files, err := walkTree(tree.name, tree.dir)
		if err != nil {
			return nil, err
		}
		sources = append(sources, files...)
	}
	return sources, nil
}

// walkTree lists the regular files below dir as <name>/<path>, sorted, with their sums;
// links and other files are left out, and so is media/tmp.
func walkTree(name, dir string) ([]source, error) {
	var out []source
	err := filepath.WalkDir(dir, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			if p == dir && errors.Is(err, fs.ErrNotExist) {
				return filepath.SkipDir
			}
			return err
		}
		rel, err := filepath.Rel(dir, p)
		if err != nil {
			return err //nolint:wrapcheck // wrapped below
		}
		member := name + "/" + filepath.ToSlash(rel)
		if d.IsDir() {
			if name == MediaDir && rel == "tmp" {
				return filepath.SkipDir
			}
			return nil
		}
		if !d.Type().IsRegular() {
			return nil
		}
		if part, _ := partOf(member); part == "" {
			return fmt.Errorf("the file %s cannot be backed up: its name is not allowed in a backup", p)
		}
		sum, err := hashFile(p)
		if err != nil {
			return err
		}
		out = append(out, source{File: File{Path: member, Size: sum.Size, SHA256: sum.SHA256}, disk: p})
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", dir, err)
	}
	return out, nil
}

// hashFile returns the size and SHA-256 of a file.
func hashFile(p string) (Sum, error) {
	f, err := os.Open(p) //nolint:gosec // G304: a file of the site's data
	if err != nil {
		return Sum{}, fmt.Errorf("read %s: %w", p, err)
	}
	defer func() { _ = f.Close() }() // read only
	h := sha256.New()
	n, err := io.Copy(h, f)
	if err != nil {
		return Sum{}, fmt.Errorf("read %s: %w", p, err)
	}
	return Sum{Size: n, SHA256: hex.EncodeToString(h.Sum(nil))}, nil
}

// hashingWriter counts and hashes what goes through it.
type hashingWriter struct {
	w io.Writer
	h hash.Hash
	n int64
}

func (hw *hashingWriter) Write(p []byte) (int, error) {
	n, err := hw.w.Write(p)
	_, _ = hw.h.Write(p[:n]) // a hash never fails
	hw.n += int64(n)
	return n, err //nolint:wrapcheck // the file's own error, wrapped by the caller
}

// writeArchive writes the archive under its partial name and renames it, and returns its
// size and SHA-256. A file whose content no longer matches its sum stops it: the media
// changed while the backup ran.
func (m *maker) writeArchive(ctx context.Context, meta Meta, sources []source, final string) (Sum, error) {
	head, err := meta.encode()
	if err != nil {
		return Sum{}, err
	}
	partial := m.partial(filepath.Base(final))
	f, err := os.OpenFile(partial, os.O_WRONLY|os.O_CREATE|os.O_EXCL, fileMode) //nolint:gosec // G304: in the backups' folder
	if err != nil {
		return Sum{}, fmt.Errorf("write the backup: %w", err)
	}
	defer func() { _ = f.Close() }() // closed below; this one only after an error
	hw := &hashingWriter{w: f, h: sha256.New()}
	zw, err := zstd.NewWriter(hw, zstd.WithEncoderConcurrency(1))
	if err != nil {
		return Sum{}, fmt.Errorf("write the backup: %w", err)
	}
	tw := tar.NewWriter(zw)
	mtime := meta.CreatedAt
	if err := writeMember(tw, MetaName, mtime, int64(len(head)), bytes.NewReader(head), ""); err != nil {
		return Sum{}, err
	}
	for _, s := range sources {
		if err := ctx.Err(); err != nil {
			return Sum{}, fmt.Errorf("the backup stopped: %w", err)
		}
		if s.data != nil {
			err = writeMember(tw, s.Path, mtime, s.Size, bytes.NewReader(s.data), s.SHA256)
		} else {
			err = writeDiskMember(tw, s, mtime)
		}
		if err != nil {
			return Sum{}, err
		}
	}
	if err := tw.Close(); err != nil {
		return Sum{}, fmt.Errorf("write the backup: %w", err)
	}
	if err := zw.Close(); err != nil {
		return Sum{}, fmt.Errorf("write the backup: %w", err)
	}
	if err := f.Sync(); err != nil {
		return Sum{}, fmt.Errorf("write the backup: %w", err)
	}
	if err := f.Close(); err != nil {
		return Sum{}, fmt.Errorf("write the backup: %w", err)
	}
	if err := m.rename(partial, final); err != nil {
		return Sum{}, err
	}
	return Sum{Size: hw.n, SHA256: hex.EncodeToString(hw.h.Sum(nil))}, nil
}

// writeDiskMember packs a file of the site's data, which must still have its size and sum.
func writeDiskMember(tw *tar.Writer, s source, mtime time.Time) error {
	f, err := os.Open(s.disk)
	if err != nil {
		return fmt.Errorf("%s changed while the backup ran (%w): make the backup again", s.Path, err)
	}
	defer func() { _ = f.Close() }() // read only
	return writeMember(tw, s.Path, mtime, s.Size, f, s.SHA256)
}

// writeMember writes one regular file of size bytes from r; when want is set, the content
// must have that SHA-256.
func writeMember(tw *tar.Writer, name string, mtime time.Time, size int64, r io.Reader, want string) error {
	hdr := &tar.Header{Typeflag: tar.TypeReg, Name: name, Size: size, Mode: fileMode, ModTime: mtime, Format: tar.FormatPAX}
	if err := tw.WriteHeader(hdr); err != nil {
		return fmt.Errorf("write the backup: %w", err)
	}
	h := sha256.New()
	n, err := io.Copy(tw, io.TeeReader(io.LimitReader(r, size), h))
	if err != nil {
		return fmt.Errorf("write %s into the backup: %w", name, err)
	}
	if n != size || (want != "" && hex.EncodeToString(h.Sum(nil)) != want) {
		return fmt.Errorf("%s changed while the backup ran: make the backup again", name)
	}
	return nil
}

// partial returns the partial name of a file in the backups' folder.
func (m *maker) partial(name string) string {
	p := filepath.Join(m.dir, "."+name+partialExt)
	m.written = append(m.written, p)
	return p
}

// rename puts a complete file under its name, gives it to the service user and syncs the
// folder.
func (m *maker) rename(partial, final string) error {
	if err := m.owner.chown(partial); err != nil {
		return err
	}
	if err := os.Rename(partial, final); err != nil {
		return fmt.Errorf("write the backup: %w", err)
	}
	m.written = append(m.written, final)
	return syncDir(m.dir)
}

// writeFile writes name in the backups' folder under its partial name, then renames it.
func (m *maker) writeFile(name string, data []byte) error {
	partial := m.partial(name)
	if err := writeSynced(partial, data); err != nil {
		return err
	}
	return m.rename(partial, filepath.Join(m.dir, name))
}

// removeWritten removes the files of a run that stopped halfway; a finished run clears
// the list.
func (m *maker) removeWritten() {
	for _, p := range m.written {
		_ = os.Remove(p) // best effort: prune removes old partial files
	}
}

// writeSynced writes a new file 0600 and syncs it.
func writeSynced(p string, data []byte) error {
	f, err := os.OpenFile(p, os.O_WRONLY|os.O_CREATE|os.O_EXCL, fileMode) //nolint:gosec // G304: in the backups' folder
	if err != nil {
		return fmt.Errorf("write %s: %w", p, err)
	}
	if _, err := f.Write(data); err != nil {
		_ = f.Close()
		return fmt.Errorf("write %s: %w", p, err)
	}
	if err := f.Sync(); err != nil {
		_ = f.Close()
		return fmt.Errorf("write %s: %w", p, err)
	}
	if err := f.Close(); err != nil {
		return fmt.Errorf("write %s: %w", p, err)
	}
	return nil
}
