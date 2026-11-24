package backup

import (
	"archive/tar"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/klauspost/compress/zstd"

	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// Read's limits of the compressed stream.
const (
	// maxWindow bounds the zstd window, so a crafted file cannot ask for much memory; the
	// writer's default window is far below it.
	maxWindow = 64 << 20
	// maxTrailer bounds what may follow the tar archive.
	maxTrailer = 64 << 10
	// copyBuffer is the buffer of the checked copy.
	copyBuffer = 256 << 10
)

// ErrNotBackup and ErrDamaged are the errors of a file Read refuses.
var (
	// ErrNotBackup: the file is not an xDesign backup, or holds what a backup never does.
	ErrNotBackup = errors.New("this file is not an xDesign backup")
	// ErrDamaged: the file is a backup whose content does not match its metadata.
	ErrDamaged = errors.New("this backup is damaged")
)

// Handler receives what Read finds.
type Handler struct {
	// Meta is called with the checked metadata before any other member is read; its error
	// stops Read, which returns it as it is (a backup of a newer xDesign). Nil accepts
	// every backup.
	Meta func(m Meta) error
	// File returns where the content of f goes; a nil writer, or a nil File, discards it.
	// The content is checked either way, and the writer's errors stop Read.
	File func(f File) (io.Writer, error)
}

// Read checks the backup archive src member by member against its metadata (see the
// package documentation) and hands each member to h. It returns the metadata of a backup
// that passed every check; the errors wrap ErrNotBackup or ErrDamaged, or are h's.
func Read(src io.Reader, h Handler) (Meta, error) {
	zr, err := zstd.NewReader(src, zstd.WithDecoderMaxWindow(maxWindow), zstd.WithDecoderConcurrency(1))
	if err != nil {
		return Meta{}, fmt.Errorf("read the backup: %w", err)
	}
	defer zr.Close()
	tr := tar.NewReader(zr)
	m, err := readMeta(tr)
	if err != nil {
		return Meta{}, err
	}
	if h.Meta != nil {
		if err := h.Meta(m); err != nil {
			return m, err
		}
	}
	listed := make(map[string]File, len(m.Files))
	for _, f := range m.Files {
		listed[f.Path] = f
	}
	seen := map[string]bool{}
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return m, damaged(err)
		}
		f, err := checkHeader(hdr, listed, seen)
		if err != nil {
			return m, err
		}
		seen[f.Path] = true
		var w io.Writer
		if h.File != nil {
			if w, err = h.File(f); err != nil {
				return m, err
			}
		}
		if err := copyChecked(w, tr, f); err != nil {
			return m, err
		}
	}
	for _, f := range m.Files {
		if !seen[f.Path] {
			return m, fmt.Errorf("%w: %s is missing", ErrDamaged, f.Path)
		}
	}
	n, err := io.Copy(io.Discard, io.LimitReader(zr, maxTrailer+1))
	switch {
	case err != nil:
		return m, damaged(err)
	case n > maxTrailer:
		return m, fmt.Errorf("%w: it holds more data after the archive than a backup has", ErrNotBackup)
	}
	return m, nil
}

// readMeta reads the first member, which must be backup.json.
func readMeta(tr *tar.Reader) (Meta, error) {
	hdr, err := tr.Next()
	if err != nil {
		return Meta{}, fmt.Errorf("%w: it holds no backup archive (%s)", ErrNotBackup, err.Error())
	}
	if hdr.Name != MetaName || !regular(hdr) || sparse(hdr) {
		return Meta{}, fmt.Errorf("%w: it does not start with its metadata", ErrNotBackup)
	}
	if hdr.Size <= 0 || hdr.Size > MaxMetaSize {
		return Meta{}, fmt.Errorf("%w: its metadata has %d bytes", ErrNotBackup, hdr.Size)
	}
	data, err := io.ReadAll(io.LimitReader(tr, hdr.Size))
	if err != nil {
		return Meta{}, damaged(err)
	}
	m, err := ParseMeta(data)
	if err != nil {
		return Meta{}, fmt.Errorf("%w: %w", ErrNotBackup, err)
	}
	return m, nil
}

// checkHeader checks a member after the metadata: a regular file, not sparse, listed, not
// seen before, with a name that can be a file on this system and the listed size. Names
// are compared exactly with the listed ones, which Validate allowed only as clean relative
// paths of the parts, so absolute paths, "..", folders and links never pass.
func checkHeader(hdr *tar.Header, listed map[string]File, seen map[string]bool) (File, error) {
	switch {
	case sparse(hdr):
		return File{}, fmt.Errorf("%w: it holds %q as a sparse file", ErrNotBackup, hdr.Name)
	case !regular(hdr):
		return File{}, fmt.Errorf("%w: it holds %q, which is not a regular file", ErrNotBackup, hdr.Name)
	}
	f, ok := listed[hdr.Name]
	switch {
	case !ok:
		return File{}, fmt.Errorf("%w: it holds %q, which its metadata does not list", ErrNotBackup, hdr.Name)
	case seen[hdr.Name]:
		return File{}, fmt.Errorf("%w: it holds %s twice", ErrNotBackup, hdr.Name)
	case !localName(f.Path):
		return File{}, fmt.Errorf("%w: it holds %q, which cannot be a file's name on %s", ErrNotBackup, hdr.Name, platform.Name)
	case hdr.Size != f.Size:
		return File{}, fmt.Errorf("%w: %s has %d bytes, but the metadata says %d", ErrDamaged, hdr.Name, hdr.Size, f.Size)
	}
	return f, nil
}

