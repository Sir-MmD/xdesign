package backup

import (
	"encoding/json"
	"errors"
	"fmt"
	"path"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
)

// Kind is why a backup was made (section 5).
type Kind string

// The kinds of backups.
const (
	// KindDaily is made by xdesign-backup.timer at 03:30.
	KindDaily Kind = "daily"
	// KindManual is made by `xdesign backup` or "Make a backup now".
	KindManual Kind = "manual"
	// KindPreUpdate is made before an update and before a restore.
	KindPreUpdate Kind = "pre-update"
)

// Valid reports whether k is one of the kinds.
func (k Kind) Valid() bool {
	switch k {
	case KindDaily, KindManual, KindPreUpdate:
		return true
	}
	return false
}

// File names of a backup and of its members.
const (
	// Ext ends the archive's name, MetaExt the metadata file's.
	Ext     = ".tar.zst"
	MetaExt = ".json"
	// partialExt ends a file that is still being written.
	partialExt = ".partial"
	// MetaName is the first member of the archive.
	MetaName = "backup.json"
	// DatabaseName, ConfigName, MediaDir and CertsDir are the parts' members: the
	// database's copy and the settings file, and the folders whose files follow as
	// media/<path> and certs/<path>.
	DatabaseName = "xdesign.db"
	ConfigName   = "config.toml"
	MediaDir     = "media"
	CertsDir     = "certs"
	// Format is the version of this layout, the newest Read accepts.
	Format = 1
)

// The names of the parts, in the order of the archive.
const (
	PartDatabase = "database"
	PartConfig   = "config"
	PartMedia    = "media"
	PartCerts    = "certs"
)

// Size limits that Read checks before it writes anything, and Make before it starts.
const (
	// MaxMetaSize bounds backup.json and the metadata file: about 200 bytes a file.
	MaxMetaSize = 64 << 20
	// MaxDatabaseSize bounds xdesign.db, MaxConfigSize config.toml and the files of
	// certs/, MaxMediaFileSize one media file.
	MaxDatabaseSize  = 64 << 30
	MaxConfigSize    = 1 << 20
	MaxCertsFileSize = 1 << 20
	MaxMediaFileSize = 8 << 30
	// MaxBackupSize bounds every member together; MaxFiles the number of members.
	MaxBackupSize = 512 << 30
	MaxFiles      = 200_000
	// maxPath bounds a member's name.
	maxPath = 1024
)

// stemTime is the UTC time in a backup's name.
const stemTime = "20060102T150405Z"

// Meta is backup.json, the first member of the archive, and the metadata file next to it.
type Meta struct {
	// Format is the layout's version (Format).
	Format int `json:"format"`
	// Name is the backup's name when it was made, without .tar.zst.
	Name string `json:"name"`
	// Version is the xDesign that made it.
	Version   string    `json:"version"`
	CreatedAt time.Time `json:"created_at"`
	Kind      Kind      `json:"kind"`
	// System is the system that made the backup: "windows" on Windows, nothing on Linux (as
	// every backup made before the Windows server). A restore keeps this server's settings
	// file for a backup of the other system ([Meta.RestoresConfig]).
	System string `json:"system,omitempty"`
	// Parts are the four parts with their sizes, in the order of the archive.
	Parts []Part `json:"parts"`
	// Files are the members after backup.json, in their order.
	Files []File `json:"files"`
	// Archive is the archive's size and SHA-256: only in the metadata file, which is
	// written after the archive.
	Archive *Sum `json:"archive,omitempty"`
}

// Part is one part of a backup: the database, the settings, the media or the
// certificates, with the bytes and the number of its files.
type Part struct {
	Name  string `json:"name"`
	Size  int64  `json:"size"`
	Files int    `json:"files"`
}

// File is one member of the archive after backup.json.
type File struct {
	Path string `json:"path"`
	Size int64  `json:"size"`
	// SHA256 is the hex SHA-256 of its content.
	SHA256 string `json:"sha256"`
}

// Sum is the size and hex SHA-256 of a file.
type Sum struct {
	Size   int64  `json:"size"`
	SHA256 string `json:"sha256"`
}

// Size returns the bytes of every member after backup.json.
func (m Meta) Size() int64 {
	var n int64
	for _, p := range m.Parts {
		n += p.Size
	}
	return n
}

// Part returns the part name (zero when it is not listed).
func (m Meta) Part(name string) Part {
	for _, p := range m.Parts {
		if p.Name == name {
			return p
		}
	}
	return Part{Name: name}
}

// Has reports whether the backup holds the part name: the database and the settings when
// their file is there, the folders always (an empty folder is restored empty).
func (m Meta) Has(name string) bool {
	switch name {
	case PartMedia, PartCerts:
		return true
	}
	return m.Part(name).Files > 0
}

// Describe is a one-line description: "xdesign-20261123T033000Z (daily, xDesign 1.0.0,
// 12.3 MB, made 2026-11-23 03:30 UTC)".
func (m Meta) Describe() string {
	return fmt.Sprintf("%s (%s, xDesign %s, %s, made %s UTC)", m.Name, m.Kind, m.Version, FormatBytes(m.Size()),
		m.CreatedAt.UTC().Format("2006-01-02 15:04"))
}

