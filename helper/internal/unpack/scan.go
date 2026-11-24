package unpack

import (
	"archive/tar"
	"bytes"
	"cmp"
	"compress/gzip"
	"debug/elf"
	"debug/pe"
	"encoding/binary"
	"fmt"
	"io"
	"path"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
	"github.com/Sir-MmD/xdesign/helper/internal/release"
)

const (
	// peekLen is how much of a file the first walk reads to tell what it is. A gzip file
	// shows its tar header only after its own first bytes are unpacked, so 512 bytes of the
	// file would not be enough.
	peekLen = 4096
	// maxSumsBytes bounds a SHA256SUMS or SHA256SUMS.sig that is kept from a container.
	maxSumsBytes = 64 << 10
	// macosxFolder is the folder Finder adds to the zip files it makes; it never holds an
	// update, and it must not count as a second top folder.
	macosxFolder = "__MACOSX"
)

// class is what a file of a container is to an update.
type class int

const (
	// classOther is nothing an update uses.
	classOther class = iota
	// classProgram is an ELF or a PE file: an xdesign file.
	classProgram
	// classRelease is a gzip file that holds a tar file with a top folder: a release
	// archive, as far as its first bytes tell.
	classRelease
	// classPacked is another packed file, or a gzip file that is no release archive: the
	// update packed more than once.
	classPacked
)

// entry is a regular file of a container, found by the first walk.
type entry struct {
	index int
	// name is the whole clean name; dir is its folder ("" at the top) and base its last
	// element.
	name, dir, base string
	size            int64
	class           class
	// arch is the CPU the file is built for, "amd64" or "arm64", "" when it does not say.
	arch string
}

// scanned is what the first walk found in a container.
type scanned struct {
	// files are the regular files at depth one or two (SHA256SUMS and its signature
	// excluded).
	files []*entry
	// tops are the first elements of all the names; folders are those of them that are
	// folders.
	tops, folders map[string]bool
	// sums and sigs are the SHA256SUMS and SHA256SUMS.sig files kept, by their folder.
	sums, sigs map[string][]byte
	// holds records, by folder, which of VERSION (1) and MANIFEST.sha256 (2) it holds.
	holds map[string]uint8
	// direct reports that the file is itself a release archive: a gzip tar file whose top
	// folder holds VERSION and MANIFEST.sha256.
	direct bool
}

// scan walks the container once and records its files at depth one or two. With
// releaseArchive set (a gzip tar file), the walk ends at the first top folder that holds
// VERSION and MANIFEST.sha256: the file is a release archive, and the checks of the update
// read the rest of it.
func (c *container) scan(releaseArchive bool) (*scanned, error) {
	sc := &scanned{
		tops: map[string]bool{}, folders: map[string]bool{}, sums: map[string][]byte{}, sigs: map[string][]byte{},
		holds: map[string]uint8{},
	}
	count := 0
	err := c.walk(func(it *item) error {
		if count++; count > c.s.lim.Entries {
			return tooMany(c.name, c.s.lim.Entries)
		}
		return sc.add(c, it, releaseArchive)
	})
	if err != nil {
		return nil, err
	}
	return sc, nil
}

// The bits of scanned.holds.
const (
	holdsVersion  = 1
	holdsManifest = 2
	holdsBoth     = holdsVersion | holdsManifest
)

// add records one entry of the walk. It returns errStop once the file is known to be a
// release archive (see scan).
func (sc *scanned) add(c *container, it *item, releaseArchive bool) error {
	if it.name == "" {
		return nil
	}
	first, _, nested := strings.Cut(it.name, "/")
	if first == macosxFolder {
		return nil
	}
	sc.tops[first] = true
	if it.dir || nested {
		sc.folders[first] = true
	}
	if it.dir || strings.Count(it.name, "/") > 1 {
		return nil
	}
	e := &entry{index: it.index, name: it.name, dir: dirOf(it.name), base: path.Base(it.name), size: it.size}
	rc, err := it.open()
	if err != nil {
		return c.s.content(err, c.name)
	}
	err = sc.read(rc, e)
	_ = rc.Close() // reading only: closing cannot lose data
	if err != nil {
		return c.s.content(err, c.name)
	}
	if e.base == release.SumsName || e.base == release.SigName {
		return nil
	}
	sc.files = append(sc.files, e)
	switch e.base {
	case buildinfo.ReleaseFileName:
		sc.holds[e.dir] |= holdsVersion
	case release.ManifestName:
		sc.holds[e.dir] |= holdsManifest
	}
	if releaseArchive && e.dir != "" && sc.holds[e.dir] == holdsBoth {
		sc.direct = true
		return errStop
	}
	return nil
}

