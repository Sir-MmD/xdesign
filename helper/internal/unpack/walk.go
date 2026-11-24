package unpack

import (
	"archive/tar"
	"archive/zip"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"math"
	"strings"
	"unicode"
)

// An item is one entry of a container, as the walkers hand it to the code that looks
// through the container.
type item struct {
	// index counts the entries of the container from 0, folders included; it finds the
	// entry again in a second walk.
	index int
	// name is the clean relative name with slashes; "" is the container's own root.
	name string
	dir  bool
	// size is the size a file declares, -1 when the container does not say.
	size int64
	// open opens the contents of a file. The reader is good until the walk goes on.
	open func() (io.ReadCloser, error)
}

// errStop, returned by the function of a walk, ends the walk without an error.
var errStop = errors.New("stop the walk")

// container is a file that holds files: a tar file (also gzip, xz or zstd compressed) or a
// zip file.
type container struct {
	s *source
	// name is what the owner calls it: "zip", "tar", "tar.gz", "tar.xz", "tar.zst".
	name string
	// kind is FormatZip or FormatTar; comp is the compression of a tar file
	// (FormatGzip, FormatXZ or FormatZstd), FormatUnknown for none.
	kind Format
	comp Format
}

// newContainer returns the container of the file whose format is f; comp is the
// compression around a tar file, FormatUnknown for none.
func newContainer(s *source, f, comp Format) *container {
	name := f.String()
	if f == FormatTar {
		name = tarName(comp)
	}
	return &container{s: s, name: name, kind: f, comp: comp}
}

// tarName is what the owner calls a tar file compressed with comp.
func tarName(comp Format) string {
	switch comp {
	case FormatGzip:
		return "tar.gz"
	case FormatXZ:
		return "tar.xz"
	case FormatZstd:
		return "tar.zst"
	case FormatUnknown, FormatELF, FormatPE, FormatZip, FormatRar, FormatTar, Format7z, FormatBzip2:
	}
	return "tar"
}

// walk calls visit for every entry of the container in order, from the start of the file
// each time. It stops at the first error visit returns; errStop ends it quietly.
func (c *container) walk(visit func(*item) error) error {
	var err error
	switch c.kind {
	case FormatZip:
		err = c.walkZip(visit)
	case FormatTar:
		err = c.walkTar(visit)
	case FormatUnknown, FormatELF, FormatPE, FormatGzip, FormatXZ, FormatZstd, FormatRar, Format7z, FormatBzip2:
		return fmt.Errorf("unpack: %s is not a container", c.kind)
	}
	if errors.Is(err, errStop) {
		return nil
	}
	return err
}

// maxNameLen bounds the name of an entry.
const maxNameLen = 4096

