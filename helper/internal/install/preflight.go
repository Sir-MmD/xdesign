package install

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// Limits of docs/plan/07-server-install-update.md section 3.
const (
	mib = uint64(1) << 20
	gib = uint64(1) << 30
	// minFree is what /opt (the release folder, about 150 MB, and the next update's) and
	// /var/lib (the database, the media and the backups) need at least.
	minFree = gib
)

// The ports of HTTPS (section 4.1): 443, which a site's address leaves out, and 80 for
// Let's Encrypt's checks.
const (
	httpsPort = 443
	httpPort  = 80
)

// PreflightError lists every failed preflight check, so the owner can fix them all
// before the next run.
type PreflightError struct {
	Problems []string
}

func (e *PreflightError) Error() string {
	if len(e.Problems) == 1 {
		return e.Problems[0]
	}
	return fmt.Sprintf("%d checks failed:\n- %s", len(e.Problems), strings.Join(e.Problems, "\n- "))
}

func (r *run) stepPreflight() Step {
	return Step{Num: "1", ID: "preflight", Title: "Preflight checks", ReadOnly: true, Act: r.preflight}
}

// preflight runs the checks of section 3 step 1. It changes nothing. Every failure is
// collected; the step fails with all of them at the end.
func (r *run) preflight(ctx context.Context, env *Env) error {
	var problems []string
	fail := func(format string, args ...any) { problems = append(problems, fmt.Sprintf(format, args...)) }

	r.checkRoot(env, fail)
	r.checkRelease(env, fail)
	osOK := r.checkSystem(ctx, env, fail)
	r.checkArch(env, fail)
	r.checkDisks(env, fail)
	r.detectPrevious(env, fail)
	if osOK {
		r.checkTimeSync(ctx, env)
		r.detectSELinux(ctx, env)
	}
	if !exists(r.sys.FS, configPath) {
		r.checkPort80(ctx, env) // a site that keeps its settings holds the ports itself
	}
	r.detectFirewall(ctx, env)
	r.fillState()

	r.reportFacts(env, osOK)
	if len(problems) > 0 {
		return &PreflightError{Problems: problems}
	}
	return nil
}

// reportFacts gives the facts of `:: Checking this server...`: the system, SELinux when
// it is on, and what is found of xDesign.
func (r *run) reportFacts(env *Env, osOK bool) {
	env.Factf("system", "%s", r.describeSystem())
	if osOK && r.selinux != "" {
		env.Factf("SELinux", "%s", r.selinux)
	}
	env.Factf("xDesign", "%s", r.xdesignFact())
	if r.mode == ModeRepair {
		env.Warnf("xdesign %s is up to date -- repairing", r.version)
	}
}

// xdesignFact says what preflight found of xDesign, and what this run does with it
// unless it is refused.
func (r *run) xdesignFact() string {
	version := r.version
	if r.refusal != nil {
		switch {
		case r.mode == ModeResume:
			return fmt.Sprintf("an earlier installation of %s did not finish", r.prevVersion)
		case r.mode == ModeExisting || r.programMissing:
			return "the data of an earlier installation of " + r.prevVersion + " is here"
		}
		return r.prevVersion + " is installed"
	}
	switch r.mode {
	case ModeResume:
		where := "did not finish"
		if section := r.stoppedAt(); section != "" {
			where = `stopped at "` + section + `"`
		}
		with := ""
		if r.prevVersion != "" && r.prevVersion != version {
			with = " with " + version
		}
		return fmt.Sprintf("an earlier installation of %s %s: this run continues it%s and skips the steps that are done",
			orUnknown(r.prevVersion), where, with)
	case ModeRepair:
		if r.programMissing {
			return version + " is installed, but its program in " + currentLink + " is missing: the repair puts it back and keeps " +
				"the settings, the accounts and the data"
		}
		return version + " is installed: the settings, the accounts and the data are kept"
	case ModeExisting:
		switch {
		case !r.hasPrev:
			return "files of an earlier installation are here but " + StatePath + " is missing (found: " + strings.Join(r.found, ", ") +
				"): the existing settings and data are kept"
		case r.programMissing:
			return fmt.Sprintf("%s names %s as installed, but its program in %s is missing: this run installs %s with its data, "+
				"keeping the database and the settings", StatePath, orUnknown(r.prevVersion), currentLink, version)
		case r.prev.Status == StateUninstalled:
			return fmt.Sprintf("%s was uninstalled%s and its data kept: this run installs %s with it, keeping the database "+
				"and the settings", orUnknown(r.prevVersion), uninstalledOn(r.prev), version)
		}
		return fmt.Sprintf("%s has the status %q: the existing settings and data are kept", StatePath, r.prev.Status)
	case ModeUpdate, ModeNewer:
		return r.prevVersion + " is installed"
	case ModeFresh:
	}
	return "not installed"
}