// read reads the start of the file e from rc and says what it is; SHA256SUMS and its
// signature are kept whole when they are small.
func (sc *scanned) read(rc io.Reader, e *entry) error {
	if e.base == release.SumsName || e.base == release.SigName {
		data, err := io.ReadAll(io.LimitReader(rc, maxSumsBytes+1))
		if err != nil {
			return fmt.Errorf("read %s: %w", e.name, err)
		}
		kept := sc.sums
		if e.base == release.SigName {
			kept = sc.sigs
		}
		if _, have := kept[e.dir]; !have && len(data) <= maxSumsBytes {
			kept[e.dir] = data
		}
		return nil
	}
	head, err := io.ReadAll(io.LimitReader(rc, peekLen))
	if err != nil {
		return fmt.Errorf("read %s: %w", e.name, err)
	}
	e.class, e.arch = classify(head, e.base)
	return nil
}

// dirOf returns the folder of a clean name, "" for a name at the top.
func dirOf(name string) string {
	dir, _, found := strings.Cut(name, "/")
	if !found {
		return ""
	}
	return dir
}

// scope returns the folder an update is looked for in, and the files in it: the one top
// folder when all the names share it, else the top itself ("").
func (sc *scanned) scope() (string, []*entry) {
	dir := ""
	if len(sc.tops) == 1 {
		for top := range sc.tops {
			if sc.folders[top] {
				dir = top
			}
		}
	}
	var files []*entry
	for _, e := range sc.files {
		if e.dir == dir {
			files = append(files, e)
		}
	}
	return dir, files
}

// classify tells what a file is from its first bytes (and, for the CPU, its name).
func classify(head []byte, base string) (class, string) {
	switch Sniff(head) {
	case FormatELF:
		if len(head) >= 20 {
			return classProgram, elfArch(head)
		}
		return classProgram, archOf(base)
	case FormatPE:
		return classProgram, cmp.Or(peArch(head), archOf(base))
	case FormatGzip:
		return classifyGzip(head, base)
	case FormatXZ, FormatZstd, FormatZip, FormatRar, FormatTar, Format7z, FormatBzip2:
		return classPacked, ""
	case FormatUnknown:
	}
	return classOther, ""
}

// classifyGzip looks into the first bytes of a gzip file. A tar file whose first entry is
// in a folder is a release archive; a gzip file of anything else is a second layer.
func classifyGzip(head []byte, base string) (class, string) {
	zr, err := gzip.NewReader(bytes.NewReader(head))
	if err != nil {
		return classOther, ""
	}
	inner, _ := io.ReadAll(io.LimitReader(zr, tarBlock)) // the head may end inside the stream: what came is enough
	if Sniff(inner) != FormatTar {
		return classPacked, ""
	}
	hdr, err := tar.NewReader(bytes.NewReader(inner)).Next()
	if hdr == nil || err != nil {
		return classPacked, ""
	}
	top, _, nested := strings.Cut(strings.TrimRight(strings.TrimPrefix(hdr.Name, "./"), "/"), "/")
	if top == "" || (!nested && hdr.Typeflag != tar.TypeDir) {
		return classPacked, "" // a tar file of a program, not a release folder
	}
	return classRelease, cmp.Or(archOf(top), archOf(base))
}

// elfArch returns the CPU an ELF file is built for from its header ("amd64", "arm64"), ""
// for any other.
func elfArch(head []byte) string {
	if len(head) < 20 || head[elf.EI_CLASS] != byte(elf.ELFCLASS64) {
		return ""
	}
	var order binary.ByteOrder
	switch head[elf.EI_DATA] {
	case byte(elf.ELFDATA2LSB):
		order = binary.LittleEndian
	case byte(elf.ELFDATA2MSB):
		order = binary.BigEndian
	default:
		return ""
	}
	switch machine := elf.Machine(order.Uint16(head[18:20])); machine { //nolint:exhaustive // every other machine has no xDesign build
	case elf.EM_X86_64:
		return "amd64"
	case elf.EM_AARCH64:
		return "arm64"
	}
	return ""
}

// peArch returns the CPU a PE file is built for from its COFF header ("amd64", "arm64"),
// "" for any other or when the header is not within head.
func peArch(head []byte) string {
	off := uint64(binary.LittleEndian.Uint32(head[peOffsetAt:])) + uint64(len(magicPE))
	if off+2 > uint64(len(head)) {
		return ""
	}
	switch binary.LittleEndian.Uint16(head[off:]) {
	case pe.IMAGE_FILE_MACHINE_AMD64:
		return "amd64"
	case pe.IMAGE_FILE_MACHINE_ARM64:
		return "arm64"
	}
	return ""
}

// archOf reads a CPU out of a name: "amd64" (or x86_64), "arm64" (or aarch64), "" when it
// names neither or both.
func archOf(name string) string {
	name = strings.ToLower(name)
	amd := strings.Contains(name, "amd64") || strings.Contains(name, "x86_64") || strings.Contains(name, "x86-64")
	arm := strings.Contains(name, "arm64") || strings.Contains(name, "aarch64")
	switch {
	case amd && !arm:
		return "amd64"
	case arm && !amd:
		return "arm64"
	}
	return ""
}
