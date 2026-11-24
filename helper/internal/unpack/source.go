package unpack

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"

	"github.com/klauspost/compress/zstd"
)

// source is the packed file as the readers see it. Every read first asks whether the caller
// still wants the answer, and a failure of the file system is remembered, so that it is
// reported as a failure and not mistaken for a damaged archive.
type source struct {
	// stopped is the context's Err.
	stopped func() error
	r       io.ReaderAt
	size    int64
	lim     Limits
	// ioErr is the first read error of r that was not io.EOF.
	ioErr error
}

func newSource(ctx context.Context, r io.ReaderAt, size int64, lim Limits) *source {
	return &source{stopped: ctx.Err, r: r, size: size, lim: lim}
}

// errOffset reports a read at a negative offset, which a damaged zip file's directory makes
// the zip reader ask for. It is the file's fault, not the file system's.
var errOffset = errors.New("the file points outside itself")

// ReadAt implements io.ReaderAt.
func (s *source) ReadAt(p []byte, off int64) (int, error) {
	if err := s.stopped(); err != nil {
		return 0, err
	}
	if off < 0 {
		return 0, errOffset
	}
	n, err := s.r.ReadAt(p, off)
	if err != nil && !errors.Is(err, io.EOF) && s.ioErr == nil {
		s.ioErr = err
	}
	return n, err //nolint:wrapcheck // io.ReaderAt contract: io.EOF stays as it is
}

// section returns a reader of the whole file.
func (s *source) section() *io.SectionReader {
	return io.NewSectionReader(s, 0, s.size)
}

// head returns the first headLen bytes of the file (fewer for a shorter file).
func (s *source) head() ([]byte, error) {
	buf := make([]byte, min(int64(headLen), s.size))
	n, err := s.ReadAt(buf, 0)
	if err != nil && !errors.Is(err, io.EOF) {
		return nil, s.failure(err)
	}
	return buf[:n], nil
}

// sha256 returns the SHA-256 of the whole file, in lower-case hexadecimal.
func (s *source) sha256() (string, error) {
	h := sha256.New()
	if _, err := io.CopyBuffer(h, s.section(), make([]byte, 1<<20)); err != nil {
		return "", s.failure(err)
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// failure turns an error of reading the file into the error to return: the context's, or
// the file system's. It is only called for errors that no content can explain.
func (s *source) failure(err error) error {
	if cerr := s.stopped(); cerr != nil {
		return cerr
	}
	if s.ioErr != nil {
		return fmt.Errorf("read the packed file: %w", s.ioErr)
	}
	return fmt.Errorf("read the packed file: %w", err)
}

// content turns an error met while reading the content of the packed file, called name
// ("zip", "tar.xz"), into the error to return: a failure of the caller or the file system
// as it is, a refusal for what the content explains (a limit, a password, a damaged file).
func (s *source) content(err error, name string) error {
	var refusal *Error
	switch {
	case errors.As(err, &refusal):
		return refusal
	case s.stopped() != nil:
		return s.stopped()
	case s.ioErr != nil:
		return fmt.Errorf("read the packed file: %w", s.ioErr)
	case errors.Is(err, errScan):
		return scanTooLarge(name, s.lim.Scan)
	case errors.Is(err, errDirectory):
		return tooMany(name, s.lim.Entries)
	case errors.Is(err, zstd.ErrWindowSizeExceeded):
		return windowTooLarge(name, s.lim.ZstdWindow)
	}
	return damaged(name, err)
}
