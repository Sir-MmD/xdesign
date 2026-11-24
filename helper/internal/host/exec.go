package host

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"time"
)

// ExecRunner runs commands as child processes.
//
// Commands inherit the environment with LC_ALL=C.UTF-8 added, so the output the
// installer parses ("Status: active", "running") is never translated, while
// non-ASCII text such as the Persian check of the database locale stays UTF-8.
// Cmd.Env entries come after it and win.
type ExecRunner struct{}

// waitDelay bounds how long Run waits for the output pipes after the context ended
// and the process was killed, for example when a grandchild keeps them open.
const waitDelay = 5 * time.Second

// Run implements [Runner].
func (r ExecRunner) Run(ctx context.Context, cmd Cmd) (Result, error) {
	var stdout, stderr bytes.Buffer
	code, err := r.Stream(ctx, cmd, &stdout, &stderr)
	return Result{Stdout: stdout.Bytes(), Stderr: stderr.Bytes(), ExitCode: code}, err
}

// Stream implements [Streamer].
func (ExecRunner) Stream(ctx context.Context, cmd Cmd, stdout, stderr io.Writer) (int, error) {
	timeout := cmd.Timeout
	if timeout <= 0 {
		timeout = DefaultTimeout
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// The installer and the admin commands run fixed programs with arguments they
	// build; no shell is involved, so arguments cannot inject commands.
	c := exec.CommandContext(ctx, cmd.Name, cmd.Args...) //nolint:gosec // G204: see above
	c.Env = append(append(os.Environ(), "LC_ALL=C.UTF-8"), cmd.Env...)
	switch {
	case cmd.StdinFile != nil:
		c.Stdin = cmd.StdinFile // handed over as it is: the program can seek in it
	case cmd.Stdin != nil:
		c.Stdin = bytes.NewReader(cmd.Stdin)
	}
	c.Stdout = stdout
	c.Stderr = stderr
	c.WaitDelay = waitDelay

	var err error
	if cmd.StatusOut != nil {
		err = runWithStatus(c, cmd.StatusOut)
	} else {
		err = c.Run()
	}
	var exitErr *exec.ExitError
	switch {
	case err == nil:
		return 0, nil
	case ctx.Err() != nil:
		return 0, fmt.Errorf("%s: %w", cmd.String(), ctx.Err())
	case errors.As(err, &exitErr) && exitErr.ExitCode() >= 0:
		return exitErr.ExitCode(), nil
	case errors.Is(err, exec.ErrNotFound):
		return 127, fmt.Errorf("%s: %w", cmd.Name, ErrCommandNotFound)
	default:
		return 0, fmt.Errorf("run %s: %w", cmd.String(), err)
	}
}

// runWithStatus runs c with a pipe as its file descriptor 3 and copies what the
// program writes there to status. The parent's end for writing is closed right after
// the start, so the copy ends when the program (and every child that inherited the
// descriptor) closed it; a child that keeps it open longer than waitDelay after the
// program ended is not waited for.
func runWithStatus(c *exec.Cmd, status io.Writer) error {
	r, w, err := os.Pipe()
	if err != nil {
		return fmt.Errorf("open the status pipe: %w", err)
	}
	c.ExtraFiles = []*os.File{w}
	if err := c.Start(); err != nil {
		_ = r.Close() // nothing was read yet
		_ = w.Close()
		return err //nolint:wrapcheck // Stream reads the exec error itself, like c.Run's
	}
	_ = w.Close() // the child has its own copy now
	copied := make(chan struct{})
	go func() {
		defer close(copied)
		_, _ = io.Copy(status, r) // the program's progress lines: a failed write only loses progress
	}()
	err = c.Wait()
	select {
	case <-copied:
	case <-time.After(waitDelay):
	}
	_ = r.Close() // ends a copy still blocked by a child that kept the descriptor
	<-copied
	return err //nolint:wrapcheck // as above
}