// uninstalledOn is " on <date>" of the last uninstall in the history of st that did not fail,
// or "".
func uninstalledOn(st State) string {
	for i := len(st.History) - 1; i >= 0; i-- {
		if h := st.History[i]; h.Action == ActionUninstall && h.Result == "" {
			if t, err := time.Parse(time.RFC3339, h.At); err == nil {
				return " on " + t.UTC().Format("2006-01-02")
			}
			return ""
		}
	}
	return ""
}

// checkRelease checks that this file is a release: a development build carries no
// payload, so it has no Node.js and no app to install.
func (r *run) checkRelease(env *Env, fail func(string, ...any)) {
	if r.in.Build.PayloadSHA256 != "" {
		return
	}
	text := "this xdesign file carries no payload: it is a development build; build a release with ./build.sh or make release"
	if env.DryRun {
		env.Warnf("%s", text)
		return
	}
	fail("%s.", upperFirst(text))
}

// osName names the system for the owner: "Debian 13", "Fedora 44", or the pretty
// name of another system.
func osName(osr host.OSRelease) string {
	switch {
	case osr.ID == "debian" && osr.VersionID == "":
		return "Debian testing"
	case osr.ID == "debian":
		return "Debian " + osr.VersionID
	case osr.ID == "fedora":
		return "Fedora " + osr.VersionID
	case osr.PrettyName != "":
		return osr.PrettyName
	}
	return strings.TrimSpace(osr.ID + " " + osr.VersionID)
}

// goArch maps the system's CPU (platform.Machine) to the Go architecture names of the
// release files.
func goArch(machine string) string {
	switch machine {
	case "x86_64", "AMD64": // uname -m on Linux, platform.Machine on Windows
		return "amd64"
	case "aarch64", "ARM64":
		return "arm64"
	}
	return ""
}

