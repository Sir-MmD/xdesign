package release

import (
	"bytes"
	"strconv"
)

// KindHeadLen is how many bytes of a file DetectKind needs to tell its kind: a tar header
// is 512 bytes long, and its "ustar" magic sits at byte 257.
const KindHeadLen = 512

// The first bytes of the formats an update may be packed in. internal/unpack tells
// the same formats apart (unpack.Sniff) and must stay in step with this list; it cannot be
// shared, because unpack imports this package and this package imports the standard
// library only.
const (
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
)

// packedHead reports whether the first bytes of a file are those of a gzip, xz, zstd, zip,
// rar, tar, 7z or bzip2 file. Rar, 7z and bzip2 are included so that unpack.Resolve can refuse
// them with a sentence of their own instead of the update taking them for a checksum file.
func packedHead(head []byte) bool {
	for _, magic := range [...]string{magicGzip, magicXZ, magicZstd, magicZip, magicZipEmpty, magicZipSpanned, magicRar, magic7z} {
		if bytes.HasPrefix(head, []byte(magic)) {
			return true
		}
	}
	return isZstdSkippable(head) || isBzip2(head) || isTar(head)
}

// isZstdSkippable reports a skippable frame (0x184D2A50 to 0x184D2A5F, little-endian),
// which a zstd file may start with.
func isZstdSkippable(head []byte) bool {
	return len(head) >= 4 && head[0]&0xf0 == 0x50 && head[1] == 0x2a && head[2] == 0x4d && head[3] == 0x18
}

// isBzip2 reports "BZh", a digit from 1 to 9 and, when the bytes are there, the magic of
// the first block.
func isBzip2(head []byte) bool {
	if !bytes.HasPrefix(head, []byte(magicBzip2)) || len(head) < len(magicBzip2)+1 {
		return false
	}
	if d := head[len(magicBzip2)]; d < '1' || d > '9' {
		return false
	}
	rest := head[len(magicBzip2)+1:]
	return len(rest) < len(bzip2BlockMagic) || bytes.HasPrefix(rest, []byte(bzip2BlockMagic))
}

// isTar reports a tar header: "ustar" at byte 257 (POSIX and GNU tar), or, for the older
// tar files that have no magic, a header whose checksum field is right.
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
