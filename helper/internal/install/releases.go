package install

import (
	"fmt"
	"path"
	"path/filepath"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// Shared parts of the installer, the updater, the rollback and the uninstaller: the
// release folders under /opt/xdesign/releases, the files the installer writes and the
// state of the service. Copied from xWriter's releases.go and cut to what the installer
// uses; the kept releases, their pruning and the failure logs of the update and the
// rollback are in goback.go.

// releaseDir is the folder of an installed version.
func releaseDir(version string) string {
	return filepath.Join(releasesDir, version)
}

// installedVersion returns the version /opt/xdesign/current points to: the link names
// releases/<version>, as the installer and the update write it (currentVersion; on
// Windows the junction names the release folder). ok is false when the link
// is missing or names something else; programMissing reports a link whose xdesign file is
// gone.
func installedVersion(fsys host.FS) (version string, programMissing, ok bool) {
	link, err := fsys.Readlink(currentLink)
	if err != nil {
		return "", false, false
	}
	version, found := currentVersion(link)
	if !found {
		return "", false, false
	}
	return version, !exists(fsys, currentBin), true
}

// installFile writes data to dst, root:root 0644; what names the file's source for the
// plan of a dry run.
func installFile(env *Env, what, dst string, data []byte) error {
	return env.Do(fmt.Sprintf("install -D -m 0644 -o root -g root %s %s", what, dst), func() error {
		if err := env.Sys.FS.MkdirAll(path.Dir(dst), 0o755); err != nil {
			return err
		}
		return env.Sys.FS.WriteFile(dst, data, 0o644, host.Root())
	})
}
