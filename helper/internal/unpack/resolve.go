package unpack

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"regexp"
	"slices"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/release"
)

// Options say what Resolve is given besides the packed file.
type Options struct {
	// Name is the name the file has. Resolve uses it to name a payload that has no name of
	// its own (a program packed alone with gzip, xz or zstd) and to fill Found.Name when
	// the file is itself the payload.
	Name string
	// Path is where the file is on disk. Resolve only reads the file through the
	// io.ReaderAt it is given; it hands Path back as Found.Path when the file is itself the
	// payload, so the caller can treat both outcomes the same way.
	Path string
	// Arch is the CPU of this server, "amd64" or "arm64" (the names uname prints, x86_64 and
	// aarch64, are read too). It decides between several updates in one container; "" means
	// it is not known.
	Arch string
	// Limits bound the work; zero fields take their defaults.
	Limits Limits
	// Before, when set, is called once, after the payload is chosen and before its first
	// byte is written to dst, with Kind, Name, Layers, Sums and Sig set and Size what the
	// payload declares (-1 when the format does not say: a program packed alone with gzip,
	// xz or zstd; the room it needs is then at most Limits.Payload). An error it returns
	// stops Resolve and is returned as it is. The panel checks the free disk space here.
	// It is not called when the file is itself the payload, as nothing is written then.
	Before func(Found) error
}

// Found is what Resolve found: the payload, and how it was reached.
type Found struct {
	// Kind is release.KindBinary for the xdesign file (an ELF or a PE file), or release.KindArchive
	// for one of xWriter's release archives (a gzip tar file), which no xDesign release is.
	Kind release.Kind
	// Path is the payload: Options.Path when the file is itself the payload, else a new
	// file in dst (mode 0600, named .unpacked-<random>), which the caller owns: it renames
	// it, uses it, and removes it.
	Path string
	// Unpacked reports that Path is a new file in dst.
	Unpacked bool
	// Name is the payload's own name: the entry's name without its folder, the name of the
	// packed file without .gz, .xz or .zst, or the base of Options.Name when the file is
	// itself the payload. SHA256SUMS lists a release's files by this name. It is a clean
	// name, but the caller makes it safe before it uses it as a file name.
	Name string
	// Size is the payload's size in bytes, SHA256 its lower-case hexadecimal SHA-256.
	Size   int64
	SHA256 string
	// Layers lists the packed formats that were opened to reach the payload, the outer one
	// first ("zip", "tar.xz", "xz"); empty when the file is itself the payload. A release
	// archive inside a zip is the payload, not a layer.
	Layers []string
	// Sums and Sig are the SHA256SUMS and SHA256SUMS.sig found next to the payload inside
	// the container (64 KiB at most each), nil when there are none.
	Sums, Sig []byte
}

// Resolve finds the update in the file src of size bytes: the file itself when it is an
// xdesign file (an ELF file) or a release archive (a gzip tar file whose top folder holds
// VERSION and MANIFEST.sha256), else the program or the release archive inside it, copied
// to a new file in the folder dst. See the package comment for what is accepted and refused.
//
// A refusal is an *Error with a sentence for the owner; any other error is a failure
// (the file system, ctx). Nothing is left in dst after an error.
func Resolve(ctx context.Context, src io.ReaderAt, size int64, dst string, opt Options) (Found, error) {
	if size < 0 {
		return Found{}, errors.New("unpack: the size of the file is negative")
	}
	lim := opt.Limits.withDefaults()
	r := &resolver{s: newSource(ctx, src, size, lim), lim: lim, opt: opt, arch: archOf(opt.Arch), dst: dst}
	return r.resolve()
}

// resolver is one Resolve.
type resolver struct {
	s    *source
	lim  Limits
	opt  Options
	arch string
	dst  string
}

func (r *resolver) resolve() (Found, error) {
	if err := r.s.stopped(); err != nil {
		return Found{}, err
	}
	head, err := r.s.head()
	if err != nil {
		return Found{}, err
	}
	switch f := Sniff(head); f {
	case FormatELF, FormatPE:
		return r.direct(release.KindBinary)
	case FormatGzip, FormatXZ, FormatZstd:
		return r.compressed(f)
	case FormatTar, FormatZip:
		return r.container(newContainer(r.s, f, FormatUnknown))
	case FormatRar, Format7z, FormatBzip2:
		return Found{}, unsupported(f)
	case FormatUnknown:
	}
	return Found{}, notUpdate()
}

