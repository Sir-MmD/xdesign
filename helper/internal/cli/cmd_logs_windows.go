package cli

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"time"

	"golang.org/x/sys/windows"

	"github.com/Sir-MmD/xdesign/helper/internal/logfile"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

const logsUsage = `Usage: xdesign logs [-f] [--lines N]

Shows the last lines of the xdesign service's log
(docs/plan/18-third-owner-list-2026-11-23.md section 8.2): the lines of the service and of
the website in C:\ProgramData\xDesign\logs\xdesign.log, each with its time; a new file
starts at 10 MB, and the 5 before it are kept (xdesign.log.1 to .5). Run it in a terminal
opened as Administrator.

Flags:
  -f           go on showing the new lines as they come, after a new file too (Ctrl-C ends it)
  --lines N    how many of the last lines to show (default 100)
`

// logsRefused follows "xdesign logs: " when the process may not read the log: its folder
// opens to Administrators, LocalSystem and the service's account only (section 8.2).
const logsRefused = "Run this in a terminal opened as Administrator."

// logFollowInterval is how often -f looks for new lines, and for the new file once one
// started.
const logFollowInterval = 500 * time.Millisecond

// showLogs shows the last lines of the service's log, C:\ProgramData\xDesign\logs\xdesign.log
// (internal/logfile), from the older files too when the current one has fewer, and with
// follow the new lines as they come until Ctrl-C.
func showLogs(ctx context.Context, env *Env, follow bool, lines int) int {
	if !platform.Elevated() {
		fmt.Fprintln(env.Stderr, "xdesign logs: "+logsRefused)
		return ExitError
	}
	path := platform.ServiceLog
	text, cur, err := lastLines(path, lines)
	if err != nil {
		fmt.Fprintf(env.Stderr, "xdesign logs: %v\n", err)
		return ExitError
	}
	if _, err := env.Stdout.Write(text); err != nil {
		if cur != nil {
			_ = cur.Close() // only read
		}
		fmt.Fprintf(env.Stderr, "xdesign logs: %v\n", err)
		return ExitError
	}
	if cur == nil && len(text) == 0 {
		if !follow {
			fmt.Fprintf(env.Stderr, "xdesign logs: %s does not exist yet: the service xdesign writes it once it starts\n", path)
			return ExitError
		}
		fmt.Fprintf(env.Stderr, "xdesign logs: waiting for %s: the service xdesign writes it once it starts\n", path)
	}
	if !follow {
		if cur != nil {
			_ = cur.Close() // only read
		}
		return ExitOK
	}
	return followLog(ctx, env, path, cur)
}

// lastLines returns the last n lines of the log at path, from the older files too when the
// current one has fewer, and the current file open at its end for -f (nil when it does not
// exist).
func lastLines(path string, n int) ([]byte, *os.File, error) {
	cur, err := openShared(path)
	if errors.Is(err, fs.ErrNotExist) {
		cur = nil
	} else if err != nil {
		return nil, nil, err
	}
	var parts [][]byte // the newest first
	need := n
	if cur != nil {
		data, err := io.ReadAll(cur)
		if err != nil {
			_ = cur.Close() // only read
			return nil, nil, fmt.Errorf("read %s: %w", path, err)
		}
		part, got := lastOf(data, need)
		parts, need = append(parts, part), need-got
	}
	for i := 1; i <= logfile.Keep && need > 0; i++ {
		data, err := readShared(logfile.Rotated(path, i))
		if errors.Is(err, fs.ErrNotExist) {
			break
		}
		if err != nil {
			if cur != nil {
				_ = cur.Close() // only read
			}
			return nil, nil, err
		}
		part, got := lastOf(data, need)
		parts, need = append(parts, part), need-got
	}
	var text []byte
	for i := len(parts) - 1; i >= 0; i-- {
		text = append(text, parts[i]...)
	}
	return text, cur, nil
}

// lastOf returns the end of data that holds its last n lines, and how many lines that is
// (fewer than n when data holds fewer). A last line without its end counts as a line.
func lastOf(data []byte, n int) ([]byte, int) {
	if n <= 0 || len(data) == 0 {
		return nil, 0
	}
	end := len(data)
	if data[end-1] == '\n' {
		end--
	}
	count := 0
	for i := end - 1; i >= 0; i-- {
		if data[i] != '\n' {
			continue
		}
		if count++; count == n {
			return data[i+1:], n
		}
	}
	return data, count + 1
}

// followLog shows the lines added to the log at path after where cur stands (nil: the file
// does not exist yet) until ctx ends. When the service starts a new file, it shows the
// rest of the old one, then the new one from its start.
func followLog(ctx context.Context, env *Env, path string, cur *os.File) int {
	defer func() {
		if cur != nil {
			_ = cur.Close() // only read
		}
	}()
	t := time.NewTicker(logFollowInterval)
	defer t.Stop()
	for {
		// The file at path is opened before the old one is read to its end: the service
		// renames the old one only after its last line there. Another error than a missing
		// file (a program holding it for an instant) leaves cur as it is until the next look.
		next, err := openShared(path)
		gone := errors.Is(err, fs.ErrNotExist)
		if next != nil && cur != nil && sameFile(cur, next) {
			_ = next.Close() // the file already open
			next = nil
		}
		if cur != nil {
			if _, err := io.Copy(env.Stdout, cur); err != nil {
				if next != nil {
					_ = next.Close() // only opened
				}
				fmt.Fprintf(env.Stderr, "xdesign logs: %v\n", err)
				return ExitError
			}
			if next != nil || gone {
				// A new file started (or is starting): the old one was read to its end.
				_ = cur.Close() // only read
				cur = nil
			}
		}
		if next != nil {
			cur = next
			if _, err := io.Copy(env.Stdout, cur); err != nil {
				fmt.Fprintf(env.Stderr, "xdesign logs: %v\n", err)
				return ExitError
			}
		}
		select {
		case <-ctx.Done():
			return ExitOK
		case <-t.C:
		}
	}
}

// sameFile reports whether a and b are open on the same file; true when that cannot be
// told, so that -f never shows a file twice.
func sameFile(a, b *os.File) bool {
	ai, err := a.Stat()
	if err != nil {
		return true
	}
	bi, err := b.Stat()
	if err != nil {
		return true
	}
	return os.SameFile(ai, bi)
}

// openShared opens the file at path for reading without keeping the service from renaming
// it when a new file starts (FILE_SHARE_DELETE, which os.Open leaves out).
func openShared(path string) (*os.File, error) {
	p, err := windows.UTF16PtrFromString(path)
	if err != nil {
		return nil, &fs.PathError{Op: "open", Path: path, Err: err}
	}
	h, err := windows.CreateFile(p, windows.GENERIC_READ, windows.FILE_SHARE_READ|windows.FILE_SHARE_WRITE|windows.FILE_SHARE_DELETE,
		nil, windows.OPEN_EXISTING, windows.FILE_ATTRIBUTE_NORMAL, 0)
	if err != nil {
		return nil, &fs.PathError{Op: "open", Path: path, Err: err}
	}
	return os.NewFile(uintptr(h), path), nil
}

// readShared reads the whole file at path, opened as openShared does.
func readShared(path string) ([]byte, error) {
	f, err := openShared(path)
	if err != nil {
		return nil, err
	}
	defer func() { _ = f.Close() }() // only read
	data, err := io.ReadAll(f)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	return data, nil
}
