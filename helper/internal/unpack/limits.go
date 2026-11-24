package unpack

import (
	"cmp"
	"errors"
	"io"
)

// The defaults of the Limits fields left at zero.
const (
	defaultPayload    = 512 << 20
	defaultEntries    = 1000
	defaultScan       = 4 << 30
	defaultZstdWindow = 128 << 20
	defaultDictionary = 256 << 20
)

// Limits bound what a packed file may ask of the server. A field left at zero takes its
// default. They are far above a real update (about 150 MB for a program or an archive), so a
// damaged or hostile file cannot fill the disk, the memory or the clock; every copy also goes
// through a limit reader, so a file that lies about its sizes cannot get past them.
type Limits struct {
	// Payload is the most bytes the payload may have (default 512 MiB; the panel's
	// maintreq.MaxUploadFile, and 1 GiB in the command).
	Payload int64
	// Entries is the most entries a container may hold, folders included (default 1000).
	Entries int
	// Scan is the most bytes read out of a compressed tar while looking through it (default
	// 4 GiB).
	Scan int64
	// ZstdWindow is the largest window a zstd frame may ask the decoder for (default
	// 128 MiB).
	ZstdWindow int64
	// Dictionary is the largest dictionary an xz stream (LZMA2) may ask for (default
	// 256 MiB).
	Dictionary int64
}

// withDefaults fills the fields left at zero.
func (l Limits) withDefaults() Limits {
	return Limits{
		Payload:    cmp.Or(l.Payload, defaultPayload),
		Entries:    cmp.Or(l.Entries, defaultEntries),
		Scan:       cmp.Or(l.Scan, defaultScan),
		ZstdWindow: cmp.Or(l.ZstdWindow, defaultZstdWindow),
		Dictionary: cmp.Or(l.Dictionary, defaultDictionary),
	}
}

// errScan reports that more than Limits.Scan bytes were read.
var errScan = errors.New("the scan limit was reached")

// capReader fails with errScan once more than left bytes were read through it; a stream
// that ends exactly at the limit still ends with io.EOF.
type capReader struct {
	r    io.Reader
	left int64
}

// Read implements io.Reader.
func (c *capReader) Read(p []byte) (int, error) {
	if c.left <= 0 {
		var one [1]byte
		n, err := c.r.Read(one[:])
		if n > 0 {
			return 0, errScan
		}
		return 0, err //nolint:wrapcheck // io.Reader contract: io.EOF stays as it is
	}
	if int64(len(p)) > c.left {
		p = p[:c.left]
	}
	n, err := c.r.Read(p)
	c.left -= int64(n)
	return n, err //nolint:wrapcheck // io.Reader contract: io.EOF stays as it is
}

// errDirectory reports that a zip file's directory is larger than the budget.
var errDirectory = errors.New("the zip directory is too large")

// zipDirectoryBytes is how many bytes archive/zip may read to find a zip file's directory.
// It reads the directory entry by entry until a header is wrong, and keeps every entry in
// memory, so a hostile file could hold millions; real directories take a few kilobytes.
const zipDirectoryBytes = 8 << 20

// budgetAt reads from r until left bytes were read, then fails with errDirectory; a
// negative left means no limit.
type budgetAt struct {
	r    io.ReaderAt
	left int64
}

// ReadAt implements io.ReaderAt.
func (b *budgetAt) ReadAt(p []byte, off int64) (int, error) {
	if b.left >= 0 {
		if int64(len(p)) > b.left {
			return 0, errDirectory
		}
		b.left -= int64(len(p))
	}
	return b.r.ReadAt(p, off) //nolint:wrapcheck // io.ReaderAt contract: io.EOF stays as it is
}
