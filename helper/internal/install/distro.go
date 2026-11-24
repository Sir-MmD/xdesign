package install

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// The systems the installer takes (docs/plan/07-server-install-update.md section 1, Q-24):
// Ubuntu 24.04 and 26.04, Debian 12 and 13 and Fedora 43 or newer. Copied from xWriter's
// distro.go and cut to them: two families, whose expected times differ (weights.go) and
// whose fixes the warnings name.

// Families of the systems.
const (
	// familyDebian installs with apt-get: Debian and Ubuntu.
	familyDebian = "debian"
	// familyRHEL installs with dnf: Fedora.
	familyRHEL = "rhel"
)

// Variants: the systems of a family.
const (
	variantDebian = "debian"
	variantUbuntu = "ubuntu"
	variantFedora = "fedora"
)

// supportedSystems names the systems of section 1 for the owner.
const supportedSystems = "Ubuntu 24.04 and 26.04, Debian 12 and 13, and Fedora 43 or newer"

// distro is the operating system as the installer sorts it.
type distro struct {
	// Family is familyDebian or familyRHEL; "" for a system the installer does not take.
	Family string
	// Variant is one of the variant constants.
	Variant string
	// Version is the release: 13 for Debian 13, 2404 for Ubuntu 24.04, 44 for Fedora 44.
	Version int
	// ID is the ID of os-release ("debian"); Name names the system for the owner.
	ID, Name string
	// supported reports a system of section 1; why says why another one is refused.
	supported bool
	why       string
}

// detectDistro sorts the system of os-release into the families and variants of
// section 1.
func detectDistro(osr host.OSRelease) distro {
	d := distro{ID: osr.ID, Name: osName(osr)}
	major := leadingNumber(osr.VersionID)
	switch osr.ID {
	case "debian":
		d.Family, d.Variant, d.Version = familyDebian, variantDebian, major
		d.supported = major == 12 || major == 13
	case "ubuntu":
		d.Family, d.Variant, d.Version = familyDebian, variantUbuntu, ubuntuVersion(osr.VersionID)
		d.supported = d.Version == 2404 || d.Version == 2604
	case "fedora":
		d.Family, d.Variant, d.Version = familyRHEL, variantFedora, major
		d.supported = major >= 43
	}
	if !d.supported {
		d.why = "xDesign installs on " + supportedSystems + "; this system is " + d.Name + ", which is not supported"
	}
	return d
}

// leadingNumber returns the number at the start of s ("9" of "9.6"), 0 when there is
// none.
func leadingNumber(s string) int {
	end := strings.IndexFunc(s, func(c rune) bool { return c < '0' || c > '9' })
	if end < 0 {
		end = len(s)
	}
	n, _ := strconv.Atoi(s[:end])
	return n
}

// ubuntuVersion turns "24.04" into 2404; 0 when it is not a year.month version.
func ubuntuVersion(s string) int {
	year, month, ok := strings.Cut(s, ".")
	y, err1 := strconv.Atoi(year)
	m, err2 := strconv.Atoi(month)
	if !ok || err1 != nil || err2 != nil {
		return 0
	}
	return y*100 + m
}

// systemFamily returns the family of this system's os-release, whose expected times the
// plan of a run takes (weights.go); empty when the file cannot be read.
func systemFamily(fsys host.FS) string {
	osr, err := host.ReadOSRelease(fsys)
	if err != nil {
		return ""
	}
	return detectDistro(osr).Family
}

// upperFirst returns s with its first letter in upper case; the product's name keeps
// its small x.
func upperFirst(s string) string {
	if s == "" || strings.HasPrefix(s, "xDesign") {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

// describeSystem is the system fact of `:: Checking this server...`: "Debian
// GNU/Linux 13 (trixie), amd64, systemd 257".
func (r *run) describeSystem() string {
	name := r.osr.PrettyName
	if name == "" {
		name = osName(r.osr)
	}
	parts := []string{name, orUnknownArch(r.arch)}
	if r.systemd > 0 {
		parts = append(parts, fmt.Sprintf("systemd %d", r.systemd))
	}
	return strings.Join(parts, ", ")
}
