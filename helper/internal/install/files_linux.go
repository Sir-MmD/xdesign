package install

import (
	"context"
	"fmt"
	"path"
	"strings"
)

// The release folder that `xdesign release-files` writes (docs/plan/07-server-install-
// update.md sections 2 and 3): the xdesign file itself, Node.js and the app.
const (
	releaseSelf   = "xdesign"
	releaseNode   = "runtime/node"
	releaseServer = "app/server.mjs"
	releaseCLI    = "app/cli.mjs"
)

// The files of the running release, through /opt/xdesign/current.
const (
	currentBin = currentLink + "/" + releaseSelf
	// currentNode and currentCLI run the app's own commands (node app/cli.mjs).
	currentNode = currentLink + "/" + releaseNode
	currentCLI  = currentLink + "/" + releaseCLI
)

// adminPrefix starts the commands the messages give for the owner to run: as root.
const adminPrefix = "sudo "

// selfFile is the running file as the kernel sees it, also when its file was replaced or
// removed since it started.
func selfFile() string {
	return "/proc/self/exe"
}

// programFilesDone reports whether the release is in place: its folder holds this release,
// current points to it and /usr/local/bin/xdesign to current's xdesign.
func (r *run) programFilesDone() (bool, error) {
	if link, err := r.sys.FS.Readlink(currentLink); err != nil || link != "releases/"+r.version {
		return false, nil //nolint:nilerr // a missing or other link means the act must set it
	}
	if link, err := r.sys.FS.Readlink(binLink); err != nil || link != currentBin {
		return false, nil //nolint:nilerr // as above
	}
	return r.releaseFolderOK(r.releaseTarget())
}

// linkRelease points /opt/xdesign/current at the release folder and /usr/local/bin/xdesign
// at current's xdesign, each switched in one step.
func (r *run) linkRelease(_ context.Context, env *Env) error {
	if err := switchLink(env, "releases/"+r.version, currentLink); err != nil {
		return err
	}
	return switchLink(env, currentBin, binLink)
}

// pointCurrent points /opt/xdesign/current at the release of version and
// /usr/local/bin/xdesign at current's xdesign, each switched in one step (section 6.3 step
// 5): the switch of the update and of the rollback, and their going back.
func pointCurrent(_ context.Context, env *Env, version string) error {
	if err := switchLink(env, "releases/"+version, currentLink); err != nil {
		return err
	}
	return switchLink(env, currentBin, binLink)
}

// switchLink points the symbolic link name at target in one step: a new link next to
// it is renamed over it, so name never disappears.
func switchLink(env *Env, target, name string) error {
	if link, err := env.Sys.FS.Readlink(name); err == nil && link == target {
		return nil
	}
	tmp := name + ".new"
	return env.Do(fmt.Sprintf("ln -sfn %s %s && mv -T %s %s", target, tmp, tmp, name), func() error {
		fsys := env.Sys.FS
		if err := fsys.MkdirAll(path.Dir(name), 0o755); err != nil {
			return err
		}
		if err := fsys.RemoveAll(tmp); err != nil {
			return err
		}
		if err := fsys.Symlink(target, tmp); err != nil {
			return err
		}
		return fsys.Rename(tmp, name)
	})
}

// stopForFiles does nothing on Linux: a running program's files can be replaced.
func (r *run) stopForFiles(context.Context, *Env, string) error {
	return nil
}

// currentVersion is the version of the release a current link names: releases/<version>,
// as the installer and the update write it.
func currentVersion(link string) (string, bool) {
	version, found := strings.CutPrefix(path.Clean(link), "releases/")
	if !found || version == "" || strings.Contains(version, "/") {
		return "", false
	}
	return version, true
}
