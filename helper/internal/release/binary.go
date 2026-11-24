package release

import (
	"bytes"
	"cmp"
	gobuildinfo "debug/buildinfo"
	"debug/elf"
	"errors"
	"fmt"
	"io"
	"math"

	"github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
)

// Kind is what a file given to an update is (docs/plan/07-server-install-update.md
// section 6.3).
type Kind int

// Kinds of update files.
const (
	// KindUnknown is none of the others.
	KindUnknown Kind = iota
	// KindArchive is xWriter's release archive: a gzip tar file whose one folder holds
	// VERSION and MANIFEST.sha256. An xDesign release is never one. DetectKind never
	// returns it; internal/unpack, copied from xWriter as it is, still names that layout.
	KindArchive
	// KindBinary is an ELF file or a PE file (the Windows server's .exe), taken for an
	// xdesign file.
	KindBinary
	// KindPacked is a file in one of the formats an update may be packed in: a zip, tar,
	// tar.gz, tar.xz or tar.zst file, or the xdesign file packed alone with gzip, xz or
	// zstd, and also a rar, 7z or bzip2 file, which internal/unpack refuses with a sentence
	// of its own. unpack.Resolve finds the payload inside, a KindBinary.
	KindPacked
)

func (k Kind) String() string {
	switch k {
	case KindArchive:
		return "archive"
	case KindBinary:
		return "binary"
	case KindPacked:
		return "packed"
	case KindUnknown:
	}
	return "unknown"
}

// DetectKind tells the kind of a file from its first bytes (KindHeadLen are enough; a tar
// file is missed with fewer): an ELF or a PE file is KindBinary, a gzip, xz, zstd, zip, rar, tar, 7z
// or bzip2 file is KindPacked, and anything else is KindUnknown. Only unpack.Resolve, which
// looks inside a packed file, finds what it holds.
func DetectKind(head []byte) Kind {
	switch {
	case bytes.HasPrefix(head, []byte(elf.ELFMAG)), isPE(head):
		return KindBinary
	case packedHead(head):
		return KindPacked
	}
	return KindUnknown
}

// ReadKind reads the first bytes of r and tells the kind of the file.
func ReadKind(r io.Reader) (Kind, error) {
	head := make([]byte, KindHeadLen)
	n, err := io.ReadFull(r, head)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		return KindUnknown, fmt.Errorf("read the file: %w", err)
	}
	return DetectKind(head[:n]), nil
}

// The Go module and the main package of the helper, as an xdesign file's build
// information names them.
const (
	Module      = "github.com/Sir-MmD/xdesign/helper"
	MainPackage = Module + "/cmd/xdesign"
)

// maxStampBytes bounds one stamped value read from a file; the longest real one, a
// SHA-256, has 64 bytes.
const maxStampBytes = 4 << 10

// Binary is what an xdesign file says about itself without running: the keys of its
// `xdesign version --json` and its ELF or PE header (docs/plan/07-server-install-update.md
// section 6.3, step 2). -trimpath builds leave the -ldflags values out of the Go build
// information, so the stamped values are read from the variables of internal/buildinfo
// in the file's symbol table: release builds keep it (they drop only the DWARF data, -w).
type Binary struct {
	buildinfo.Info
	// Dev reports a development build: a version with a pre-release
	// ("0.0.0-dev+<commit>").
	Dev bool
}

// ErrNotXDesign is returned for a file that is not an xdesign file for Linux or Windows on
// amd64 or arm64.
var ErrNotXDesign = errors.New("not an xdesign file")

// elfArch maps an ELF machine to its Go architecture, "" for one xDesign has no
// builds for.
func elfArch(m elf.Machine) string {
	switch m { //nolint:exhaustive // every other machine has no xDesign build
	case elf.EM_X86_64:
		return "amd64"
	case elf.EM_AARCH64:
		return "arm64"
	}
	return ""
}

