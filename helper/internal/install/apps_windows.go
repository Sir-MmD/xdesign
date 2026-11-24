package install

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"math"
	"path/filepath"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// Windows' list of installed apps (docs/plan/19-uninstall-2026-11-24.md section 3): the key
// HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\xDesign, which Settings > Apps >
// Installed apps and Control Panel > Programs and Features show, with `xdesign.exe
// --uninstall` behind their Uninstall button. The installer writes it after the services
// start, and a repair writes it again where it differs; an update and a rollback set its
// version and size again; the uninstall removes it. install.json records the entry the
// installer wrote ("apps_entry").

// appsName and appsPublisher are the entry's name and publisher.
const (
	appsName      = "xDesign"
	appsPublisher = "xDesign"
)

// appsDateLayout is the layout of InstallDate: yyyymmdd.
const appsDateLayout = "20060102"

// appsValues are the values of the entry for version, installed on date (yyyymmdd), with
// the program folder's size in KB.
func appsValues(version, date string, sizeKB uint32) []platform.AppValue {
	exe := `"` + currentBin + `"`
	return []platform.AppValue{
		{Name: "DisplayName", Text: appsName},
		{Name: "DisplayVersion", Text: version},
		{Name: "Publisher", Text: appsPublisher},
		{Name: "DisplayIcon", Text: exe + ",0"},
		{Name: "InstallLocation", Text: optDir},
		{Name: "InstallDate", Text: date},
		{Name: "EstimatedSize", Number: sizeKB, IsNumber: true},
		{Name: "NoModify", Number: 1, IsNumber: true},
		{Name: "NoRepair", Number: 1, IsNumber: true},
		{Name: "UninstallString", Text: exe + " --uninstall"},
	}
}

// programSizeKB is the size of the files in C:\Program Files\xDesign in KB, rounded up:
// the releases, without following the current junction.
func programSizeKB(fsys host.FS) (uint32, error) {
	var total uint64
	var walk func(dir string) error
	walk = func(dir string) error {
		entries, err := fsys.ReadDir(dir)
		if errors.Is(err, fs.ErrNotExist) {
			return nil
		}
		if err != nil {
			return fmt.Errorf("list %s: %w", dir, err)
		}
		for _, e := range entries {
			p := filepath.Join(dir, e.Name())
			if e.IsDir() { // a junction is not a folder here (fs.ModeIrregular)
				if err := walk(p); err != nil {
					return err
				}
				continue
			}
			if fi, err := e.Info(); err == nil && fi.Mode().IsRegular() {
				total += uint64(fi.Size()) //nolint:gosec // G115: a file size
			}
		}
		return nil
	}
	if err := walk(optDir); err != nil {
		return 0, err
	}
	return uint32(min((total+1023)/1024, math.MaxUint32)), nil
}

// appsEntryDiff says what of the entry differs from the values for version and the
// program folder's size, "" when nothing does; the installation date only has to be
// there.
func appsEntryDiff(version string, sizeKB uint32) (string, error) {
	texts, numbers, found, err := platform.ReadAppsEntry()
	switch {
	case err != nil:
		return "", err
	case !found:
		return "not listed", nil
	}
	for _, v := range appsValues(version, texts["InstallDate"], sizeKB) {
		switch {
		case v.IsNumber && numbers[v.Name] != uint64(v.Number):
			return v.Name + " differs", nil
		case !v.IsNumber && (texts[v.Name] != v.Text || v.Text == ""):
			return v.Name + " differs", nil
		}
	}
	return "", nil
}

// writeAppsEntry writes the whole entry for version; an installation date it has stays,
// otherwise it is today's.
func writeAppsEntry(fsys host.FS, version string, now time.Time) error {
	size, err := programSizeKB(fsys)
	if err != nil {
		return err
	}
	date := now.Local().Format(appsDateLayout)
	texts, _, _, err := platform.ReadAppsEntry()
	if err != nil {
		return err
	}
	if d := texts["InstallDate"]; d != "" {
		date = d
	}
	return platform.WriteAppsEntry(appsValues(version, date, size))
}

// appsWords describes the entry for the log and the dry run's plan.
func appsWords(version string) string {
	return "write " + platform.AppsEntry + " (DisplayName " + appsName + ", DisplayVersion " + version + `, UninstallString "` +
		currentBin + `" --uninstall)`
}

// stepApps lists xDesign in Windows' list of installed apps once its services run; a
// repair writes the entry again where it differs. install.json records it.
func (r *run) stepApps() Step {
	return Step{
		ID: "apps", Title: "Installed apps",
		Check: func(context.Context, *Env) (string, error) {
			if r.state.AppsEntry == "" {
				return "", nil
			}
			size, err := programSizeKB(r.sys.FS)
			if err != nil {
				return "", err
			}
			diff, err := appsEntryDiff(r.version, size)
			if err != nil || diff != "" {
				return "", err
			}
			return "xDesign " + r.version + " is listed", nil
		},
		Act: func(_ context.Context, env *Env) error {
			if err := env.Do(appsWords(r.version), func() error { return writeAppsEntry(r.sys.FS, r.version, r.now()) }); err != nil {
				return err
			}
			r.state.AppsEntry = platform.AppsEntry
			return r.saveState(env)
		},
		Verify: func(context.Context, *Env) error {
			if r.opts.DryRun {
				return nil
			}
			size, err := programSizeKB(r.sys.FS)
			if err != nil {
				return err
			}
			diff, err := appsEntryDiff(r.version, size)
			if err == nil && diff != "" {
				err = fmt.Errorf("%s: %s after it was written", platform.AppsEntry, diff)
			}
			return err
		},
	}
}

// refreshAppsEntry sets the version and the size of the entry again at the end of an
// update or a rollback to version, once the old releases are removed, and writes the whole
// entry when it is missing (an installation from before it existed; the next repair
// records it in install.json). A failure is a warning: the new release runs.
func refreshAppsEntry(env *Env, fsys host.FS, version string) {
	err := env.Do(appsWords(version), func() error {
		_, _, found, err := platform.ReadAppsEntry()
		if err != nil {
			return err
		}
		if !found {
			return writeAppsEntry(fsys, version, time.Now())
		}
		size, err := programSizeKB(fsys)
		if err != nil {
			return err
		}
		return platform.WriteAppsEntry([]platform.AppValue{
			{Name: "DisplayVersion", Text: version},
			{Name: "EstimatedSize", Number: size, IsNumber: true},
		})
	})
	if err != nil {
		env.Warnf("Windows' list of installed apps may still show the version before: %v", err)
	}
}

// stepApps of the uninstall removes the entry from Windows' list of installed apps, after
// the program: until then its Uninstall button runs the uninstall again.
func (r *uninstallRun) stepApps() Step {
	return Step{ID: "apps", Title: "Installed apps",
		Check: func(context.Context, *Env) (string, error) {
			_, _, found, err := platform.ReadAppsEntry()
			if err != nil || found {
				return "", err
			}
			return "xDesign is not listed", nil
		},
		Act: func(_ context.Context, env *Env) error {
			if err := env.Do("delete "+platform.AppsEntry, platform.DeleteAppsEntry); err != nil {
				return err
			}
			r.state.AppsEntry = ""
			return r.saveState(env)
		},
		Verify: func(context.Context, *Env) error { return nil },
	}
}
