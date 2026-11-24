package buildinfo

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
)

// SemVer is a parsed semantic version: MAJOR.MINOR.PATCH with an optional
// pre-release and build metadata (https://semver.org). Releases are "X.Y.Z";
// development builds are "0.0.0-dev+<short commit>", with ".dirty" appended to the
// commit for uncommitted changes (docs/plan/07-server-install-update.md section 2).
type SemVer struct {
	Major, Minor, Patch uint64
	// Pre holds the dot-separated pre-release identifiers ("dev"), nil for a release.
	Pre []string
	// Build is the build metadata after "+", without the "+". It does not take part
	// in comparisons.
	Build string
}

// ErrInvalidVersion is returned for a string that is not a semantic version.
var ErrInvalidVersion = errors.New("not a semantic version")

// ParseVersion parses a semantic version. A leading "v" is not accepted: tags are
// vX.Y.Z, versions are X.Y.Z.
func ParseVersion(s string) (SemVer, error) {
	var v SemVer
	rest := s
	if i := strings.IndexByte(rest, '+'); i >= 0 {
		v.Build = rest[i+1:]
		rest = rest[:i]
		if !validIdentifiers(v.Build, false) {
			return SemVer{}, fmt.Errorf("%w: %q has invalid build metadata", ErrInvalidVersion, s)
		}
	}
	if i := strings.IndexByte(rest, '-'); i >= 0 {
		pre := rest[i+1:]
		rest = rest[:i]
		if !validIdentifiers(pre, true) {
			return SemVer{}, fmt.Errorf("%w: %q has an invalid pre-release", ErrInvalidVersion, s)
		}
		v.Pre = strings.Split(pre, ".")
	}
	parts := strings.Split(rest, ".")
	if len(parts) != 3 {
		return SemVer{}, fmt.Errorf("%w: %q needs the form MAJOR.MINOR.PATCH", ErrInvalidVersion, s)
	}
	nums := make([]uint64, 3)
	for i, p := range parts {
		n, ok := parseNumber(p)
		if !ok {
			return SemVer{}, fmt.Errorf("%w: %q has an invalid number %q", ErrInvalidVersion, s, p)
		}
		nums[i] = n
	}
	v.Major, v.Minor, v.Patch = nums[0], nums[1], nums[2]
	return v, nil
}

// parseNumber parses a numeric identifier: digits only, no leading zero unless it is
// "0".
func parseNumber(s string) (uint64, bool) {
	if s == "" || (len(s) > 1 && s[0] == '0') {
		return 0, false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return 0, false
		}
	}
	n, err := strconv.ParseUint(s, 10, 64)
	return n, err == nil
}

// validIdentifiers reports whether s is a non-empty list of dot-separated
// identifiers of [0-9A-Za-z-]. Pre-release identifiers that are numeric must not
// have leading zeros; build identifiers may.
func validIdentifiers(s string, pre bool) bool {
	if s == "" {
		return false
	}
	for id := range strings.SplitSeq(s, ".") {
		if id == "" {
			return false
		}
		numeric := true
		for _, r := range id {
			switch {
			case r >= '0' && r <= '9':
			case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r == '-':
				numeric = false
			default:
				return false
			}
		}
		if pre && numeric && len(id) > 1 && id[0] == '0' {
			return false
		}
	}
	return true
}

// IsRelease reports whether v is a release version (no pre-release). Development
// builds are not releases.
func (v SemVer) IsRelease() bool {
	return len(v.Pre) == 0
}

// String formats v back into its canonical text.
func (v SemVer) String() string {
	s := fmt.Sprintf("%d.%d.%d", v.Major, v.Minor, v.Patch)
	if len(v.Pre) > 0 {
		s += "-" + strings.Join(v.Pre, ".")
	}
	if v.Build != "" {
		s += "+" + v.Build
	}
	return s
}

// Compare returns -1, 0 or +1 when v has lower, equal or higher precedence than w,
// following semver section 11: build metadata is ignored, and a pre-release is
// lower than the release with the same numbers.
func (v SemVer) Compare(w SemVer) int {
	for _, c := range [][2]uint64{{v.Major, w.Major}, {v.Minor, w.Minor}, {v.Patch, w.Patch}} {
		if c[0] != c[1] {
			if c[0] < c[1] {
				return -1
			}
			return 1
		}
	}
	switch {
	case len(v.Pre) == 0 && len(w.Pre) == 0:
		return 0
	case len(v.Pre) == 0:
		return 1
	case len(w.Pre) == 0:
		return -1
	}
	for i := 0; i < len(v.Pre) && i < len(w.Pre); i++ {
		if c := comparePre(v.Pre[i], w.Pre[i]); c != 0 {
			return c
		}
	}
	switch {
	case len(v.Pre) < len(w.Pre):
		return -1
	case len(v.Pre) > len(w.Pre):
		return 1
	}
	return 0
}

// comparePre compares two pre-release identifiers: numeric ones numerically and
// below alphanumeric ones, alphanumeric ones in ASCII order.
func comparePre(a, b string) int {
	an, aNum := parseNumber(a)
	bn, bNum := parseNumber(b)
	switch {
	case aNum && bNum:
		switch {
		case an < bn:
			return -1
		case an > bn:
			return 1
		}
		return 0
	case aNum:
		return -1
	case bNum:
		return 1
	}
	return strings.Compare(a, b)
}

// CompareVersions parses a and b and compares them like [SemVer.Compare].
func CompareVersions(a, b string) (int, error) {
	va, err := ParseVersion(a)
	if err != nil {
		return 0, err
	}
	vb, err := ParseVersion(b)
	if err != nil {
		return 0, err
	}
	return va.Compare(vb), nil
}
