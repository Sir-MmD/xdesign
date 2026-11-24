package install

import (
	"errors"
	"fmt"
	"io/fs"
	"path/filepath"
	"slices"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/release"
)

// The kept releases of /opt/xdesign/releases, which the update keeps and prunes, the
// rollback goes back to, and Maintenance > Update lists ("Go back", section 6.2), copied
// from xWriter's releases.go and goback.go and cut to the single xdesign file: a release
// folder is named by its version and holds the xdesign file, Node.js and the app; what it
// is comes from its xdesign file's build information.

// KeepReleases is how many release folders an update keeps: the current one and the two
// before it (section 6.3 step 8).
const KeepReleases = keepReleases

// Release is an installed release folder.
type Release struct {
	// Version is the folder's name, which its xdesign file's version must be.
	Version string
	Dir     string
	// Info is what its xdesign file says about itself (internal/release).
	Info release.Binary
}

// readRelease reads the release folder dir.
func readRelease(fsys host.FS, dir string) (Release, error) {
	for _, name := range []string{releaseSelf, releaseNode, releaseServer, releaseCLI} {
		if !exists(fsys, filepath.Join(dir, name)) {
			return Release{}, fmt.Errorf("%s has no %s, so it is not a complete xDesign release", dir, name)
		}
	}
	bin, err := inspectFile(fsys, filepath.Join(dir, releaseSelf))
	if err != nil {
		return Release{}, err
	}
	if v := filepath.Base(dir); bin.Version != v {
		return Release{}, fmt.Errorf("%s holds xDesign %s, not %s", dir, bin.Version, v)
	}
	return Release{Version: bin.Version, Dir: dir, Info: bin}, nil
}

// currentRelease reads the release that /opt/xdesign/current points to.
func currentRelease(fsys host.FS) (Release, error) {
	version, missing, ok := installedVersion(fsys)
	if !ok || missing {
		return Release{}, fmt.Errorf("%s is not a link to an installed release; repair the installation with %s./xdesign --install",
			currentLink, adminPrefix)
	}
	return readRelease(fsys, releaseDir(version))
}

// CurrentRelease reads the release that /opt/xdesign/current points to.
func CurrentRelease(fsys host.FS) (Release, error) {
	return currentRelease(fsys)
}

// KeptReleases lists the release folders of /opt/xdesign/releases, newest version first.
// Folders that are not complete releases are left out and named in skipped.
func KeptReleases(fsys host.FS) (rels []Release, skipped []string, err error) {
	return installedReleases(fsys)
}

// installedReleases lists the release folders, newest version first.
func installedReleases(fsys host.FS) (rels []Release, skipped []string, err error) {
	entries, err := fsys.ReadDir(releasesDir)
	if errors.Is(err, fs.ErrNotExist) {
		return nil, nil, nil
	}
	if err != nil {
		return nil, nil, fmt.Errorf("list %s: %w", releasesDir, err)
	}
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), stagingPrefix) {
			continue
		}
		rel, err := readRelease(fsys, filepath.Join(releasesDir, e.Name()))
		if err != nil {
			skipped = append(skipped, e.Name())
			continue
		}
		rels = append(rels, rel)
	}
	slices.SortFunc(rels, func(a, b Release) int {
		c, err := buildinfo.CompareVersions(b.Version, a.Version)
		if err != nil || c == 0 {
			return strings.Compare(b.Version, a.Version)
		}
		return c
	})
	return rels, skipped, nil
}

// pruneReleases deletes the release folders an update no longer needs (section 6.3 step
// 8): it keeps the current one, the folders named in keep and the newest others until
// three are kept, and removes staging folders that an interrupted run left. A folder a
// running program uses (releaseInUse: on Windows the maintenance service runs from the
// release before, and Windows cannot delete a running program) is kept too. It returns
// the versions it removed.
func pruneReleases(env *Env, current string, keep ...string) ([]string, error) {
	rels, _, err := installedReleases(env.Sys.FS)
	if err != nil {
		return nil, err
	}
	kept := map[string]bool{current: true}
	for _, k := range keep {
		if k != "" {
			kept[k] = true
		}
	}
	var removed []string
	for _, r := range rels {
		if kept[r.Version] {
			continue
		}
		if len(kept) < keepReleases {
			kept[r.Version] = true
			continue
		}
		dir := r.Dir
		if releaseInUse(dir) {
			env.Notef("%s is kept: a running program uses it", dir)
			continue
		}
		if err := env.Do("rm -rf "+dir, func() error { return env.Sys.FS.RemoveAll(dir) }); err != nil {
			return removed, err
		}
		removed = append(removed, r.Version)
	}
	return removed, removeStagingFolders(env)
}

// removeStagingFolders deletes the staging folders that interrupted runs left in
// /opt/xdesign/releases: the folders of releases being written (.staging-) and the
// scratch folders of update files (.staging-scratch-, see MakeExecDir).
func removeStagingFolders(env *Env) error {
	entries, err := env.Sys.FS.ReadDir(releasesDir)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("list %s: %w", releasesDir, err)
	}
	for _, e := range entries {
		if !strings.HasPrefix(e.Name(), stagingPrefix) || strings.HasPrefix(e.Name(), scratchPrefix) {
			continue // the scratch folder of a running update holds its program
		}
		p := filepath.Join(releasesDir, e.Name())
		if err := env.Do("rm -rf "+p, func() error { return env.Sys.FS.RemoveAll(p) }); err != nil {
			return err
		}
	}
	return nil
}
