package install

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// The release folder that `xdesign release-files` writes on Windows
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.2): xdesign.exe itself, Node.js
// and the app.
const (
	releaseSelf   = "xdesign.exe"
	releaseNode   = `runtime\node.exe`
	releaseServer = `app\server.mjs`
	releaseCLI    = `app\cli.mjs`
)

// The files of the running release, through the junction C:\Program Files\xDesign\current.
const (
	currentBin = currentLink + `\` + releaseSelf
	// currentNode and currentCLI run the app's own commands (node.exe app\cli.mjs).
	currentNode = currentLink + `\` + releaseNode
	currentCLI  = currentLink + `\` + releaseCLI
)

// adminPrefix starts the commands the messages give for the owner to run: nothing, as
// they run in a terminal opened as Administrator.
const adminPrefix = ""

// selfFile is the running file. Windows keeps it from being replaced or removed while it
// runs.
func selfFile() string {
	exe, err := os.Executable()
	if err != nil {
		return os.Args[0]
	}
	return exe
}

// programFilesDone reports whether the release is in place: its folder holds this release,
// the current junction points to it and the system PATH has current, so xdesign runs in a
// new terminal (as /usr/local/bin/xdesign on Linux).
func (r *run) programFilesDone() (bool, error) {
	if !r.junctionTo(currentLink, r.releaseTarget()) {
		return false, nil
	}
	if on, err := platform.OnSystemPath(currentLink); err != nil || !on {
		return false, err
	}
	return r.releaseFolderOK(r.releaseTarget())
}

// linkRelease points the junction current at the release folder and puts current on the
// system PATH.
func (r *run) linkRelease(ctx context.Context, env *Env) error {
	if err := r.switchJunction(ctx, env, r.releaseTarget(), currentLink); err != nil {
		return err
	}
	if on, err := platform.OnSystemPath(currentLink); err != nil || on {
		return err
	}
	return env.Do(fmt.Sprintf(`add %s to the system PATH (HKLM\%s, Path) and tell the running programs`, currentLink,
		`SYSTEM\CurrentControlSet\Control\Session Manager\Environment`), func() error {
		return platform.AddToSystemPath(currentLink)
	})
}

// junctionTo reports whether name is a link to the folder target.
func (r *run) junctionTo(name, target string) bool {
	return isJunctionTo(r.sys.FS, name, target)
}

// isJunctionTo reports whether name is a link to the folder target.
func isJunctionTo(fsys host.FS, name, target string) bool {
	link, err := fsys.Readlink(name)
	return err == nil && strings.EqualFold(linkTarget(link), filepath.Clean(target))
}

// linkTarget is the folder a junction names, without the prefix of an NT path (\??\) or of
// a long path (\\?\).
func linkTarget(link string) string {
	for _, prefix := range []string{`\??\`, `\\?\`} {
		link = strings.TrimPrefix(link, prefix)
	}
	return filepath.Clean(link)
}

// switchJunction points the directory junction name at the folder target (section 8.2):
// cmd's mklink /J makes it, as Go's os.Symlink makes a symbolic link instead, and the
// command shows in dry runs and the log as every other. Windows cannot rename a folder
// over another, so a junction to another release is removed first: only the link goes,
// never the folder it names. Anything else at name is left alone, with an error.
func (r *run) switchJunction(ctx context.Context, env *Env, target, name string) error {
	if r.junctionTo(name, target) {
		return nil
	}
	if lexists(r.sys.FS, name) {
		if _, err := r.sys.FS.Readlink(name); err != nil {
			return fmt.Errorf("%s exists but is not a junction; move it away and run the installer again", name)
		}
		if err := env.Do("rmdir "+name, func() error { return r.sys.FS.Remove(name) }); err != nil {
			return err
		}
	}
	_, err := env.Run(ctx, host.Command("cmd.exe", "/c", "mklink", "/J", name, target))
	return err
}

// The names of the junctions pointCurrent makes and moves beside current.
const (
	currentNext = currentLink + ".new"
	currentPrev = currentLink + ".old"
)

// pointCurrent points the junction C:\Program Files\xDesign\current at the release of
// version, with the services stopped (docs/plan/18-third-owner-list-2026-11-23.md section
// 8.6): a new junction is made beside it (current.new), then current is renamed to
// current.old, current.new to current, and current.old is removed: Windows cannot rename a
// folder over another, so this is the nearest to Linux's one-step switch. Junctions an
// interrupted switch left beside it are removed first, the links only; anything else
// there is an error.
func pointCurrent(ctx context.Context, env *Env, version string) error {
	fsys, target := env.Sys.FS, releaseDir(version)
	if isJunctionTo(fsys, currentLink, target) {
		return nil
	}
	for _, name := range []string{currentNext, currentPrev} {
		if !lexists(fsys, name) {
			continue
		}
		if _, err := fsys.Readlink(name); err != nil {
			return fmt.Errorf("%s exists but is not a junction; move it away and run the update again", name)
		}
		if err := env.Do("rmdir "+name, func() error { return fsys.Remove(name) }); err != nil {
			return err
		}
	}
	if _, err := env.Run(ctx, host.Command("cmd.exe", "/c", "mklink", "/J", currentNext, target)); err != nil {
		return err
	}
	if lexists(fsys, currentLink) {
		if _, err := fsys.Readlink(currentLink); err != nil {
			return fmt.Errorf("%s exists but is not a junction; move it away and run the installer again", currentLink)
		}
		if err := env.Do("move "+currentLink+" "+currentPrev, func() error { return fsys.Rename(currentLink, currentPrev) }); err != nil {
			return err
		}
	}
	if err := env.Do("move "+currentNext+" "+currentLink, func() error { return fsys.Rename(currentNext, currentLink) }); err != nil {
		return err
	}
	if lexists(fsys, currentPrev) {
		// current points at the release already; a junction left here is removed next time.
		if err := env.Do("rmdir "+currentPrev, func() error { return fsys.Remove(currentPrev) }); err != nil {
			env.Warnf("%s could not be removed: %v", currentPrev, err)
		}
	}
	return nil
}

// currentVersion is the version of the release the current junction names:
// C:\Program Files\xDesign\releases\<version>.
func currentVersion(link string) (string, bool) {
	dir, name := filepath.Split(linkTarget(link))
	if !strings.EqualFold(filepath.Clean(dir), releasesDir) || name == "" {
		return "", false
	}
	return name, true
}