// InspectBinary reads the program header (ELF for Linux, PE for Windows), the Go build
// information and the stamped build information of r and checks that it is an xdesign
// file: module github.com/Sir-MmD/xdesign/helper, package cmd/xdesign, CGO_ENABLED=0, a
// GOOS that is the system of the header (linux for an ELF file, windows for a PE file), a
// GOARCH and a stamped arch that match the header's machine, amd64 or arm64, and a version,
// min_upgrade_from and schema_floor that are versions. Binary.OS is the file's system. It
// never runs the file.
func InspectBinary(r io.ReaderAt) (Binary, error) {
	head := make([]byte, KindHeadLen)
	n, _ := r.ReadAt(head, 0) // a shorter file shows all it has
	var (
		system, arch string
		stamps       func() (map[string]string, error)
	)
	if isPE(head[:n]) {
		pf, a, err := openPE(r)
		if err != nil {
			return Binary{}, err
		}
		system, arch, stamps = "windows", a, pf.stamps
	} else {
		ef, err := elf.NewFile(r)
		if err != nil {
			return Binary{}, fmt.Errorf("%w: it is not a Linux program (%w)", ErrNotXDesign, err)
		}
		arch = elfArch(ef.Machine)
		if arch == "" || ef.Class != elf.ELFCLASS64 {
			return Binary{}, fmt.Errorf("%w: it is a program for %s (%s); xDesign runs on amd64 and arm64", ErrNotXDesign, ef.Machine, ef.Class)
		}
		system, stamps = "linux", func() (map[string]string, error) { return readStamps(ef) }
	}
	bi, err := gobuildinfo.Read(r)
	if err != nil {
		return Binary{}, fmt.Errorf("%w: it carries no Go build information (%w)", ErrNotXDesign, err)
	}
	if bi.Main.Path != Module || bi.Path != MainPackage {
		return Binary{}, fmt.Errorf("%w: it is the Go program %s of the module %s", ErrNotXDesign, cmp.Or(bi.Path, "(unknown)"), cmp.Or(bi.Main.Path, "(unknown)"))
	}
	settings := map[string]string{}
	for _, s := range bi.Settings {
		settings[s.Key] = s.Value
	}
	switch {
	case settings["GOOS"] != system:
		return Binary{}, fmt.Errorf("%w: it was built for %s, not %s", ErrNotXDesign, cmp.Or(settings["GOOS"], "an unknown system"), SystemName(system))
	case settings["CGO_ENABLED"] != "0":
		return Binary{}, fmt.Errorf("%w: it was built with cgo (CGO_ENABLED=%s), and xDesign's builds are static", ErrNotXDesign, settings["CGO_ENABLED"])
	case settings["GOARCH"] != arch:
		return Binary{}, fmt.Errorf("%w: its build information names %s, its program header %s", ErrNotXDesign, settings["GOARCH"], arch)
	}
	stamped, err := stamps()
	if err != nil {
		return Binary{}, fmt.Errorf("%w: its build information cannot be read (%w)", ErrNotXDesign, err)
	}
	info := buildinfo.WithVCS(buildinfo.FromStamps(stamped, bi.GoVersion, settings["GOOS"], arch), bi.Settings)
	if info.Arch != arch {
		return Binary{}, fmt.Errorf("%w: it says it was built for %s, its program header %s", ErrNotXDesign, info.Arch, arch)
	}
	v, err := buildinfo.ParseVersion(info.Version)
	if err != nil {
		return Binary{}, fmt.Errorf("%w: its version: %w", ErrNotXDesign, err)
	}
	for _, f := range []struct{ key, value string }{{"min_upgrade_from", info.MinUpgradeFrom}, {"schema_floor", info.SchemaFloor}} {
		if _, err := buildinfo.ParseVersion(f.value); err != nil {
			return Binary{}, fmt.Errorf("%w: its %s: %w", ErrNotXDesign, f.key, err)
		}
	}
	return Binary{Info: info, Dev: !v.IsRelease()}, nil
}

// SystemName names the system of a GOOS as the commands and the website say it: "Linux",
// "Windows" ("System: Windows", "This file is for Linux; this server runs Windows.").
func SystemName(goos string) string {
	switch goos {
	case "linux":
		return "Linux"
	case "windows":
		return "Windows"
	}
	return goos
}

// readStamps reads the stamped variables of internal/buildinfo (buildinfo.StampNames) from
// the symbol table of ef, by their names. A variable the file does not have reads as "".
func readStamps(ef *elf.File) (map[string]string, error) {
	syms, err := ef.Symbols()
	if errors.Is(err, elf.ErrNoSymbols) {
		return nil, errors.New("it has no symbol table: it was stripped")
	}
	if err != nil {
		return nil, fmt.Errorf("read the symbol table: %w", err)
	}
	names := map[string]string{}
	for _, name := range buildinfo.StampNames() {
		names[buildinfo.Package+"."+name] = name
	}
	stamps := map[string]string{}
	for _, s := range syms {
		name, ok := names[s.Name]
		if !ok {
			continue
		}
		v, err := readString(ef, s.Value)
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", s.Name, err)
		}
		stamps[name] = v
	}
	return stamps, nil
}

// readString reads the Go string variable at the virtual address addr of ef (64-bit): its
// header, a pointer and a length, then the bytes the pointer leads to.
func readString(ef *elf.File, addr uint64) (string, error) {
	var header [16]byte
	if err := readAddr(ef, header[:], addr); err != nil {
		return "", err
	}
	ptr, n := ef.ByteOrder.Uint64(header[:8]), ef.ByteOrder.Uint64(header[8:])
	switch {
	case n == 0:
		return "", nil
	case n > maxStampBytes:
		return "", fmt.Errorf("the value has %d bytes, more than %d", n, maxStampBytes)
	}
	b := make([]byte, n)
	if err := readAddr(ef, b, ptr); err != nil {
		return "", err
	}
	return string(b), nil
}

// readAddr fills b from the virtual address addr of ef, out of the section that holds all
// of it. A section without file data (.bss, where a variable the build did not stamp
// sits) reads as zeros.
func readAddr(ef *elf.File, b []byte, addr uint64) error {
	size := uint64(len(b))
	for _, sec := range ef.Sections {
		if sec.Addr == 0 || addr < sec.Addr || sec.Size < size || addr-sec.Addr > sec.Size-size {
			continue
		}
		if sec.Type == elf.SHT_NOBITS {
			clear(b)
			return nil
		}
		off := addr - sec.Addr
		if off > math.MaxInt64 {
			break
		}
		if _, err := sec.ReadAt(b, int64(off)); err != nil {
			return fmt.Errorf("read %s: %w", sec.Name, err)
		}
		return nil
	}
	return fmt.Errorf("no section holds the address %#x", addr)
}
