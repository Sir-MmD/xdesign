package backup

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

// Retention (section 5.1 and 5.2, D-32).
const (
	// KeepDaily is how many daily and manual backups are kept together, the newest.
	KeepDaily = 14
	// KeepPreUpdate is how many pre-update backups are kept, the newest.
	KeepPreUpdate = 3
	// partialAge is how old a partial file must be before the retention takes it as left
	// over by a backup that was stopped.
	partialAge = 24 * time.Hour
)

// ErrNotFound is returned for a name that is not a backup of the folder.
var ErrNotFound = errors.New("there is no such backup")

// Entry is one backup of the folder as the list shows it.
type Entry struct {
	// Name is the backup's name, File its archive's name in the folder.
	Name      string    `json:"name"`
	File      string    `json:"file"`
	Kind      Kind      `json:"kind"`
	Version   string    `json:"version"`
	CreatedAt time.Time `json:"created_at"`
	// Size is the archive's bytes; Parts the bytes and files of each part inside.
	Size  int64  `json:"size"`
	Parts []Part `json:"parts"`
}

func entryOf(m Meta, file string) Entry {
	e := Entry{Name: strings.TrimSuffix(file, Ext), File: file, Kind: m.Kind, Version: m.Version, CreatedAt: m.CreatedAt, Parts: m.Parts}
	if m.Archive != nil {
		e.Size = m.Archive.Size
	}
	return e
}

// Listing is the backups' folder.
type Listing struct {
	// Backups are the complete backups, newest first.
	Backups []Entry `json:"backups"`
	// SpaceUsed is the bytes of every file in the folder, partial ones included.
	SpaceUsed int64 `json:"space_used"`
}

// List lists the backups of dir from their metadata files: a backup is listed when its
// metadata file is valid and its archive has the size the metadata gives. A missing
// folder has no backups.
func List(dir string) (Listing, error) {
	l := Listing{Backups: []Entry{}}
	entries, err := os.ReadDir(dir)
	if errors.Is(err, fs.ErrNotExist) {
		return l, nil
	}
	if err != nil {
		return l, fmt.Errorf("list the backups: %w", err)
	}
	for _, d := range entries {
		if !d.Type().IsRegular() {
			continue
		}
		if fi, err := d.Info(); err == nil {
			l.SpaceUsed += fi.Size()
		}
		name, ok := strings.CutSuffix(d.Name(), MetaExt)
		if !ok || !ValidName(name) {
			continue
		}
		if e, err := find(dir, name); err == nil {
			l.Backups = append(l.Backups, e)
		}
	}
	slices.SortFunc(l.Backups, func(a, b Entry) int {
		if c := b.CreatedAt.Compare(a.CreatedAt); c != 0 {
			return c
		}
		return strings.Compare(b.Name, a.Name)
	})
	return l, nil
}

// find reads the metadata file of the backup name and checks its archive's size.
func find(dir, name string) (Entry, error) {
	if !ValidName(name) {
		return Entry{}, ErrNotFound
	}
	f, err := os.Open(filepath.Join(dir, name+MetaExt)) //nolint:gosec // G304: a checked name in the backups' folder
	if errors.Is(err, fs.ErrNotExist) {
		return Entry{}, ErrNotFound
	}
	if err != nil {
		return Entry{}, fmt.Errorf("read the backup %s: %w", name, err)
	}
	defer func() { _ = f.Close() }() // read only
	data, err := io.ReadAll(io.LimitReader(f, MaxMetaSize+1))
	if err != nil {
		return Entry{}, fmt.Errorf("read the backup %s: %w", name, err)
	}
	if len(data) > MaxMetaSize {
		return Entry{}, fmt.Errorf("the metadata of %s is too large", name)
	}
	m, err := ParseMeta(data)
	if err != nil {
		return Entry{}, fmt.Errorf("the metadata of %s: %w", name, err)
	}
	if m.Archive == nil {
		return Entry{}, fmt.Errorf("the metadata of %s does not give its archive", name)
	}
	fi, err := os.Lstat(filepath.Join(dir, name+Ext))
	if err != nil || !fi.Mode().IsRegular() || fi.Size() != m.Archive.Size {
		return Entry{}, fmt.Errorf("the archive of %s is missing or incomplete", name)
	}
	return entryOf(m, name+Ext), nil
}

// Find returns the listed backup name and its archive's path.
func Find(dir, name string) (Entry, string, error) {
	e, err := find(dir, name)
	if err != nil {
		return Entry{}, "", err
	}
	return e, filepath.Join(dir, e.File), nil
}

// Delete deletes the backup name of dir: its metadata file first, so a backup deleted
// halfway is never listed, then its archive.
func Delete(dir, name string) error {
	if !ValidName(name) {
		return ErrNotFound
	}
	found := false
	for _, f := range []string{name + MetaExt, name + Ext} {
		err := os.Remove(filepath.Join(dir, f))
		switch {
		case err == nil:
			found = true
		case !errors.Is(err, fs.ErrNotExist):
			return fmt.Errorf("delete the backup %s: %w", name, err)
		}
	}
	if !found {
		return ErrNotFound
	}
	return nil
}

// expired returns the names of the backups the retention deletes: all but the newest
// KeepDaily daily and manual ones and the newest KeepPreUpdate pre-update ones. The
// newest backup is always kept.
func expired(backups []Entry) []string {
	var out []string
	daily, pre := 0, 0
	for i, e := range backups { // newest first
		keep := i == 0
		switch e.Kind {
		case KindDaily, KindManual:
			daily++
			keep = keep || daily <= KeepDaily
		case KindPreUpdate:
			pre++
			keep = keep || pre <= KeepPreUpdate
		}
		if !keep {
			out = append(out, e.Name)
		}
	}
	return out
}

// prune deletes the backups the retention expires and the partial files of backups that
// stopped more than a day ago, and returns the deleted backups' names.
func prune(dir string, now time.Time) ([]string, error) {
	l, err := List(dir)
	if err != nil {
		return nil, err
	}
	deleted := []string{}
	var errs []error
	for _, name := range expired(l.Backups) {
		if err := Delete(dir, name); err != nil {
			errs = append(errs, err)
			continue
		}
		deleted = append(deleted, name)
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return deleted, errors.Join(append(errs, fmt.Errorf("list the backups: %w", err))...)
	}
	for _, d := range entries {
		if !strings.HasPrefix(d.Name(), ".") || !strings.HasSuffix(d.Name(), partialExt) || !d.Type().IsRegular() {
			continue
		}
		if fi, err := d.Info(); err == nil && now.Sub(fi.ModTime()) > partialAge {
			_ = os.Remove(filepath.Join(dir, d.Name())) // best effort: the next backup tries again
		}
	}
	return deleted, errors.Join(errs...)
}
