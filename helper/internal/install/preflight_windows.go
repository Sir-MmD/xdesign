package install

import (
	"context"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// The systems the installer takes on Windows (docs/plan/18-third-owner-list-2026-11-23.md
// section 8.1, Q-79): Windows Server 2019 and Windows 10 1809 are build 17763, and every
// later Windows Server and Windows 10 or 11 has a higher build.
const (
	supportedWindows = "Windows Server 2019, 2022 and 2025, Windows 10 (1809 or later) and Windows 11, 64-bit"
	minWindowsBuild  = 17763
)

// checkRoot checks that the installer runs elevated: in a terminal opened as
// Administrator (section 8.3 step 1).
func (r *run) checkRoot(env *Env, fail func(string, ...any)) {
	if platform.Elevated() {
		return
	}
	if env.DryRun {
		env.Warnf("not running as Administrator: the installation needs it, and this dry run cannot read every file")
		return
	}
	fail("Run this in a terminal opened as Administrator.")
}

// checkSystem checks the version and build of Windows (section 8.1) and keeps them for
// install.json and the system fact. It reports whether the system is supported.
func (r *run) checkSystem(_ context.Context, _ *Env, fail func(string, ...any)) bool {
	version, err := platform.Version()
	if err != nil {
		fail("Cannot tell which version of Windows this is (%v). xDesign installs on %s.", err, supportedWindows)
		return false
	}
	parts := strings.Split(version, ".")
	major, _ := strconv.Atoi(parts[0])
	build := 0
	if len(parts) == 3 {
		build, _ = strconv.Atoi(parts[2])
	}
	name, err := platform.Product()
	if err != nil {
		name = "Windows " + version
	}
	r.osr = host.OSRelease{ID: "windows", VersionID: version, PrettyName: fmt.Sprintf("%s (build %d)", name, build)}
	r.distro = distro{ID: r.osr.ID, Name: r.osr.PrettyName, Version: build, supported: major == 10 && build >= minWindowsBuild}
	if !r.distro.supported {
		r.distro.why = "xDesign installs on " + supportedWindows + "; this system is " + r.distro.Name + ", which is not supported"
		fail("%s.", r.distro.why)
		return false
	}
	return true
}

// checkArch checks the processor of the system, not the one this file runs as (an amd64
// file runs emulated on arm64 Windows).
func (r *run) checkArch(_ *Env, fail func(string, ...any)) {
	machine, err := r.sys.Machine.Arch()
	if err != nil {
		fail("cannot read the CPU architecture: %v", err)
		return
	}
	r.arch = goArch(machine)
	switch {
	case r.arch == "":
		fail("Unsupported CPU architecture %s; xDesign supports x64 (amd64) and ARM64 (arm64).", machine)
	case r.arch != r.in.Build.Arch:
		fail("This xdesign file is for %s but this server is %s; copy the %s file instead (xdesign-%s-windows-%s.exe).",
			r.in.Build.Arch, r.arch, r.arch, r.version, r.arch)
	}
}

// statfsExisting describes the drive of p, through its nearest existing parent.
func (r *run) statfsExisting(p string) (host.Statfs, error) {
	for {
		st, err := r.sys.Machine.Statfs(p)
		parent := filepath.Dir(p)
		if err == nil || parent == p {
			return st, err
		}
		p = parent
	}
}

// checkDisks checks the free space of the drives of C:\Program Files\xDesign (the release
// folder and the next update's) and C:\ProgramData\xDesign (the database, the media and
// the backups): the system drive, once.
func (r *run) checkDisks(_ *Env, fail func(string, ...any)) {
	seen := map[string]bool{}
	for _, dir := range []string{optDir, etcDir} {
		drive := strings.ToUpper(strings.TrimSuffix(filepath.VolumeName(dir), ":"))
		if seen[drive] {
			continue
		}
		seen[drive] = true
		st, err := r.statfsExisting(dir)
		switch {
		case err != nil:
			fail("cannot check the drive %s: %v", drive, err)
		case st.Free < minFree:
			fail("Not enough free space on drive %s: %s free, xDesign needs %s for the program, the database, the media and the backups.",
				drive, formatBytes(st.Free), formatBytes(minFree))
		}
	}
}

// checkTimeSync warns when Windows Time does not keep the clock synchronized: `w32tm
// /query /status` fails when the service is stopped, and names the computer's own clock
// as the source or "Leap Indicator: 3" (not synchronized) when it has no time source.
func (r *run) checkTimeSync(ctx context.Context, env *Env) {
	res, err := env.Query(ctx, host.Command("w32tm", "/query", "/status"))
	if err == nil && res.OK() && timeSynced(res.Out()) {
		return
	}
	env.Warnf("the system clock is not synchronized (Windows Time), and HTTPS certificates and sign-in sessions need a correct " +
		"clock. Fix: net start w32time, then w32tm /resync")
}

// timeSynced reads the status of Windows Time.
func timeSynced(status string) bool {
	for _, unsynced := range []string{"Local CMOS Clock", "Free-running System Clock", "Leap Indicator: 3"} {
		if strings.Contains(status, unsynced) {
			return false
		}
	}
	return true
}

// detectSELinux does nothing: Windows has no SELinux.
func (r *run) detectSELinux(context.Context, *Env) {}

// earlierFiles are the files an earlier installation leaves: any of them without
// install.json means its data is kept here.
func earlierFiles() []string {
	return []string{configPath, currentLink, dataDir}
}
