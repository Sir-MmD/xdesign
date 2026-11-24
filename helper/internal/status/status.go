// Package status measures what `xdesign status` and Maintenance show besides the front and
// the app (docs/plan/07-server-install-update.md sections 7 and 8): the sizes of the
// database and the media, the free disk of the data folder and the last backups. The
// control socket's GET /status answers them from serve, and `xdesign status` measures
// them itself while serve does not run.
package status

import (
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
	"github.com/Sir-MmD/xdesign/helper/internal/ssl"
)

// lastBackups is how many of the newest backups Backups lists.
const lastBackups = 3

// Storage is the disk use of the site's data folder.
type Storage struct {
	DataDir string `json:"data_dir"`
	// DatabaseBytes counts xdesign.db with its -wal and -shm files; MediaBytes and
	// MediaFiles the media folder.
	DatabaseBytes int64 `json:"database_bytes"`
	MediaBytes    int64 `json:"media_bytes"`
	MediaFiles    int   `json:"media_files"`
	// FreeBytes is the free space of the file system that holds the data folder, for
	// this process.
	FreeBytes int64 `json:"free_bytes"`
	// Problem says what could not be measured; empty when everything was.
	Problem string `json:"problem,omitempty"`
}

// StorageOf measures the data folder dataDir.
func StorageOf(dataDir string) Storage {
	s := Storage{DataDir: dataDir}
	var problems []error
	db := filepath.Join(dataDir, backup.DatabaseName)
	for _, p := range []string{db, db + "-wal", db + "-shm"} {
		fi, err := os.Stat(p)
		switch {
		case err == nil:
			s.DatabaseBytes += fi.Size()
		case !errors.Is(err, fs.ErrNotExist):
			problems = append(problems, err)
		}
	}
	err := filepath.WalkDir(filepath.Join(dataDir, backup.MediaDir), func(_ string, d fs.DirEntry, err error) error {
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				return nil
			}
			return err
		}
		if d.Type().IsRegular() {
			if fi, err := d.Info(); err == nil {
				s.MediaBytes += fi.Size()
				s.MediaFiles++
			}
		}
		return nil
	})
	if err != nil {
		problems = append(problems, err)
	}
	if space, err := platform.DiskSpace(dataDir); err != nil {
		problems = append(problems, err) // an *fs.PathError "statfs <dataDir>: ..." (GetDiskFreeSpaceEx on Windows)
	} else {
		s.FreeBytes = int64(space.Free) //nolint:gosec // G115: the free bytes of a file system fit in an int64
	}
	if err := errors.Join(problems...); err != nil {
		s.Problem = err.Error()
	}
	return s
}

// Backups is the backups' folder in short: how many, the space used and the newest.
type Backups struct {
	Count     int   `json:"count"`
	SpaceUsed int64 `json:"space_used"`
	// Last are the newest backups, newest first.
	Last []backup.Entry `json:"last"`
	// Running reports that a backup or a restore runs now.
	Running bool `json:"running"`
	// Problem says why the folder could not be listed.
	Problem string `json:"problem,omitempty"`
}

// BackupsOf lists the backups' folder dir.
func BackupsOf(dir string) Backups {
	l, err := backup.List(dir)
	if err != nil {
		return Backups{Last: []backup.Entry{}, Problem: err.Error()}
	}
	b := Backups{Count: len(l.Backups), SpaceUsed: l.SpaceUsed, Last: l.Backups[:min(len(l.Backups), lastBackups)]}
	b.Running = backup.Running(dir)
	return b
}

// HTTPS is the site's HTTPS in short: the method and its certificate.
type HTTPS struct {
	// Method, State and Names are the HTTPS manager's (ssl.View); ExpiresAt is when the
	// certificate served now expires.
	Method      string    `json:"method,omitempty"`
	State       string    `json:"state,omitempty"`
	Names       []string  `json:"names,omitempty"`
	ExpiresAt   time.Time `json:"expires_at,omitzero"`
	LastProblem string    `json:"last_problem,omitempty"`
}

// HTTPSOf is the HTTPS of the manager's view v.
func HTTPSOf(v ssl.View) HTTPS {
	return HTTPS{Method: string(v.Method), State: string(v.State), Names: v.Names, ExpiresAt: v.ExpiresAt, LastProblem: v.LastProblem}
}