// cleanName returns the clean relative name of an entry, "" for the container's own root,
// and false for a name an update never has: absolute, with "..", empty or too long
// elements, control characters. backslashes reads "\" as a slash, as zip files made on
// Windows have it.
func cleanName(raw string, backslashes bool) (string, bool) {
	name := raw
	if backslashes {
		name = strings.ReplaceAll(name, `\`, "/")
	}
	for strings.HasPrefix(name, "./") {
		name = name[2:]
	}
	name = strings.TrimRight(name, "/")
	if name == "" || name == "." {
		return "", true
	}
	if len(name) > maxNameLen || !fs.ValidPath(name) || strings.IndexFunc(name, unicode.IsControl) >= 0 {
		return "", false
	}
	return name, true
}

// clean is cleanName with the refusal of a bad name.
func (c *container) clean(raw string, backslashes bool) (string, error) {
	name, ok := cleanName(raw, backslashes)
	if !ok {
		return "", badName(c.name, raw)
	}
	return name, nil
}

// walkTar walks a tar file, gzip, xz or zstd compressed or not. Only folders and regular
// files are accepted: a link, a device or any other type refuses the file.
func (c *container) walkTar(visit func(*item) error) error {
	var in io.Reader = c.s.section()
	if c.comp != FormatUnknown {
		zr, closeFn, err := c.s.decompress(c.comp, c.name)
		if err != nil {
			return err
		}
		defer closeFn()
		in = &capReader{r: zr, left: c.s.lim.Scan}
	}
	tr := tar.NewReader(in)
	index := 0
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		// The names are checked here, whatever GODEBUG says about tarinsecurepath.
		if err != nil && !errors.Is(err, tar.ErrInsecurePath) {
			return c.s.content(err, c.name)
		}
		if hdr.Typeflag == tar.TypeXGlobalHeader {
			continue
		}
		name, err := c.clean(hdr.Name, false)
		if err != nil {
			return err
		}
		it := &item{index: index, name: name, size: hdr.Size}
		switch hdr.Typeflag {
		case tar.TypeDir:
			it.dir = true
		case tar.TypeReg:
			it.open = func() (io.ReadCloser, error) { return io.NopCloser(tr), nil }
		default:
			return notRegular(c.name, hdr.Name)
		}
		index++
		if err := visit(it); err != nil {
			return err
		}
	}
	// The end of the archive. Reading on to the end of the stream runs its own checks: the
	// CRC of a gzip file, the checks of xz and zstd.
	if _, err := io.Copy(io.Discard, in); err != nil {
		return c.s.content(err, c.name)
	}
	return nil
}

const (
	// zipEndRecord is the size of a zip file's end record without its comment; the
	// comment is at most 65535 bytes.
	zipEndRecord    = 22
	zipEndSearch    = zipEndRecord + 65535
	zipEndSignature = "PK\x05\x06"
	zipMoreDisks    = 0xffff
)

// zipSpanned reports a zip file that is one part of several: it starts with the marker of
// a split archive, or its end record names another disk.
func (c *container) zipSpanned() (bool, error) {
	var first [4]byte
	if _, err := c.s.ReadAt(first[:], 0); err != nil && !errors.Is(err, io.EOF) {
		return false, err
	}
	if string(first[:]) == magicZipSpanned {
		return true, nil
	}
	tail := make([]byte, min(c.s.size, zipEndSearch))
	n, err := c.s.ReadAt(tail, c.s.size-int64(len(tail)))
	if err != nil && !errors.Is(err, io.EOF) {
		return false, err
	}
	tail = tail[:n]
	for i := len(tail) - zipEndRecord; i >= 0; i-- {
		if string(tail[i:i+len(zipEndSignature)]) != zipEndSignature {
			continue
		}
		disk, dirDisk := binary.LittleEndian.Uint16(tail[i+4:]), binary.LittleEndian.Uint16(tail[i+6:])
		return (disk != 0 && disk != zipMoreDisks) || (dirDisk != 0 && dirDisk != zipMoreDisks), nil
	}
	return false, nil
}

// walkZip walks a zip file. The directory is read first, with a budget, so a file with
// millions of entries cannot take the memory.
func (c *container) walkZip(visit func(*item) error) error {
	spanned, err := c.zipSpanned()
	if err != nil {
		return c.s.content(err, c.name)
	}
	if spanned {
		return multiVolume(c.name)
	}
	at := &budgetAt{r: c.s, left: zipDirectoryBytes}
	zr, err := zip.NewReader(at, c.s.size)
	at.left = -1
	if err != nil && !errors.Is(err, zip.ErrInsecurePath) {
		return c.s.content(err, c.name)
	}
	if len(zr.File) > c.s.lim.Entries {
		return tooMany(c.name, c.s.lim.Entries)
	}
	for i, f := range zr.File {
		if f.Flags&1 != 0 {
			return encrypted(c.name)
		}
		name, err := c.clean(f.Name, true)
		if err != nil {
			return err
		}
		it := &item{index: i, name: name, size: int64(min(f.UncompressedSize64, math.MaxInt64))}
		switch mode := f.Mode(); {
		case mode.IsDir() || strings.HasSuffix(f.Name, "/"):
			it.dir = true
		case mode.IsRegular():
			it.open = func() (io.ReadCloser, error) {
				rc, err := f.Open()
				if errors.Is(err, zip.ErrAlgorithm) {
					return nil, badMethod(c.name)
				}
				if err != nil {
					return nil, c.s.content(err, c.name)
				}
				return rc, nil
			}
		default:
			return notRegular(c.name, f.Name)
		}
		if err := visit(it); err != nil {
			return err
		}
	}
	return nil
}