// nameRE matches a backup's name: no folder, no hidden file.
var nameRE = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9.+_-]{0,200}$`)

// hexSHA256RE matches a hex SHA-256.
var hexSHA256RE = regexp.MustCompile(`^[0-9a-f]{64}$`)

// ValidName reports whether name can be a backup's name.
func ValidName(name string) bool {
	return nameRE.MatchString(name) && !strings.Contains(name, "..")
}

// stem returns the name of a backup of kind made at t by version: pre-update-<version>-<time>
// or xdesign-<time>.
func stem(kind Kind, version string, t time.Time) string {
	at := t.UTC().Format(stemTime)
	if kind == KindPreUpdate {
		v := strings.Map(func(r rune) rune {
			if r == '+' || r == '/' {
				return '_'
			}
			return r
		}, version)
		return "pre-update-" + v + "-" + at
	}
	return "xdesign-" + at
}

// partOf returns the part a member's name belongs to and the most bytes it may hold, or
// "" for a name that is not a member: xdesign.db and config.toml exactly, or a clean
// relative path below media/ or certs/ (no "..", "." or empty element, no absolute path).
func partOf(name string) (string, int64) {
	switch name {
	case DatabaseName:
		return PartDatabase, MaxDatabaseSize
	case ConfigName:
		return PartConfig, MaxConfigSize
	}
	if len(name) > maxPath || !utf8.ValidString(name) || strings.ContainsAny(name, "\x00\\") || path.Clean(name) != name {
		return "", 0
	}
	top, rest, ok := strings.Cut(name, "/")
	if !ok || rest == "" {
		return "", 0
	}
	for _, el := range strings.Split(rest, "/") {
		if el == "" || el == "." || el == ".." {
			return "", 0
		}
	}
	switch top {
	case MediaDir:
		if strings.HasPrefix(rest, "tmp/") {
			return "", 0
		}
		return PartMedia, MaxMediaFileSize
	case CertsDir:
		return PartCerts, MaxCertsFileSize
	}
	return "", 0
}

// Validate checks the metadata: the format, the version, the kind, the parts, and every
// file's name, size and SHA-256 against the limits.
func (m Meta) Validate() error {
	switch {
	case m.Format > Format:
		return fmt.Errorf("it was made in a newer format (%d): update xDesign first", m.Format)
	case m.Format != Format:
		return fmt.Errorf("its format %d is unknown", m.Format)
	case !ValidName(m.Name):
		return fmt.Errorf("its name %q is not valid", m.Name)
	case m.CreatedAt.IsZero():
		return errors.New("it has no time")
	case !m.Kind.Valid():
		return fmt.Errorf("its kind %q is unknown", m.Kind)
	case len(m.Files) > MaxFiles:
		return fmt.Errorf("it lists %d files, more than the %d a backup may hold", len(m.Files), MaxFiles)
	}
	if _, err := buildinfo.ParseVersion(m.Version); err != nil {
		return fmt.Errorf("its version %q is not valid", m.Version)
	}
	sums := map[string]*Part{}
	for _, name := range []string{PartDatabase, PartConfig, PartMedia, PartCerts} {
		sums[name] = &Part{Name: name}
	}
	seen := map[string]bool{}
	var total int64
	for _, f := range m.Files {
		part, limit := partOf(f.Path)
		switch {
		case part == "":
			return fmt.Errorf("it lists %q, which a backup does not hold", f.Path)
		case seen[f.Path]:
			return fmt.Errorf("it lists %s twice", f.Path)
		case f.Size < 0 || f.Size > limit:
			return fmt.Errorf("%s has %d bytes, more than the %d a backup may hold", f.Path, f.Size, limit)
		case !hexSHA256RE.MatchString(f.SHA256):
			return fmt.Errorf("the SHA-256 of %s is not valid", f.Path)
		}
		seen[f.Path] = true
		total += f.Size
		if total > MaxBackupSize {
			return fmt.Errorf("its files have more than the %s a backup may hold", FormatBytes(MaxBackupSize))
		}
		sums[part].Size += f.Size
		sums[part].Files++
	}
	if len(m.Parts) != len(sums) {
		return errors.New("it does not list its four parts")
	}
	for _, p := range m.Parts {
		want, ok := sums[p.Name]
		if !ok || *want != p {
			return fmt.Errorf("its part %q does not match its files", p.Name)
		}
	}
	return nil
}

// ParseMeta decodes and checks metadata. Unknown fields are ignored, so a later format
// can add some.
func ParseMeta(data []byte) (Meta, error) {
	var m Meta
	if err := json.Unmarshal(data, &m); err != nil {
		return Meta{}, fmt.Errorf("its metadata is not valid JSON: %w", err)
	}
	if err := m.Validate(); err != nil {
		return Meta{}, err
	}
	return m, nil
}

// encode returns the metadata as JSON.
func (m Meta) encode() ([]byte, error) {
	data, err := json.MarshalIndent(m, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("encode the metadata: %w", err)
	}
	return append(data, '\n'), nil
}

// CheckVersion refuses a backup that a newer xDesign than current made (section 5.5).
func CheckVersion(m Meta, current string) error {
	c, err := buildinfo.CompareVersions(m.Version, current)
	if err != nil {
		return fmt.Errorf("compare the backup's version with this xDesign's: %w", err)
	}
	if c > 0 {
		return &NewerError{Version: m.Version}
	}
	return nil
}

// NewerError refuses a backup of a newer xDesign.
type NewerError struct {
	Version string
}

func (e *NewerError) Error() string {
	return fmt.Sprintf("This backup is from xDesign %s. Update to %s or later first.", e.Version, e.Version)
}

// FormatBytes is a size for people: "12.3 MB".
func FormatBytes(n int64) string {
	const unit = 1000
	if n < unit {
		return fmt.Sprintf("%d B", n)
	}
	div, exp := int64(unit), 0
	for m := n / unit; m >= unit; m /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(n)/float64(div), "kMGTPE"[exp])
}
