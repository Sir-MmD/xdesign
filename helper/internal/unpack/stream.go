package unpack

import (
	"bufio"
	"compress/gzip"
	"encoding/binary"
	"errors"
	"fmt"
	"hash/crc32"
	"io"

	"github.com/klauspost/compress/zstd"
	"github.com/ulikunitz/xz"
)

// streamBuffer is the size of the buffer between the file and a decompressor.
const streamBuffer = 256 << 10

// decompress opens the gzip, xz or zstd stream that is the whole file, and returns its
// content with a function that releases it; name is what the file is called in a sentence
// ("xz", "tar.xz"). The content is not capped: whoever reads it caps what they read. A zstd
// frame that asks for a window above Limits.ZstdWindow, and an xz stream whose dictionary is
// above Limits.Dictionary, are refused before they can take the memory.
func (s *source) decompress(f Format, name string) (io.Reader, func(), error) {
	in := bufio.NewReaderSize(s.section(), streamBuffer)
	switch f {
	case FormatGzip:
		zr, err := gzip.NewReader(in)
		if err != nil {
			return nil, nil, s.content(err, name)
		}
		return zr, func() { _ = zr.Close() }, nil // reading only: closing cannot lose data
	case FormatXZ:
		dict, err := s.xzDictionary()
		if errors.Is(err, errXZFilter) {
			return nil, nil, badFilter(name)
		}
		if err != nil {
			return nil, nil, s.content(err, name)
		}
		if dict > s.lim.Dictionary {
			return nil, nil, dictionaryTooLarge(name, dict, s.lim.Dictionary)
		}
		// One stream: a later one could ask for a dictionary this check has not seen.
		zr, err := xz.ReaderConfig{SingleStream: true}.NewReader(in)
		if err != nil {
			return nil, nil, s.content(err, name)
		}
		return zr, func() {}, nil
	case FormatZstd:
		zr, err := zstd.NewReader(in,
			zstd.WithDecoderMaxWindow(uint64(s.lim.ZstdWindow)), //nolint:gosec // G115: withDefaults makes it positive
			zstd.WithDecoderConcurrency(1), zstd.WithDecoderLowmem(true))
		if err != nil {
			return nil, nil, fmt.Errorf("start the zstd decoder: %w", err)
		}
		return zr, zr.Close, nil
	case FormatUnknown, FormatELF, FormatPE, FormatZip, FormatRar, FormatTar, Format7z, FormatBzip2:
	}
	return nil, nil, fmt.Errorf("unpack: %s is not a compressed stream", f)
}

// LZMA2 and xz constants (https://tukaani.org/xz/xz-file-format.txt).
const (
	// xzStreamHeader is the size of the stream header: the magic, the stream flags and the
	// CRC32 of the flags.
	xzStreamHeader = 12
	// xzMaxBlockHeader is the largest block header (the size byte times four, plus four).
	xzMaxBlockHeader = 1024
	// xzFilterLZMA2 is the ID of the LZMA2 filter; its one property byte holds the
	// dictionary size.
	xzFilterLZMA2 = 0x21
	// xzMaxDictionaryBits is the largest property byte of LZMA2; it means 4 GiB - 1.
	xzMaxDictionaryBits = 40
)

// errXZHeader is a stream or block header of an xz file that is not right, errXZFilter a
// filter the xz library cannot undo (it reads LZMA2 only; the other filters are the
// converters for programs, such as --x86).
var (
	errXZHeader = errors.New("the xz header is not right")
	errXZFilter = errors.New("the xz file uses a filter besides LZMA2")
)

// xzDictionary returns the dictionary size the first block of the xz file asks for, or 0
// when the file has no blocks. The xz library allocates what the stream says without a
// limit, so the stream must be looked at before it is handed over.
func (s *source) xzDictionary() (int64, error) {
	buf := make([]byte, xzStreamHeader+xzMaxBlockHeader)
	n, err := s.ReadAt(buf, 0)
	if err != nil && !errors.Is(err, io.EOF) {
		return 0, err
	}
	buf = buf[:n]
	if len(buf) < xzStreamHeader+1 || !hasMagic(buf, magicXZ) {
		return 0, errXZHeader
	}
	if crc32.ChecksumIEEE(buf[6:8]) != binary.LittleEndian.Uint32(buf[8:xzStreamHeader]) {
		return 0, errXZHeader
	}
	block := buf[xzStreamHeader:]
	if block[0] == 0 {
		return 0, nil // the index follows the stream header: no blocks
	}
	size := (int(block[0]) + 1) * 4
	if len(block) < size {
		return 0, io.ErrUnexpectedEOF
	}
	block = block[:size]
	body := block[:size-4]
	if crc32.ChecksumIEEE(body) != binary.LittleEndian.Uint32(block[size-4:]) {
		return 0, errXZHeader
	}
	flags := body[1]
	if flags&0x3c != 0 {
		return 0, errXZHeader // reserved bits
	}
	pos := 2
	for _, sizeField := range []byte{0x40, 0x80} { // the compressed and the uncompressed size
		if flags&sizeField != 0 {
			_, k := xzNumber(body[pos:])
			if k == 0 {
				return 0, errXZHeader
			}
			pos += k
		}
	}
	// The filters follow. The library undoes LZMA2 only, and LZMA2 is always the last filter
	// of a chain, so a file with any other first filter is one it cannot read at all.
	id, k := xzNumber(body[pos:])
	if k == 0 {
		return 0, errXZHeader
	}
	pos += k
	if id != xzFilterLZMA2 {
		return 0, errXZFilter
	}
	length, k := xzNumber(body[pos:])
	if k == 0 || length != 1 || pos+k+length > len(body) {
		return 0, errXZHeader
	}
	dictBits := body[pos+k]
	if dictBits > xzMaxDictionaryBits {
		return 0, errXZHeader
	}
	return lzma2Dictionary(dictBits), nil
}

// xzNumber reads a "multibyte integer" of the xz format at the start of b: 7 bits per byte,
// the lowest first, a set high bit meaning that another byte follows. It returns the value
// and the number of bytes it took, 0 bytes for one that is cut short or longer than eight
// bytes (the format allows nine; no size or ID of a real file needs them).
func xzNumber(b []byte) (value, length int) {
	for i := 0; i < len(b) && i < 8; i++ {
		value |= int(b[i]&0x7f) << (7 * i)
		if b[i]&0x80 == 0 {
			return value, i + 1
		}
	}
	return 0, 0
}

// lzma2Dictionary turns the property byte of the LZMA2 filter into a dictionary size.
func lzma2Dictionary(bits byte) int64 {
	if bits == xzMaxDictionaryBits {
		return 1<<32 - 1
	}
	return int64(2|(bits&1)) << (bits/2 + 11)
}
