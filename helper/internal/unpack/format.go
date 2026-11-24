package unpack

import (
	"bytes"
	"encoding/binary"
	"strconv"
)

// Format is a kind of file, told by its first bytes. The name of a file never tells it.
type Format int

// The formats Sniff tells apart. FormatELF and FormatPE are programs (the Linux and the
// Windows xdesign file), not packed files. Format7z and
// FormatBzip2 are known only so that Resolve can refuse them with a sentence of their own.
const (
	// FormatUnknown is none of the others.
	FormatUnknown Format = iota
	FormatELF
	FormatPE
	FormatGzip
	FormatXZ
	FormatZstd
	FormatZip
	FormatRar
	FormatTar
	Format7z
	FormatBzip2
)

// String returns the lower-case name of the format.
func (f Format) String() string {
	switch f {
	case FormatELF:
		return "elf"
	case FormatPE:
		return "pe"
	case FormatGzip:
		return "gzip"
	case FormatXZ:
		return "xz"
	case FormatZstd:
		return "zstd"
	case FormatZip:
		return "zip"
	case FormatRar:
		return "rar"
	case FormatTar:
		return "tar"
	case Format7z:
		return "7z"
	case FormatBzip2:
		return "bzip2"
	case FormatUnknown:
	}
	return "unknown"
}

// Packed reports whether f is a packed file: every format but FormatUnknown and the
// programs, FormatELF and FormatPE. Resolve takes the supported ones apart and refuses
// Format7z and FormatBzip2.
func (f Format) Packed() bool {
	return f != FormatUnknown && f != FormatELF && f != FormatPE
}

// The first bytes of each format. The tar magic is not at the start: see isTar.
// internal/release/packed.go repeats them for release.DetectKind (this package imports
// that one, so they cannot be shared); keep the two lists in step.
const (
	magicELF = "\x7fELF"
	magicMZ  = "MZ"
	magicPE  = "PE\x00\x00"
	// peOffsetAt is where a PE file's DOS header keeps the offset of the PE signature.
	peOffsetAt      = 0x3c
	magicGzip       = "\x1f\x8b"
	magicXZ         = "\xfd7zXZ\x00"
	magicZstd       = "\x28\xb5\x2f\xfd"
	magicZip        = "PK\x03\x04"
	magicZipEmpty   = "PK\x05\x06"
	magicZipSpanned = "PK\x07\x08"
	magicRar        = "Rar!\x1a\x07"
	magic7z         = "7z\xbc\xaf\x27\x1c"
	magicBzip2      = "BZh"
	// bzip2BlockMagic follows the one digit of the block size.
	bzip2BlockMagic = "1AY&SY"
	// tarMagicOffset is where "ustar" sits in a tar header; tarBlock is the size of the
	// header.
	tarMagicOffset = 257
	tarBlock       = 512
	// headLen is how many bytes of a file are looked at to tell its format.
	headLen = 512
)

// Sniff tells the format of a file from its first bytes. 512 bytes are enough for every
// format; with fewer, only a tar file can be missed (its magic is at byte 257).
func Sniff(head []byte) Format {
	switch {
	case hasMagic(head, magicELF):
		return FormatELF
	case isPE(head):
		return FormatPE
	case hasMagic(head, magicGzip):
		return FormatGzip
	case hasMagic(head, magicXZ):
		return FormatXZ
	case hasMagic(head, magicZstd), isZstdSkippable(head):
		return FormatZstd
	case hasMagic(head, magicZip), hasMagic(head, magicZipEmpty), hasMagic(head, magicZipSpanned):
		return FormatZip
	case hasMagic(head, magicRar):
		return FormatRar
	case hasMagic(head, magic7z):
		return Format7z
	case isBzip2(head):
		return FormatBzip2
	case isTar(head):
		return FormatTar
	}
	return FormatUnknown
}

// isPE reports a PE file (a Windows program): "MZ" and, within head, the PE signature
// where the DOS header says.
func isPE(head []byte) bool {
	if !hasMagic(head, magicMZ) || len(head) < peOffsetAt+4 {
		return false
	}
	off := uint64(binary.LittleEndian.Uint32(head[peOffsetAt:]))
	return off+uint64(len(magicPE)) <= uint64(len(head)) && hasMagic(head[off:], magicPE)
}

func hasMagic(head []byte, magic string) bool {
	return len(head) >= len(magic) && string(head[:len(magic)]) == magic
}

// isZstdSkippable reports a skippable frame (0x184D2A50 to 0x184D2A5F, little-endian),
// which a zstd file may start with.
func isZstdSkippable(head []byte) bool {
	return len(head) >= 4 && head[0]&0xf0 == 0x50 && head[1] == 0x2a && head[2] == 0x4d && head[3] == 0x18
}

// isBzip2 reports "BZh", a digit from 1 to 9 and, when the bytes are there, the magic of
// the first block.
func isBzip2(head []byte) bool {
	if !hasMagic(head, magicBzip2) || len(head) < len(magicBzip2)+1 {
		return false
	}
	if d := head[len(magicBzip2)]; d < '1' || d > '9' {
		return false
	}
	rest := head[len(magicBzip2)+1:]
	return len(rest) < len(bzip2BlockMagic) || hasMagic(rest, bzip2BlockMagic)
}

// isTar reports a tar header: "ustar" at byte 257 (POSIX and GNU tar), or, for the
// older tar files that have no magic, a header whose checksum field is right.
func isTar(head []byte) bool {
	if len(head) >= tarMagicOffset+len("ustar") && string(head[tarMagicOffset:tarMagicOffset+len("ustar")]) == "ustar" {
		return true
	}
	return len(head) >= tarBlock && head[0] != 0 && tarChecksumRight(head[:tarBlock])
}

// tarChecksumRight checks the checksum of a tar header block: the sum of its bytes, with
// the eight bytes of the checksum field taken as spaces, written in octal.
func tarChecksumRight(block []byte) bool {
	const from, to = 148, 156
	field := bytes.Trim(block[from:to], " \x00")
	if len(field) == 0 {
		return false
	}
	want, err := strconv.ParseInt(string(field), 8, 64)
	if err != nil {
		return false
	}
	var sum int64
	for i, b := range block {
		if i >= from && i < to {
			b = ' '
		}
		sum += int64(b)
	}
	return sum == want
}
