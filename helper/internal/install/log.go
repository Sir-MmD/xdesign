package install

import (
	"fmt"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// DefaultLogPath is the log of the installer, updater and uninstaller
// (docs/plan/07-server-install-update.md section 3), root:root 0600.
const DefaultLogPath = platform.InstallLog

// Log is the install log: every step, command and output, with secrets masked. A Log
// without a writer discards everything. It is safe for concurrent use.
type Log struct {
	mu     sync.Mutex
	w      io.Writer
	masker *Masker
}

// NewLog returns a log that writes to w; w may be nil.
func NewLog(w io.Writer, masker *Masker) *Log {
	if masker == nil {
		masker = &Masker{}
	}
	return &Log{w: w, masker: masker}
}

// OpenLog opens the log file at path for appending, creating it root:root 0600, and
// makes sure an existing file has that owner and mode too (prepareLog and protectLog: on
// Windows its folder is made first, and only SYSTEM and Administrators read it).
func OpenLog(fsys host.FS, path string, masker *Masker) (*Log, io.Closer, error) {
	if err := prepareLog(fsys, path); err != nil {
		return nil, nil, fmt.Errorf("open the install log: %w", err)
	}
	w, err := fsys.OpenAppend(path, 0o600)
	if err != nil {
		return nil, nil, fmt.Errorf("open the install log: %w", err)
	}
	if err := protectLog(fsys, path); err != nil {
		return nil, nil, fmt.Errorf("protect the install log: %w", errorsJoinClose(err, w))
	}
	return NewLog(w, masker), w, nil
}

func errorsJoinClose(err error, c io.Closer) error {
	if cerr := c.Close(); cerr != nil {
		return fmt.Errorf("%w (closing: %w)", err, cerr)
	}
	return err
}

// Printf writes a time-stamped line (several for text with line breaks).
func (l *Log) Printf(format string, args ...any) {
	if l == nil || l.w == nil {
		return
	}
	text := l.masker.Mask(fmt.Sprintf(format, args...))
	stamp := time.Now().UTC().Format(time.RFC3339)
	l.mu.Lock()
	defer l.mu.Unlock()
	for line := range strings.SplitSeq(strings.TrimRight(text, "\n"), "\n") {
		fmt.Fprintf(l.w, "%s %s\n", stamp, line)
	}
}

// Command logs a command before it runs; kind is "run" or "query".
func (l *Log) Command(kind string, cmd host.Cmd) {
	l.Printf("%s: %s", kind, cmd.String())
	switch {
	case cmd.Stdin == nil:
	case cmd.SecretStdin:
		l.Printf("  standard input: hidden (secret)")
	default:
		l.Printf("  standard input: %d bytes", len(cmd.Stdin))
	}
}

// Result logs the outcome of a command.
func (l *Log) Result(cmd host.Cmd, res host.Result, err error) {
	if err != nil {
		l.Printf("  could not run: %v", err)
		return
	}
	l.Printf("  exit status %d", res.ExitCode)
	if cmd.SecretOutput {
		l.Printf("  output hidden: it contains credentials")
		return
	}
	l.output("  | ", res.Stdout)
	l.output("  ! ", res.Stderr)
}

func (l *Log) output(prefix string, b []byte) {
	text := strings.TrimRight(string(b), "\n")
	if text == "" {
		return
	}
	var sb strings.Builder
	for line := range strings.SplitSeq(text, "\n") {
		sb.WriteString(prefix + line + "\n")
	}
	l.Printf("%s", sb.String())
}