// detectPrevious decides the mode from install.json and the files of an earlier
// installation (section 3 step 1). The installed version is the one /opt/xdesign/current
// runs; when that program is gone, the installation counts as kept data. An older xDesign
// is updated with xdesign update, and a newer xDesign, its unfinished installation or its
// data is refused (r.refusal): the installer never goes back to an older release.
func (r *run) detectPrevious(env *Env, fail func(string, ...any)) {
	st, found, err := ReadState(r.sys.FS)
	if err != nil {
		fail("%v", err)
		return
	}
	version := r.version
	if !found {
		r.mode = ModeFresh
		for _, p := range earlierFiles() {
			if lexists(r.sys.FS, p) {
				r.found = append(r.found, p)
			}
		}
		if len(r.found) > 0 {
			r.mode = ModeExisting // the xDesign fact says so (reportFacts)
		}
		return
	}
	r.prev, r.hasPrev, r.prevVersion = st, true, st.CurrentVersion
	switch st.Status {
	case StateInstalling:
		r.mode = ModeResume
		if r.newerThanThis(r.prevVersion) {
			r.refuseNewer(fail, fmt.Sprintf("an installation of xdesign %s did not finish here, newer than this %s", r.prevVersion, version),
				Fact{Label: "finish it", Value: "with the xdesign file of " + r.prevVersion + " or newer"})
		}
	case StateInstalled:
		if v, missing, ok := installedVersion(r.sys.FS); ok && !missing {
			if v != st.CurrentVersion {
				env.Notef("%s names %s, but %s runs %s, which counts as installed", StatePath, orUnknown(st.CurrentVersion), currentLink, v)
			}
			r.prevVersion = v
		} else {
			r.programMissing = true
		}
		r.mode = r.versionMode(r.prevVersion, version)
		switch {
		case r.mode == ModeNewer && r.programMissing:
			r.refuseNewer(fail, fmt.Sprintf("xDesign's data from an earlier installation of %s is here, newer than this %s", r.prevVersion, version),
				Fact{Label: "use it", Value: "with the xdesign file of " + r.prevVersion + " or newer"})
		case r.mode == ModeNewer:
			r.refusal = &refusal{text: fmt.Sprintf("xdesign %s is installed, newer than this %s", r.prevVersion, version),
				facts: []Fact{{Label: "nothing changed", Value: "the installer never goes back to an older release; " +
					adminPrefix + "xdesign rollback goes back to a release this server keeps"}}}
			fail("%s", r.refusal.text)
		case r.mode == ModeUpdate && r.programMissing:
			r.mode = ModeExisting // nothing runs that xdesign update could start from
		case r.mode == ModeUpdate:
			// The installer hands the run to the update with this file (update.go).
			env.Notef("xdesign %s is installed, older than this %s: it is updated as %sxdesign update %s does", r.prevVersion,
				version, adminPrefix, r.programFile())
		}
	default: // "uninstalled": an uninstall kept the data; or a status this release does not know
		r.mode = ModeExisting
		if r.newerThanThis(r.prevVersion) {
			r.refuseNewer(fail, fmt.Sprintf("xDesign's data from an earlier installation of %s is here, newer than this %s", r.prevVersion, version),
				Fact{Label: "use it", Value: "with the xdesign file of " + r.prevVersion + " or newer"})
		}
	}
}

// programFile is the path of this file, for the command that updates an older
// installation with it.
func (r *run) programFile() string {
	if r.in.Program != "" {
		return r.in.Program
	}
	return "<this file>"
}

// newerThanThis reports whether v is a version newer than this release.
func (r *run) newerThanThis(v string) bool {
	if v == "" || v == r.version {
		return false
	}
	c, err := buildinfo.CompareVersions(v, r.version)
	return err == nil && c > 0
}

// versionMode compares the installed version with this release.
func (r *run) versionMode(installed, this string) Mode {
	if installed == this {
		return ModeRepair
	}
	c, err := buildinfo.CompareVersions(installed, this)
	switch {
	case err != nil || c < 0:
		return ModeUpdate
	case c > 0:
		return ModeNewer
	}
	// Equal precedence but different text: two development builds.
	return ModeUpdate
}

func orUnknown(s string) string {
	if s == "" {
		return "(unknown version)"
	}
	return s
}

// fillState starts the install.json of this run from what preflight found.
func (r *run) fillState() {
	if r.hasPrev {
		r.state = r.prev
	} else {
		r.state = State{}
	}
	r.state.CurrentVersion = r.version
	r.state.OS = StateOS{ID: r.osr.ID, VersionID: r.osr.VersionID, Arch: r.arch}
	r.state.SELinux.Enabled = r.selinux != ""
}

func orUnknownArch(a string) string {
	if a == "" {
		return "unknown architecture"
	}
	return a
}

// exists reports whether p exists, following symbolic links.
func exists(fsys host.FS, p string) bool {
	_, err := fsys.Stat(p)
	return err == nil
}

// lexists reports whether p exists, without following a final symbolic link.
func lexists(fsys host.FS, p string) bool {
	_, err := fsys.Lstat(p)
	return err == nil
}

// formatBytes formats a size for the owner: "512 MB", "1.5 GB".
func formatBytes(n uint64) string {
	switch {
	case n >= 10*gib:
		return fmt.Sprintf("%d GB", n/gib)
	case n >= gib:
		return fmt.Sprintf("%.1f GB", float64(n)/float64(gib))
	default:
		return fmt.Sprintf("%d MB", n/mib)
	}
}
