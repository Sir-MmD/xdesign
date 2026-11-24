package install

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// stagingPrefix starts the name of a release folder that is still being written.
const stagingPrefix = ".staging-"

// releaseFilesCommand is the command of the xdesign file that writes the release folder
// (docs/plan/07-server-install-update.md sections 2 and 3: the xdesign file itself, Node.js
// and the app, named in files_linux.go and files_windows.go); it checks the payload
// against the SHA-256 the build stamped before it writes anything.
const releaseFilesCommand = "release-files"

// releaseTarget is the folder of this release under /opt/xdesign/releases.
func (r *run) releaseTarget() string {
	return releaseDir(r.version)
}

// releaseFolderOK reports whether dir holds this release: its xdesign file is this file,
// byte for byte, and Node.js and the app are there.
func (r *run) releaseFolderOK(dir string) (bool, error) {
	for _, name := range []string{releaseNode, releaseServer, releaseCLI} {
		if !exists(r.sys.FS, filepath.Join(dir, name)) {
			return false, nil
		}
	}
	have, err := fileSHA256(r.sys.FS, filepath.Join(dir, releaseSelf))
	if errors.Is(err, fs.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	want, err := r.selfSHA256()
	if err != nil {
		return false, err
	}
	return have == want, nil
}

// selfSHA256 is the SHA-256 of the running file, read once.
func (r *run) selfSHA256() (string, error) {
	if r.selfSum == "" {
		sum, err := fileSHA256(r.sys.FS, selfFile())
		if err != nil {
			return "", fmt.Errorf("read the running file: %w", err)
		}
		r.selfSum = sum
	}
	return r.selfSum, nil
}

// stepProgramFiles is step 4: the release folder /opt/xdesign/releases/<version>/,
// written by this file's release-files into a staging folder and renamed into place, and
// the links to it (linkRelease: the symbolic links switched atomically on Linux, section
// 3; the current junction and the system PATH on Windows).
func (r *run) stepProgramFiles() Step {
	return Step{
		Num: "4", ID: "program-files", Title: "Program files",
		Check: func(context.Context, *Env) (string, error) {
			done, err := r.programFilesDone()
			if err != nil || !done {
				return "", err
			}
			return fmt.Sprintf("xDesign %s is in place", r.version), nil
		},
		Act: r.placeRelease,
	}
}

func (r *run) placeRelease(ctx context.Context, env *Env) error {
	target := r.releaseTarget()
	if err := r.removeStaging(env); err != nil {
		return err
	}
	ok, err := r.releaseFolderOK(target)
	if err != nil {
		return err
	}
	if !ok {
		suffix, err := randomString(r.in.Rand, basePathChars, 8)
		if err != nil {
			return err
		}
		staging := filepath.Join(releasesDir, stagingPrefix+suffix)
		cmd := host.Command(selfFile(), releaseFilesCommand, staging)
		if _, err := env.runWaiting(ctx, "unpacking Node.js and the website", cmd); err != nil {
			return err
		}
		if !env.DryRun {
			if ok, err := r.releaseFolderOK(staging); err != nil || !ok {
				return errors.Join(err, fmt.Errorf("%s is not complete after %s; run the installer again", staging, releaseFilesCommand))
			}
		}
		if lexists(r.sys.FS, target) {
			// A damaged copy of this version; program files only, never data. Windows keeps
			// the files of a running program, so the service stops first there.
			if err := r.stopForFiles(ctx, env, target); err != nil {
				return err
			}
			if err := env.Do("rm -rf "+target, func() error { return r.sys.FS.RemoveAll(target) }); err != nil {
				return err
			}
		}
		if err := env.Do(fmt.Sprintf("mv -T %s %s", staging, target), func() error { return r.sys.FS.Rename(staging, target) }); err != nil {
			return err
		}
	}
	return r.linkRelease(ctx, env)
}

// removeStaging deletes staging folders an interrupted run left behind.
func (r *run) removeStaging(env *Env) error {
	entries, err := r.sys.FS.ReadDir(releasesDir)
	if err != nil {
		if errors.Is(err, fs.ErrNotExist) {
			return nil
		}
		return fmt.Errorf("list %s: %w", releasesDir, err)
	}
	for _, e := range entries {
		if !strings.HasPrefix(e.Name(), stagingPrefix) {
			continue
		}
		p := filepath.Join(releasesDir, e.Name())
		if err := env.Do("rm -rf "+p, func() error { return r.sys.FS.RemoveAll(p) }); err != nil {
			return err
		}
	}
	return nil
}