// direct returns the file itself as the payload.
func (r *resolver) direct(kind release.Kind) (Found, error) {
	if r.s.size > r.lim.Payload {
		return Found{}, payloadTooLarge("", r.s.size, r.lim.Payload)
	}
	sum, err := r.s.sha256()
	if err != nil {
		return Found{}, err
	}
	name := ""
	if r.opt.Name != "" {
		name = path.Base(r.opt.Name)
	}
	return Found{Kind: kind, Path: r.opt.Path, Name: name, Size: r.s.size, SHA256: sum}, nil
}

// compressed handles a gzip, xz or zstd file: what it holds decides. A program means the
// file is that program, packed alone; a tar file means a container; any other packed
// format means the update is packed twice.
func (r *resolver) compressed(f Format) (Found, error) {
	name := f.String()
	zr, closeFn, err := r.s.decompress(f, name)
	if err != nil {
		return Found{}, err
	}
	inner, err := io.ReadAll(io.LimitReader(zr, tarBlock))
	closeFn()
	if err != nil {
		return Found{}, r.s.content(err, name)
	}
	switch Sniff(inner) {
	case FormatELF, FormatPE:
		return r.single(f)
	case FormatTar:
		return r.container(newContainer(r.s, FormatTar, f))
	case FormatGzip, FormatXZ, FormatZstd, FormatZip, FormatRar, Format7z, FormatBzip2:
		return Found{}, repacked()
	case FormatUnknown:
	}
	return Found{}, notHolding(name)
}

// single unpacks a program that was compressed alone.
func (r *resolver) single(f Format) (Found, error) {
	found := Found{Kind: release.KindBinary, Name: payloadName(r.opt.Name), Size: -1, Layers: []string{f.String()}}
	if err := r.before(found); err != nil {
		return Found{}, err
	}
	zr, closeFn, err := r.s.decompress(f, f.String())
	if err != nil {
		return Found{}, err
	}
	defer closeFn()
	return r.copyPayload(found, zr, f.String())
}

// payloadName names a program that was compressed alone after the packed file, without
// the extension of the compression.
func payloadName(name string) string {
	base := path.Base(name)
	if name == "" || base == "." || base == "/" {
		return "xdesign"
	}
	lower := strings.ToLower(base)
	for _, ext := range [...]string{".gz", ".gzip", ".xz", ".zst", ".zstd"} {
		if strings.HasSuffix(lower, ext) && len(base) > len(ext) {
			return base[:len(base)-len(ext)]
		}
	}
	return base
}

// before calls Options.Before.
func (r *resolver) before(found Found) error {
	if r.opt.Before == nil {
		return nil
	}
	return r.opt.Before(found)
}

// releaseName is the shape of the names of a release's files: xdesign-<version>-linux-<arch>,
// with .tar.gz for its tar file, and xdesign-<version>-windows-<arch>.exe.
var releaseName = regexp.MustCompile(`^xdesign-[A-Za-z0-9][A-Za-z0-9.+-]*-(linux-(amd64|arm64)(\.tar\.gz)?|windows-(amd64|arm64)\.exe)$`)

// container looks through a container, chooses the update in it and unpacks it.
func (r *resolver) container(c *container) (Found, error) {
	sc, err := c.scan(c.kind == FormatTar && c.comp == FormatGzip)
	if err != nil {
		return Found{}, err
	}
	if sc.direct {
		return r.direct(release.KindArchive)
	}
	dir, files := sc.scope()
	if sc.holds[dir] == holdsBoth {
		return Found{}, releaseFolder(c.name)
	}
	var cands []*entry
	packed := false
	for _, e := range files {
		switch e.class {
		case classProgram, classRelease:
			cands = append(cands, e)
		case classPacked:
			packed = true
		case classOther:
		}
	}
	switch {
	case len(cands) == 0 && packed:
		return Found{}, repacked()
	case len(cands) == 0:
		return Found{}, nothing(c.name)
	}
	cands = choose(cands, r.arch)
	if len(cands) > 1 {
		names := make([]string, len(cands))
		for i, e := range cands {
			names[i] = e.base
		}
		slices.Sort(names)
		return Found{}, several(c.name, names, r.arch)
	}
	return r.extract(c, sc, cands[0])
}

