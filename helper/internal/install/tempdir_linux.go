package install

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"path"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// TempParent holds the private folders in which `xdesign update` unpacks the file it is
// given (docs/plan/07-server-install-update.md section 6.3): /var/tmp, never /tmp, which
// is a small memory file system on many servers.
const TempParent = "/var/tmp"

// MakePrivateDir creates a new folder in [TempParent] named prefix and ten random
// characters, which only the user of this process can open (0700), and checks that it
// is a folder of that user and not something another user put there first. The caller
// removes it with everything in it.
func MakePrivateDir(sys host.System, rnd io.Reader, prefix string) (string, error) {
	return makePrivateDirIn(sys, rnd, TempParent, prefix)
}

// makePrivateDirIn is MakePrivateDir in the folder parent.
func makePrivateDirIn(sys host.System, rnd io.Reader, parent, prefix string) (string, error) {
	suffix, err := randomString(rnd, basePathChars, 10)
	if err != nil {
		return "", err
	}
	dir := path.Join(parent, prefix+suffix)
	switch _, err := sys.FS.Lstat(dir); {
	case err == nil:
		return "", fmt.Errorf("%s exists already; remove it and try again", dir)
	case !errors.Is(err, fs.ErrNotExist):
		return "", fmt.Errorf("check %s: %w", dir, err)
	}
	if err := sys.FS.MkdirAll(dir, 0o700); err != nil {
		return "", fmt.Errorf("create %s: %w", dir, err)
	}
	if err := sys.FS.Chmod(dir, 0o700); err != nil {
		return "", fmt.Errorf("set the mode of %s: %w", dir, err)
	}
	fi, err := sys.FS.Lstat(dir)
	if err != nil {
		return "", fmt.Errorf("check %s: %w", dir, err)
	}
	owner, err := sys.FS.Owner(dir)
	if err != nil {
		return "", fmt.Errorf("check %s: %w", dir, err)
	}
	if !fi.IsDir() || owner.UID != sys.Machine.Euid() {
		return "", fmt.Errorf("%s is not a folder of this user; remove it and try again", dir)
	}
	return dir, nil
}

// execPlace is a place MakeExecDir tries: the folder to make the new one in, the start of
// the new folder's name and the place's short name for messages.
type execPlace struct {
	parent, prefix, name string
}

// problem says what keeps a program from running out of a new folder in the place, or
// returns "" when nothing does: the parent is missing (xDesign is not installed yet), its
// file system is mounted noexec, or fewer than need bytes are free.
func (p execPlace) problem(sys host.System, need uint64) string {
	fi, err := sys.FS.Stat(p.parent)
	switch {
	case errors.Is(err, fs.ErrNotExist), err == nil && !fi.IsDir():
		return "there is no " + p.parent
	case err != nil:
		return fmt.Sprintf("%s cannot be checked (%v)", p.name, err)
	}
	st, err := sys.Machine.Statfs(p.parent)
	switch {
	case err != nil:
		return fmt.Sprintf("%s cannot be checked (%v)", p.name, err)
	case st.NoExec:
		return p.name + " is mounted noexec"
	case st.Free < need:
		return p.name + " has little space"
	}
	return ""
}

// MakeExecDir creates a private folder as MakePrivateDir does, in the first place on this
// server where a program can run from it and need bytes are free: /var/tmp (named prefix and
// ten random characters), then /opt/xdesign/releases (.staging-scratch- and ten random
// characters), which has to allow programs for xDesign to run at all. A hardened server
// mounts /var/tmp noexec, and a program copied there would fail to start.
// A place is skipped when its file system is noexec, has less than need free, is missing,
// or refuses the folder; when none is left the error says what kept xdesign from each. The
// caller removes the folder with everything in it; one under /opt that an interrupted run
// left is removed by removeStagingFolders.
func MakeExecDir(sys host.System, rnd io.Reader, prefix string, need uint64) (string, error) {
	places := []execPlace{
		{TempParent, prefix, "/var/tmp"},
		{releasesDir, scratchPrefix, "/opt"},
	}
	var skipped []string
	for _, p := range places {
		why := p.problem(sys, need)
		if why == "" {
			dir, err := makePrivateDirIn(sys, rnd, p.parent, p.prefix)
			if err == nil {
				return dir, nil
			}
			why = fmt.Sprintf("no folder could be made in %s (%v)", p.parent, err)
		}
		skipped = append(skipped, why)
	}
	return "", fmt.Errorf("no folder on this server allows running programs and has room: %s. "+
		"Free space, or remount /var/tmp without noexec", strings.Join(skipped, " and "))
}
