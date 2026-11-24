package app

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
	"github.com/Sir-MmD/xdesign/helper/internal/payload"
)

// releaseFilesCommand is `xdesign release-files <dir>`, left out of the help: the install,
// the update and the release build run it, the owner does not. Copied from xWriter's
// `xwriter admin release-files` and adapted to the payload.
const releaseFilesCommand = "release-files"

const releaseFilesUsage = `Usage: xdesign release-files <dir>

Writes the release folder of this file into <dir>: <dir>/xdesign (a copy of this file,
mode 0755; xdesign.exe on Windows) and the payload it carries, unpacked into <dir>/runtime/
and <dir>/app/, after checking it against the SHA-256 the build stamped
(docs/plan/07-server-install-update.md sections 2 and 6.3). <dir> is created with mode 0755 when it does not exist and must be
empty when it does. It prints the folder. A development build carries no payload and is
refused.
`

// The entries of a release folder that release-files writes (07 section 1), beside the copy
// of this file (releaseSelf, in release_files_linux.go and release_files_windows.go).
const (
	releaseRuntime = "runtime"
	releaseApp     = "app"
)

// Modes of the release folder and of the copy of this file, whatever the umask.
const (
	releaseDirMode  os.FileMode = 0o755
	releaseSelfMode os.FileMode = 0o755
)

// cmdReleaseFiles is `xdesign release-files <dir>`.
func cmdReleaseFiles(_ context.Context, args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("xdesign "+releaseFilesCommand, flag.ContinueOnError)
	fs.SetOutput(stderr)
	fs.Usage = func() { fmt.Fprint(stderr, releaseFilesUsage) }
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return exitOK
		}
		return exitUsage
	}
	if fs.NArg() != 1 {
		fmt.Fprint(stderr, "xdesign release-files: name the folder\n\n"+releaseFilesUsage)
		return exitUsage
	}
	dir, err := filepath.Abs(fs.Arg(0))
	if err != nil {
		fmt.Fprintf(stderr, "xdesign release-files: %v\n", err)
		return exitError
	}
	if err := writeReleaseFiles(dir); err != nil {
		fmt.Fprintf(stderr, "xdesign release-files: %v\n", err)
		return exitError
	}
	fmt.Fprintln(stdout, dir)
	return exitOK
}

// writeReleaseFiles writes the release folder of the running file into dir: the payload,
// checked first, then the file itself. A failure removes what it wrote.
func writeReleaseFiles(dir string) error {
	p, err := payload.Open(buildinfo.Get().PayloadSHA256)
	if err != nil {
		return err
	}
	created := false
	switch entries, err := os.ReadDir(dir); {
	case errors.Is(err, os.ErrNotExist):
		if err := os.MkdirAll(dir, releaseDirMode); err != nil {
			return fmt.Errorf("create %s: %w", dir, err)
		}
		created = true
	case err != nil:
		return fmt.Errorf("check %s: %w", dir, err)
	case len(entries) > 0:
		return fmt.Errorf("%s is not empty; remove it or name another folder", dir)
	}
	err = func() error {
		if err := os.Chmod(dir, releaseDirMode); err != nil {
			return fmt.Errorf("set the mode of %s: %w", dir, err)
		}
		if err := p.Extract(dir); err != nil {
			return err
		}
		return copySelf(filepath.Join(dir, releaseSelf))
	}()
	if err != nil {
		// Best effort: the error above is what matters.
		if created {
			_ = os.RemoveAll(dir)
		} else {
			for _, name := range []string{releaseSelf, releaseRuntime, releaseApp} {
				_ = os.RemoveAll(filepath.Join(dir, name))
			}
		}
		return err
	}
	return nil
}

// copySelf writes the running file to dst, a new file with mode 0755.
func copySelf(dst string) error {
	self, err := selfPath()
	if err != nil {
		return err
	}
	src, err := os.Open(self) //nolint:gosec // G304: the running file
	if err != nil {
		return fmt.Errorf("read the running file (%s): %w", self, err)
	}
	defer func() { _ = src.Close() }() // read-only: closing cannot lose data

	f, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_EXCL, releaseSelfMode) //nolint:gosec // G304: the release folder the caller named
	if err != nil {
		return fmt.Errorf("create %s: %w", dst, err)
	}
	_, err = io.Copy(f, src)
	if err := errors.Join(err, f.Close()); err != nil {
		return fmt.Errorf("write %s: %w", dst, err)
	}
	if err := os.Chmod(dst, releaseSelfMode); err != nil {
		return fmt.Errorf("set the mode of %s: %w", dst, err)
	}
	return nil
}
