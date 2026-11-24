package release

import (
	"bytes"
	"debug/pe"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"

	"github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
)

// The Windows server's file (docs/plan/18-third-owner-list-2026-11-23.md sections 8.6 and
// 10) is a PE file: "MZ", the DOS header, and at the offset its bytes 0x3c to 0x40 name the
// signature "PE\0\0" and the COFF header. Go's linker writes it with a COFF symbol table
// unless -s strips it, so the stamped variables of internal/buildinfo are read from there,
// as from the ELF symbol table of the Linux file.
const (
	magicMZ = "MZ"
	magicPE = "PE\x00\x00"
	// peOffsetAt is where the DOS header keeps the offset of the PE signature.
	peOffsetAt = 0x3c
)

// isPE reports whether head, the first bytes of a file, are those of a PE file: "MZ" and,
// within head, the PE signature where the DOS header says.
func isPE(head []byte) bool {
	if !bytes.HasPrefix(head, []byte(magicMZ)) || len(head) < peOffsetAt+4 {
		return false
	}
	off := binary.LittleEndian.Uint32(head[peOffsetAt:])
	return uint64(off)+uint64(len(magicPE)) <= uint64(len(head)) && bytes.Equal(head[off:off+uint32(len(magicPE))], []byte(magicPE))
}

// peArch maps a PE machine to its Go architecture, "" for one xDesign has no builds for.
func peArch(m uint16) string {
	switch m {
	case pe.IMAGE_FILE_MACHINE_AMD64:
		return "amd64"
	case pe.IMAGE_FILE_MACHINE_ARM64:
		return "arm64"
	}
	return ""
}

// peFile is a PE file with the image base its addresses start from.
type peFile struct {
	f    *pe.File
	base uint64
}

// openPE reads the PE headers of r: a 64-bit Windows program for amd64 or arm64.
func openPE(r io.ReaderAt) (*peFile, string, error) {
	pf, err := pe.NewFile(r)
	if err != nil {
		return nil, "", fmt.Errorf("%w: it is not a Windows program (%w)", ErrNotXDesign, err)
	}
	arch := peArch(pf.Machine)
	oh, ok := pf.OptionalHeader.(*pe.OptionalHeader64)
	if arch == "" || !ok {
		return nil, "", fmt.Errorf("%w: it is a Windows program for the machine %#x; xDesign runs on amd64 and arm64", ErrNotXDesign,
			pf.Machine)
	}
	return &peFile{f: pf, base: oh.ImageBase}, arch, nil
}

// stamps reads the stamped variables of internal/buildinfo from the COFF symbol table, by
// their names. A symbol's value is its offset in its section; a variable the file does not
// have reads as "".
func (p *peFile) stamps() (map[string]string, error) {
	if len(p.f.Symbols) == 0 {
		return nil, errors.New("it has no symbol table: it was stripped")
	}
	names := map[string]string{}
	for _, name := range buildinfo.StampNames() {
		names[buildinfo.Package+"."+name] = name
	}
	stamps := map[string]string{}
	for _, s := range p.f.Symbols {
		name, ok := names[s.Name]
		if !ok {
			continue
		}
		if s.SectionNumber <= 0 || int(s.SectionNumber) > len(p.f.Sections) {
			return nil, fmt.Errorf("read %s: it is in no section", s.Name)
		}
		sec := p.f.Sections[s.SectionNumber-1]
		v, err := p.readString(p.base + uint64(sec.VirtualAddress) + uint64(s.Value))
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", s.Name, err)
		}
		stamps[name] = v
	}
	return stamps, nil
}

// readString reads the Go string variable at the virtual address addr: its header, a
// pointer and a length (little-endian, 64-bit), then the bytes the pointer leads to.
func (p *peFile) readString(addr uint64) (string, error) {
	var header [16]byte
	if err := p.readAddr(header[:], addr); err != nil {
		return "", err
	}
	ptr, n := binary.LittleEndian.Uint64(header[:8]), binary.LittleEndian.Uint64(header[8:])
	switch {
	case n == 0:
		return "", nil
	case n > maxStampBytes:
		return "", fmt.Errorf("the value has %d bytes, more than %d", n, maxStampBytes)
	}
	b := make([]byte, n)
	if err := p.readAddr(b, ptr); err != nil {
		return "", err
	}
	return string(b), nil
}

// readAddr fills b from the virtual address addr, out of the section whose memory holds all
// of it. What lies past the section's data in the file (the uninitialized variables Go
// keeps at the end of .data, where a variable the build did not stamp sits) reads as
// zeros.
func (p *peFile) readAddr(b []byte, addr uint64) error {
	size := uint64(len(b))
	for _, sec := range p.f.Sections {
		start := p.base + uint64(sec.VirtualAddress)
		if addr < start || uint64(sec.VirtualSize) < size || addr-start > uint64(sec.VirtualSize)-size {
			continue
		}
		off := addr - start
		clear(b)
		if off >= uint64(sec.Size) {
			return nil
		}
		n := min(size, uint64(sec.Size)-off)
		if off > math.MaxInt64 {
			break
		}
		if _, err := sec.ReadAt(b[:n], int64(off)); err != nil {
			return fmt.Errorf("read %s: %w", sec.Name, err)
		}
		return nil
	}
	return fmt.Errorf("no section holds the address %#x", addr)
}
