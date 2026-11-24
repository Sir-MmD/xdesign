package install

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"path/filepath"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// The private folders on Windows (docs/plan/18-third-owner-list-2026-11-23.md section 8.6):
// C:\ProgramData\xDesign\maintenance\run holds the copy of the new file that an update's
// second stage runs, and the maintenance service's copies of an upload or a backup. Only
// SYSTEM and Administrators may open it (its own protected permissions). The maintenance
// folder around it is NT SERVICE\xdesign's to change, so it must have the installer's
// permissions, and it is held open (platform.OpenHeld) until this process ends, so it
// cannot be moved away and another folder put in its place while the copy waits to run.

// runLeftoverAge is how old a folder in run must be to count as left by a run that was
// stopped halfway; such folders are removed.
const runLeftoverAge = 24 * time.Hour

// runDirSecurity is the security descriptor of the run folder: owned by Administrators,
// taking nothing from the maintenance folder, SYSTEM and Administrators with full control
// of it and of everything in it.
func runDirSecurity() string {
	return "O:BAD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)"
}

// CheckServiceFolder checks that the folder dir, one NT SERVICE\xdesign may change (the
// maintenance folder), has the permissions the installer gives it: then that account may
// change what is in it but not its permissions, nor take it.
func CheckServiceFolder(dir string) error {
	ok, err := platform.SecurityMatches(dir, serviceDirSecurity())
	switch {
	case err != nil:
		return fmt.Errorf("check %s: %w", dir, err)
	case !ok:
		return fmt.Errorf("%s does not have the permissions the installer gives it; repair them with xdesign --install", dir)
	}
	return nil
}

// MakePrivateDir creates a new folder in the run folder named prefix and ten random
// characters, which only SYSTEM and Administrators can open. The caller removes it with
// everything in it.
func MakePrivateDir(sys host.System, rnd io.Reader, prefix string) (string, error) {
	if err := prepareRunDir(sys); err != nil {
		return "", err
	}
	suffix, err := randomString(rnd, basePathChars, 10)
	if err != nil {
		return "", err
	}
	dir := filepath.Join(platform.MaintenanceRunDir, prefix+suffix)
	switch _, err := sys.FS.Lstat(dir); {
	case err == nil:
		return "", fmt.Errorf("%s exists already; remove it and try again", dir)
	case !errors.Is(err, fs.ErrNotExist):
		return "", fmt.Errorf("check %s: %w", dir, err)
	}
	if err := sys.FS.MkdirAll(dir, 0o700); err != nil {
		return "", fmt.Errorf("create %s: %w", dir, err)
	}
	return dir, nil
}

// MakeExecDir creates a private folder as MakePrivateDir does, for the copy of the new
// file that the second stage of an update runs; need bytes must be free on its drive.
func MakeExecDir(sys host.System, rnd io.Reader, prefix string, need uint64) (string, error) {
	st, err := statfsNearest(sys.Machine, platform.MaintenanceDir)
	if err != nil {
		return "", fmt.Errorf("check the free space of %s: %w", platform.MaintenanceDir, err)
	}
	if st.Free < need {
		return "", fmt.Errorf("there is not enough free space for the copy of the update file in %s: %s free, %s needed. Free some "+
			"space, then run the update again", platform.MaintenanceDir, formatSize(st.Free), formatSize(need))
	}
	return MakePrivateDir(sys, rnd, prefix)
}

// prepareRunDir holds the maintenance folder open (a folder, not a link) and checks its
// permissions, then makes the run folder with its own: a link in its place is removed (the
// link only), and so is a folder with other permissions, which someone else made. Folders
// that runs stopped halfway left in it are removed.
func prepareRunDir(sys host.System) error {
	// The folder stays held until this process ends: the copy in it runs after this returns.
	if err := platform.HoldFolder(platform.MaintenanceDir); err != nil {
		return fmt.Errorf("open the maintenance folder: %w", err)
	}
	if err := CheckServiceFolder(platform.MaintenanceDir); err != nil {
		return err
	}
	run := platform.MaintenanceRunDir
	fi, err := sys.FS.Lstat(run)
	switch {
	case errors.Is(err, fs.ErrNotExist):
	case err != nil:
		return fmt.Errorf("check %s: %w", run, err)
	case fi.Mode()&(fs.ModeSymlink|fs.ModeIrregular) != 0 || !fi.IsDir():
		if err := sys.FS.Remove(run); err != nil {
			return fmt.Errorf("remove %s, which is not a folder: %w", run, err)
		}
	default:
		ok, err := platform.SecurityMatches(run, runDirSecurity())
		if err != nil {
			return fmt.Errorf("check %s: %w", run, err)
		}
		if ok {
			removeRunLeftovers(sys)
			return nil
		}
		if err := sys.FS.RemoveAll(run); err != nil {
			return fmt.Errorf("remove %s, which has other permissions than xDesign gives it: %w", run, err)
		}
	}
	if err := platform.MakeFolder(run, runDirSecurity()); err != nil {
		return fmt.Errorf("create the folder of the update's copy: %w", err)
	}
	return nil
}

// removeRunLeftovers removes the folders of the run folder older than runLeftoverAge, best
// effort: what a run that was stopped halfway left.
func removeRunLeftovers(sys host.System) {
	entries, err := sys.FS.ReadDir(platform.MaintenanceRunDir)
	if err != nil {
		return
	}
	for _, e := range entries {
		if fi, err := e.Info(); err == nil && time.Since(fi.ModTime()) > runLeftoverAge {
			_ = sys.FS.RemoveAll(filepath.Join(platform.MaintenanceRunDir, e.Name())) // best effort: the next run tries again
		}
	}
}
