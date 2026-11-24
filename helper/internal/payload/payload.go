package payload

import (
	"archive/tar"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path"
	"strings"

	"github.com/klauspost/compress/zstd"
)

// ErrNone is returned by [Open] for a build without a payload.
var ErrNone = errors.New("this xdesign file carries no payload: it is a development build; " +
	"build a release with ./build.sh or make release")

// Modes of what Extract writes, whatever the umask.
const (
	dirMode  fs.FileMode = 0o755
	fileMode fs.FileMode = 0o644
	execMode fs.FileMode = 0o755
)

// maxWindow bounds the zstd window the payload may ask for; build.sh packs it with zstd -19,
// which uses 8 MiB.
const maxWindow = 128 << 20

// Payload is the embedded payload, checked by [Open].
type Payload struct {
	data []byte
}

// Open returns the embedded payload after checking it against sha256Hex, the SHA-256 the
// release build stamped (buildinfo.PayloadSHA256). It returns [ErrNone] for a build without
// a payload, and an error when the payload is not the one the build stamped.
func Open(sha256Hex string) (Payload, error) {
	data := embedded()
	if len(data) == 0 {
		return Payload{}, ErrNone
	}
	sum := sha256.Sum256(data)
	if got := hex.EncodeToString(sum[:]); got != sha256Hex {
		return Payload{}, fmt.Errorf("the payload of this xdesign file is damaged: its SHA-256 is %s, the build stamped %q", got, sha256Hex)
	}
	return Payload{data: data}, nil
}

// Extract unpacks the payload into dir, an existing folder: the folders runtime/ and app/
// with their files. Folders get 0755, files 0755 when the payload marks them executable and
// 0644 otherwise. It refuses links, devices, names outside runtime/ and app/, and files that
// exist already.
func (p Payload) Extract(dir string) error {
	root, err := os.OpenRoot(dir)
	if err != nil {
		return fmt.Errorf("open %s: %w", dir, err)
	}
	defer func() { _ = root.Close() }() // a folder: closing it cannot lose data
	zr, err := zstd.NewReader(bytes.NewReader(p.data), zstd.WithDecoderMaxWindow(maxWindow), zstd.WithDecoderConcurrency(1))
	if err != nil {
		return fmt.Errorf("start the zstd decoder: %w", err)
	}
	defer zr.Close()
	tr := tar.NewReader(zr)
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("read the payload: %w", err)
		}
		if err := extractEntry(root, hdr, tr); err != nil {
			return err
		}
	}
}

// extractEntry writes one entry of the payload below root.
func extractEntry(root *os.Root, hdr *tar.Header, r io.Reader) error {
	name := strings.TrimSuffix(hdr.Name, "/")
	if top, _, _ := strings.Cut(name, "/"); !fs.ValidPath(name) || (top != "runtime" && top != "app") {
		return fmt.Errorf("the payload holds %q, which is outside runtime/ and app/", hdr.Name)
	}
	switch hdr.Typeflag {
	case tar.TypeDir:
		return mkdir(root, name)
	case tar.TypeReg:
		if err := mkdir(root, path.Dir(name)); err != nil {
			return err
		}
		mode := fileMode
		if hdr.Mode&0o100 != 0 {
			mode = execMode
		}
		f, err := root.OpenFile(name, os.O_WRONLY|os.O_CREATE|os.O_EXCL, mode)
		if err != nil {
			return fmt.Errorf("create %s: %w", name, err)
		}
		_, err = io.CopyN(f, r, hdr.Size)
		if err := errors.Join(err, f.Close()); err != nil {
			return fmt.Errorf("write %s: %w", name, err)
		}
		if err := root.Chmod(name, mode); err != nil {
			return fmt.Errorf("set the mode of %s: %w", name, err)
		}
		return nil
	default:
		return fmt.Errorf("the payload holds %s, which is not a file or a folder", hdr.Name)
	}
}

// mkdir creates the folder name below root and its parents, with mode 0755.
func mkdir(root *os.Root, name string) error {
	if err := root.MkdirAll(name, dirMode); err != nil {
		return fmt.Errorf("create %s: %w", name, err)
	}
	if err := root.Chmod(name, dirMode); err != nil {
		return fmt.Errorf("set the mode of %s: %w", name, err)
	}
	return nil
}
