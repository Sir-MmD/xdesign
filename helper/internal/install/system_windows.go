package install

import (
	"context"
	"errors"
	"fmt"
	"io/fs"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// serviceName is the Windows service of the site; it runs as the virtual account NT
// SERVICE\xdesign (docs/plan/18-third-owner-list-2026-11-23.md section 8.2).
const serviceName = "xdesign"

// runsAs names the account the site runs as, for the summary.
const runsAs = `the service account NT SERVICE\` + serviceName

// The rights of the folders' entries: FA full control, FR read, and modify (read, write,
// run and delete, without changing the permissions or deleting what is inside a folder).
const modify = "0x1301bf"

// configDirSecurity is the security descriptor of C:\ProgramData\xDesign (section 8.2):
// owned by Administrators, taking nothing from C:\ProgramData (whose users may create
// folders), SYSTEM and Administrators with full control of everything in it; the
// service's account NT SERVICE\xdesign (its SID, which Windows computes from the name, as
// the service does not exist yet) changes the folder itself, where serve writes and
// removes control.json, reads the files in it (config.toml and install.json) and changes
// what it makes there (CREATOR OWNER), never what the installer wrote.
func configDirSecurity() string {
	sid := platform.ServiceSID(serviceName)
	return "O:BAD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;;" + modify + ";;;" + sid + ")(A;OIIO;FR;;;" + sid + ")(A;OICIIO;" +
		modify + ";;;CO)"
}

// serviceDirSecurity is the security descriptor of the folders the service changes (the
// data, the backups, the maintenance requests, the update failures and the logs): what
// C:\ProgramData\xDesign passes on, and modify for NT SERVICE\xdesign on the folder and
// everything in it (WIN-03's rights of the service).
func serviceDirSecurity() string {
	return "O:BAD:(A;OICI;" + modify + ";;;" + platform.ServiceSID(serviceName) + ")"
}

// folder is a folder of section 8.2 with its security descriptor and the words for it;
// an empty security keeps what its parent gives (the program files take those of
// C:\Program Files: Administrators change them, every user reads and runs them).
type folder struct {
	path, security, words string
}

// folders are the folders of section 8.2, parents first.
func folders() []folder {
	service := folder{security: serviceDirSecurity(), words: `NT SERVICE\` + serviceName + " may change everything in it"}
	out := []folder{
		{path: optDir},
		{path: releasesDir},
		{path: etcDir, security: configDirSecurity(), words: `only SYSTEM and Administrators change it; NT SERVICE\` + serviceName +
			" reads its files and keeps control.json there"},
	}
	for _, p := range []string{dataDir, platform.BackupsDir, platform.MaintenanceDir, platform.UpdateFailuresDir, platform.LogDir} {
		f := service
		f.path = p
		out = append(out, f)
	}
	return out
}

// wrongFolders returns the folders that are missing or have other permissions. A link or
// a junction in a folder's place is an error: the installer writes through these folders
// as Administrator.
func (r *run) wrongFolders() ([]folder, error) {
	var wrong []folder
	for _, f := range folders() {
		fi, err := r.sys.FS.Lstat(f.path)
		if errors.Is(err, fs.ErrNotExist) {
			wrong = append(wrong, f)
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("check %s: %w", f.path, err)
		}
		if fi.Mode()&(fs.ModeSymlink|fs.ModeIrregular) != 0 {
			return nil, fmt.Errorf("%s is a link or a junction, not a folder; move it away and run the installer again", f.path)
		}
		if !fi.IsDir() {
			return nil, fmt.Errorf("%s exists but is not a folder; move it away and run the installer again", f.path)
		}
		if f.security == "" {
			continue
		}
		ok, err := platform.SecurityMatches(f.path, f.security)
		if err != nil {
			return nil, fmt.Errorf("check %s: %w", f.path, err)
		}
		if !ok {
			wrong = append(wrong, f)
		}
	}
	return wrong, nil
}

// stepDirectories is the folders of section 8.2 with their permissions. A folder is made
// with its permissions in one call; one that exists gets them, and Windows passes them on
// to what is inside.
func (r *run) stepDirectories() Step {
	return Step{
		ID: "directories", Title: "Folders",
		Check: func(context.Context, *Env) (string, error) {
			wrong, err := r.wrongFolders()
			if err != nil || len(wrong) > 0 {
				return "", err
			}
			return "every folder has the right permissions", nil
		},
		Act: func(_ context.Context, env *Env) error {
			wrong, err := r.wrongFolders()
			if err != nil {
				return err
			}
			for _, f := range wrong {
				if err := r.fixFolder(env, f); err != nil {
					return err
				}
			}
			return nil
		},
	}
}

// fixFolder makes the folder f, or gives it its permissions. C:\ProgramData\xDesign is
// made with them in one call (makeConfigDir); the folders inside it are made first, so
// they take what it passes on, then get their own entry.
func (r *run) fixFolder(env *Env, f folder) error {
	missing := !lexists(r.sys.FS, f.path)
	switch {
	case f.security == "":
		return env.Do("mkdir "+f.path, func() error { return r.sys.FS.MkdirAll(f.path, 0o755) })
	case missing && f.path == etcDir:
		return env.Do(fmt.Sprintf("mkdir %s: %s (%s)", f.path, f.words, f.security), func() error {
			return makeConfigDir(r.sys.FS)
		})
	}
	what := "set the permissions of " + f.path
	if missing {
		what = "mkdir " + f.path + " and set its permissions"
	}
	return env.Do(fmt.Sprintf("%s: %s (%s)", what, f.words, f.security), func() error {
		if err := r.sys.FS.MkdirAll(f.path, 0o755); err != nil {
			return err
		}
		return platform.SetSecurity(f.path, f.security)
	})
}

// makeConfigDir makes C:\ProgramData\xDesign with its permissions (configDirSecurity) when
// install.json or the install log is the first thing written there, so the folder never
// exists with the permissions of C:\ProgramData.
func makeConfigDir(host.FS) error {
	err := platform.MakeFolder(etcDir, configDirSecurity())
	if errors.Is(err, fs.ErrExist) {
		return nil
	}
	return err
}
