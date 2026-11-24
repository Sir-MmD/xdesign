// Package logfile is the log of the Windows service (docs/plan/18-third-owner-list-2026-11-23.md
// section 8.2, D-750): the helper's lines and the app's output in one file,
// C:\ProgramData\xDesign\logs\xdesign.log, each line with its time in front as the journal
// shows it. A new file starts at 10 MB, and the 5 before it are kept as xdesign.log.1 (the
// newest) to xdesign.log.5. `xdesign logs` reads them. On Linux the journal keeps the lines.
package logfile

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime/debug"
	"strconv"
	"sync"
	"time"
)

// The files (section 8.2).
const (
	// MaxSize is the size at which a new file starts: 10 MB.
	MaxSize = 10 * 1000 * 1000
	// Keep is how many older files are kept: Rotated 1, the newest, to 5.
	Keep = 5
)

const (
	// maxLine bounds a line that has not ended: its first 64 KiB are written as a line.
	maxLine = 64 << 10
	// retryWait is the wait before a new file is tried again after it could not start
	// (another program holds the file open without sharing its renaming), and before the
	// file is opened again after it could not be.
	retryWait = time.Minute
	// timeFormat is the time in front of each line: local, with milliseconds and the
	// offset, as journalctl -o short-iso-precise shows it.
	timeFormat = "2006-01-02T15:04:05.000Z07:00"
	fileMode   = 0o600
	dirMode    = 0o700
)

// Rotated returns the name of the older file i of the log at path: <path>.1, the newest,
// to <path>.5. <path>.0 is the current file for an instant while a new one starts.
func Rotated(path string, i int) string {
	return path + "." + strconv.Itoa(i)
}

// File is the log file. Its writers (Writer) add the lines; it starts a new file when the
// next line would pass MaxSize.
type File struct {
	path string

	mu   sync.Mutex
	f    *os.File
	size int64
	// retryAt is when a new file or an open that failed is tried again.
	retryAt time.Time
	// crash: the process's fatal errors go to the file too (CrashOutput).
	crash  bool
	closed bool
}

// Open opens the log at path for appending, and creates it and its folder when they are
// missing (the folder takes the permissions of the folder above it).
func Open(path string) (*File, error) {
	if err := os.MkdirAll(filepath.Dir(path), dirMode); err != nil {
		return nil, fmt.Errorf("the log's folder: %w", err)
	}
	l := &File{path: path}
	if err := l.open(); err != nil {
		return nil, err
	}
	return l, nil
}

// open opens the file at l.path for appending. l.mu is held, or l is new.
func (l *File) open() error {
	f, err := os.OpenFile(l.path, os.O_WRONLY|os.O_CREATE|os.O_APPEND, fileMode)
	if err != nil {
		return fmt.Errorf("the log: %w", err)
	}
	fi, err := f.Stat()
	if err != nil {
		_ = f.Close() // not written
		return fmt.Errorf("the log: %w", err)
	}
	l.f, l.size = f, fi.Size()
	if l.crash {
		_ = debug.SetCrashOutput(f, debug.CrashOptions{}) // the file opened; it takes a copy of the handle
	}
	return nil
}

// CrashOutput sends the process's fatal errors and unhandled panics to the file too (the
// service has no standard error), without a time in front, and keeps doing so in each new
// file.
func (l *File) CrashOutput() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.crash = true
	if l.f != nil {
		_ = debug.SetCrashOutput(l.f, debug.CrashOptions{}) // the file is open; it takes a copy of the handle
	}
}

// Close closes the file; what the writers get after it is lost.
func (l *File) Close() error {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.closed = true
	if l.f == nil {
		return nil
	}
	l.releaseCrash()
	err := l.f.Close()
	l.f = nil
	if err != nil {
		return fmt.Errorf("the log: %w", err)
	}
	return nil
}

// releaseCrash closes the crash output's copy of the handle, which would keep the file from
// being renamed. l.mu is held.
func (l *File) releaseCrash() {
	if l.crash {
		_ = debug.SetCrashOutput(nil, debug.CrashOptions{}) // nil only closes the copy
	}
}

// Writer returns a writer of its own into the log: each line it is given is written whole,
// with the time in front, and a line longer than 64 KiB is cut. Each source of lines (the
// helper, the app's output) needs its own, so that parts of their lines never mix. It never
// fails: a line the file does not take is lost, so that the app never waits on its output.
func (l *File) Writer() io.Writer {
	return &lineWriter{log: l}
}

// lineWriter keeps the part of a line that has not ended until its end comes.
type lineWriter struct {
	log *File
	mu  sync.Mutex
	buf []byte
}

func (w *lineWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.buf = append(w.buf, p...)
	start := 0
	for start < len(w.buf) {
		end := bytes.IndexByte(w.buf[start:], '\n') + 1
		if end == 0 {
			if len(w.buf)-start < maxLine {
				break
			}
			end = maxLine
		}
		w.log.writeLine(w.buf[start : start+end])
		start += end
	}
	w.buf = append(w.buf[:0], w.buf[start:]...)
	return len(p), nil
}

// writeLine writes one line with the time in front, after a new file starts when the line
// would pass MaxSize.
func (l *File) writeLine(line []byte) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	b := make([]byte, 0, len(timeFormat)+2+len(line))
	b = now.AppendFormat(b, timeFormat)
	b = append(b, ' ')
	b = append(b, line...)
	if b[len(b)-1] != '\n' {
		b = append(b, '\n')
	}
	if l.f != nil && l.size > 0 && l.size+int64(len(b)) > MaxSize && !now.Before(l.retryAt) {
		l.rotate(now)
	}
	if l.f == nil {
		if l.closed || now.Before(l.retryAt) {
			return
		}
		if err := l.open(); err != nil {
			l.retryAt = now.Add(retryWait)
			return
		}
	}
	n, _ := l.f.Write(b) // a line the file does not take is lost
	l.size += int64(n)
}

// rotate starts a new file: the current one becomes <path>.1, and the older ones move one
// place, <path>.5 the oldest kept. The current file is first renamed to <path>.0, so that a
// file another program holds open (without sharing its renaming) stops the rotation before
// any file moved; the lines then go on in the same file, and the rotation is tried again a
// minute later. l.mu is held.
func (l *File) rotate(now time.Time) {
	l.releaseCrash()
	_ = l.f.Close() // written line by line, nothing is kept back
	l.f = nil
	if err := os.Rename(l.path, Rotated(l.path, 0)); err != nil {
		l.retryAt = now.Add(retryWait)
	} else {
		for i := Keep - 1; i >= 0; i-- {
			_ = os.Rename(Rotated(l.path, i), Rotated(l.path, i+1)) // a file that does not exist yet is skipped
		}
	}
	if err := l.open(); err != nil {
		l.retryAt = now.Add(retryWait)
	}
}