// regular reports whether a tar header is a plain file.
func regular(hdr *tar.Header) bool {
	// '\x00' is the old spelling of a regular file (TypeRegA).
	return hdr.Typeflag == tar.TypeReg || hdr.Typeflag == '\x00'
}

// gnuSparsePrefix starts the PAX records of GNU sparse files.
const gnuSparsePrefix = "GNU.sparse."

// sparse reports whether a tar header describes a sparse file, whose holes archive/tar
// expands into zeros (a few bytes of archive could become a file of any size).
func sparse(hdr *tar.Header) bool {
	if hdr.Typeflag == tar.TypeGNUSparse {
		return true
	}
	for k := range hdr.PAXRecords {
		if strings.HasPrefix(k, gnuSparsePrefix) {
			return true
		}
	}
	return false
}

// copyChecked copies a member to w (nil discards it) and checks its size and SHA-256.
func copyChecked(w io.Writer, r io.Reader, f File) error {
	h := sha256.New()
	buf := make([]byte, copyBuffer)
	var total int64
	for {
		n, rerr := r.Read(buf)
		if n > 0 {
			total += int64(n)
			_, _ = h.Write(buf[:n]) // a hash never fails
			if w != nil {
				if _, err := w.Write(buf[:n]); err != nil {
					return err //nolint:wrapcheck // the handler's own error, as documented
				}
			}
		}
		if errors.Is(rerr, io.EOF) {
			break
		}
		if rerr != nil {
			return damaged(rerr)
		}
	}
	switch {
	case total != f.Size:
		return fmt.Errorf("%w: %s ends after %d of %d bytes", ErrDamaged, f.Path, total, f.Size)
	case hex.EncodeToString(h.Sum(nil)) != f.SHA256:
		return fmt.Errorf("%w: the SHA-256 of %s does not match its metadata", ErrDamaged, f.Path)
	}
	return nil
}

func damaged(err error) error {
	return fmt.Errorf("%w (%s)", ErrDamaged, err.Error())
}

// Open reads the backup archive at path with h (Read).
func Open(path string, h Handler) (Meta, error) {
	f, err := os.Open(path) //nolint:gosec // G304: the backup the owner named
	if err != nil {
		return Meta{}, fmt.Errorf("open the backup: %w", err)
	}
	defer func() { _ = f.Close() }() // read only
	fi, err := f.Stat()
	if err != nil {
		return Meta{}, fmt.Errorf("open the backup: %w", err)
	}
	if !fi.Mode().IsRegular() {
		return Meta{}, fmt.Errorf("%w: %s is not a file", ErrNotBackup, path)
	}
	return Read(f, h)
}

// Check reads the whole backup at path and returns its metadata, refusing a backup of an
// xDesign newer than current. config, when not nil, gets the backup's settings file.
func Check(path, current string, config io.Writer) (Meta, error) {
	return Open(path, Handler{
		Meta: func(m Meta) error { return CheckVersion(m, current) },
		File: func(f File) (io.Writer, error) {
			if f.Path == ConfigName {
				return config, nil
			}
			return nil, nil
		},
	})
}

// extract unpacks the backup at path into the new folder dest (0700): every file 0600,
// every folder 0700, given to w when root runs it, and syncs the file systems. The
// archive's own owners and modes are never used: on Windows the files take the folder's
// permissions. The checks of Read run on the way, so a refused backup leaves a partial
// folder, which the caller removes.
func extract(path, dest, current string, w *owner) (Meta, error) {
	if err := os.Mkdir(dest, dirMode); err != nil {
		return Meta{}, fmt.Errorf("unpack the backup: %w", err)
	}
	if err := w.chown(dest); err != nil {
		return Meta{}, err
	}
	var open *os.File
	closeOpen := func() error {
		if open == nil {
			return nil
		}
		f := open
		open = nil
		if err := f.Close(); err != nil {
			return fmt.Errorf("unpack the backup: %w", err)
		}
		return nil
	}
	defer func() { _ = closeOpen() }()
	m, err := Open(path, Handler{
		Meta: func(m Meta) error { return CheckVersion(m, current) },
		File: func(f File) (io.Writer, error) {
			if err := closeOpen(); err != nil {
				return nil, err
			}
			target := filepath.Join(dest, filepath.FromSlash(f.Path))
			if err := mkdirs(dest, filepath.Dir(target), w); err != nil {
				return nil, err
			}
			out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_EXCL, fileMode) //nolint:gosec // G304: a checked member name
			if err != nil {
				return nil, fmt.Errorf("unpack the backup: %w", err)
			}
			open = out
			if err := w.chown(target); err != nil {
				return nil, err
			}
			return out, nil
		},
	})
	if err != nil {
		return m, err
	}
	if err := closeOpen(); err != nil {
		return m, err
	}
	platform.SyncAll() // every unpacked file on disk before the swap, at once rather than file by file
	return m, nil
}

// mkdirs makes the folders from root down to dir, 0700, given to w.
func mkdirs(root, dir string, w *owner) error {
	rel, err := filepath.Rel(root, dir)
	if err != nil || rel == "." {
		return nil //nolint:nilerr // dir is root itself, which exists
	}
	p := root
	for _, el := range strings.Split(rel, string(filepath.Separator)) {
		p = filepath.Join(p, el)
		err := os.Mkdir(p, dirMode)
		switch {
		case errors.Is(err, fs.ErrExist):
			continue
		case err != nil:
			return fmt.Errorf("unpack the backup: %w", err)
		}
		if err := w.chown(p); err != nil {
			return err
		}
	}
	return nil
}