// choose narrows the candidates of a container: to those built for this server when some
// are, to release archives when some are (the program inside is the same, and the signed
// SHA256SUMS lists both), and to those named as a release names its files when some are.
func choose(cands []*entry, arch string) []*entry {
	narrow := func(keep func(*entry) bool) {
		if len(cands) < 2 {
			return
		}
		var kept []*entry
		for _, e := range cands {
			if keep(e) {
				kept = append(kept, e)
			}
		}
		if len(kept) > 0 {
			cands = kept
		}
	}
	if arch != "" {
		narrow(func(e *entry) bool { return e.arch == arch })
	}
	narrow(func(e *entry) bool { return e.class == classRelease })
	narrow(func(e *entry) bool { return releaseName.MatchString(e.base) })
	return cands
}

// extract copies the chosen entry of the container to dst.
func (r *resolver) extract(c *container, sc *scanned, e *entry) (Found, error) {
	if e.size > r.lim.Payload {
		return Found{}, payloadTooLarge(c.name, e.size, r.lim.Payload)
	}
	kind := release.KindBinary
	if e.class == classRelease {
		kind = release.KindArchive
	}
	found := Found{Kind: kind, Name: e.base, Size: e.size, Layers: []string{c.name}, Sums: sc.sums[e.dir], Sig: sc.sigs[e.dir]}
	if err := r.before(found); err != nil {
		return Found{}, err
	}
	var out Found
	err := c.walk(func(it *item) error {
		if it.index != e.index {
			return nil
		}
		rc, err := it.open()
		if err != nil {
			return c.s.content(err, c.name)
		}
		defer func() { _ = rc.Close() }() // reading only: closing cannot lose data
		if out, err = r.copyPayload(found, rc, c.name); err != nil {
			return err
		}
		return errStop
	})
	if err != nil {
		return Found{}, err
	}
	if out.Path == "" {
		return Found{}, damaged(c.name, errors.New("an entry is gone since the first look"))
	}
	return out, nil
}

// copyPayload writes body, the payload that found describes, to a new file in dst, and
// returns found with Path, Size and SHA256 set. The copy goes through a limit: a payload
// that grows past Limits.Payload, or past the size it declared, is refused.
func (r *resolver) copyPayload(found Found, body io.Reader, name string) (Found, error) {
	out, err := os.CreateTemp(r.dst, ".unpacked-*")
	if err != nil {
		return Found{}, fmt.Errorf("create the unpacked file: %w", err)
	}
	done := false
	defer func() {
		if !done {
			_ = out.Close()
			_ = os.Remove(out.Name())
		}
	}()
	h := sha256.New()
	buf := make([]byte, 128<<10)
	var head []byte
	var total int64
	for {
		if err := r.s.stopped(); err != nil {
			return Found{}, err
		}
		n, rerr := body.Read(buf)
		if n > 0 {
			total += int64(n)
			switch {
			case found.Size >= 0 && total > found.Size:
				return Found{}, damaged(name, errors.New("an entry is longer than it says"))
			case total > r.lim.Payload:
				return Found{}, payloadTooLarge(name, -1, r.lim.Payload)
			}
			if len(head) < len(magicELF) {
				head = append(head, buf[:min(n, len(magicELF)-len(head))]...)
			}
			if _, werr := out.Write(buf[:n]); werr != nil {
				return Found{}, fmt.Errorf("write the unpacked file: %w", werr)
			}
			_, _ = h.Write(buf[:n]) // a hash never fails
		}
		if errors.Is(rerr, io.EOF) {
			break
		}
		if rerr != nil {
			return Found{}, r.s.content(rerr, name)
		}
	}
	if found.Size >= 0 && total != found.Size {
		return Found{}, damaged(name, errors.New("an entry is shorter than it says"))
	}
	if !payloadStarts(found.Kind, head) {
		return Found{}, damaged(name, errors.New("an entry changed since the first look"))
	}
	if err := out.Close(); err != nil {
		return Found{}, fmt.Errorf("write the unpacked file: %w", err)
	}
	done = true
	found.Path, found.Unpacked, found.Size, found.SHA256 = out.Name(), true, total, hex.EncodeToString(h.Sum(nil))
	return found, nil
}

// payloadStarts reports whether the first bytes of a payload are those of its kind.
func payloadStarts(kind release.Kind, head []byte) bool {
	switch kind {
	case release.KindBinary:
		return bytes.HasPrefix(head, []byte(magicELF)) || bytes.HasPrefix(head, []byte(magicMZ))
	case release.KindArchive:
		return bytes.HasPrefix(head, []byte(magicGzip))
	case release.KindUnknown, release.KindPacked:
	}
	return false
}
