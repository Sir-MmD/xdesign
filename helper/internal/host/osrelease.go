package host

import (
	"errors"
	"fmt"
	"io/fs"
	"strings"
)

// OSRelease holds the fields of os-release(5) that the installer uses.
type OSRelease struct {
	// ID is the lower-case distribution ID ("debian", "fedora").
	ID string
	// IDLike lists the distributions this one derives from ("debian" for Ubuntu).
	IDLike []string
	// VersionID is the version ("13", "44").
	VersionID string
	// PrettyName is the name for people ("Debian GNU/Linux 13 (trixie)").
	PrettyName string
	// VariantID is the edition on Fedora ("server", "cloud"), empty elsewhere.
	VariantID string
}

// osReleasePaths are the places of os-release(5), in lookup order.
func osReleasePaths() []string {
	return []string{"/etc/os-release", "/usr/lib/os-release"}
}

// ReadOSRelease reads /etc/os-release, or /usr/lib/os-release when the first does not
// exist.
func ReadOSRelease(fsys FS) (OSRelease, error) {
	var lastErr error
	for _, p := range osReleasePaths() {
		data, err := fsys.ReadFile(p)
		if errors.Is(err, fs.ErrNotExist) {
			lastErr = err
			continue
		}
		if err != nil {
			return OSRelease{}, fmt.Errorf("read the operating system release: %w", err)
		}
		return ParseOSRelease(data), nil
	}
	return OSRelease{}, fmt.Errorf("read the operating system release: %w", lastErr)
}

// ParseOSRelease parses os-release(5) data: KEY=value lines, values optionally in
// single or double quotes with backslash escapes in double quotes.
func ParseOSRelease(data []byte) OSRelease {
	var r OSRelease
	for line := range strings.SplitSeq(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		value = unquoteOSRelease(value)
		switch key {
		case "ID":
			r.ID = strings.ToLower(value)
		case "ID_LIKE":
			r.IDLike = strings.Fields(strings.ToLower(value))
		case "VERSION_ID":
			r.VersionID = value
		case "PRETTY_NAME":
			r.PrettyName = value
		case "VARIANT_ID":
			r.VariantID = value
		}
	}
	return r
}

func unquoteOSRelease(v string) string {
	if len(v) >= 2 && v[0] == '\'' && v[len(v)-1] == '\'' {
		return v[1 : len(v)-1]
	}
	if len(v) >= 2 && v[0] == '"' && v[len(v)-1] == '"' {
		v = v[1 : len(v)-1]
		var b strings.Builder
		for i := 0; i < len(v); i++ {
			if v[i] == '\\' && i+1 < len(v) {
				i++
			}
			b.WriteByte(v[i])
		}
		return b.String()
	}
	return v
}

// Like reports whether the system is distribution id or derives from it.
func (r OSRelease) Like(id string) bool {
	if r.ID == id {
		return true
	}
	for _, l := range r.IDLike {
		if l == id {
			return true
		}
	}
	return false
}
