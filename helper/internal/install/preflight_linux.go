package install

import (
	"context"
	"path"
	"regexp"
	"strconv"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// checkSystem checks the operating system (section 1): a supported distribution, not an
// image-based one, with systemd as its init system, in a version xDesign's unit runs on.
// It reports whether the system is one the later checks understand.
func (r *run) checkSystem(ctx context.Context, env *Env, fail func(string, ...any)) bool {
	osOK := r.checkOS(env, fail)
	r.checkImageBased(env, fail)
	if r.checkSystemd(env, fail) {
		r.checkSystemdVersion(ctx, env, fail)
	}
	return osOK
}

func (r *run) checkRoot(env *Env, fail func(string, ...any)) {
	if r.sys.Machine.Euid() == 0 {
		return
	}
	if env.DryRun {
		env.Warnf("not running as root: the installation needs root, and this dry run cannot read every file")
		return
	}
	fail("The installer must run as root. Try: sudo %s", rootCommand(r.in.Rerun))
}

// rootCommand is the command the owner runs the installer with, for the hint to use
// sudo.
func rootCommand(rerun string) string {
	if rerun == "" {
		return "./xdesign --install"
	}
	return strings.TrimPrefix(rerun, "sudo ")
}

func (r *run) checkImageBased(_ *Env, fail func(string, ...any)) {
	if exists(r.sys.FS, "/run/ostree-booted") {
		fail("This is an image-based system (Fedora Atomic, Fedora CoreOS or another one: /run/ostree-booted exists). " +
			"xDesign needs a regular, package-based installation of the system.")
	}
}

// checkSystemd reports whether systemd runs as the init system (PID 1).
func (r *run) checkSystemd(_ *Env, fail func(string, ...any)) bool {
	if !exists(r.sys.FS, "/run/systemd/system") {
		fail("systemd is not running as the init system (/run/systemd/system is missing). " +
			"xDesign needs systemd, so containers without systemd are not supported.")
		return false
	}
	return true
}

func (r *run) checkArch(_ *Env, fail func(string, ...any)) {
	machine, err := r.sys.Machine.Arch()
	if err != nil {
		fail("cannot read the CPU architecture: %v", err)
		return
	}
	r.arch = goArch(machine)
	switch {
	case r.arch == "":
		fail("Unsupported CPU architecture %s; xDesign supports x86_64 (amd64) and aarch64 (arm64).", machine)
	case r.arch != r.in.Build.Arch:
		fail("This xdesign file is for %s but this server is %s; copy the %s file instead (xdesign-%s-linux-%s).",
			r.in.Build.Arch, r.arch, r.arch, r.version, r.arch)
	}
}

// statfsExisting describes the file system of p, or of its nearest existing parent.
func (r *run) statfsExisting(p string) (host.Statfs, error) {
	for {
		st, err := r.sys.Machine.Statfs(p)
		if err == nil || p == "/" {
			return st, err
		}
		p = path.Dir(p)
	}
}

func (r *run) checkDisks(_ *Env, fail func(string, ...any)) {
	opt, err := r.statfsExisting("/opt")
	if err != nil {
		fail("cannot check /opt: %v", err)
	} else {
		if opt.NoExec {
			fail("/opt is mounted with noexec, so the xDesign program in /opt/xdesign could not run. " +
				"Remount /opt without noexec (see /etc/fstab), then run the installer again.")
		}
		if opt.Free < minFree {
			fail("Not enough free space under /opt: %s free, xDesign needs %s.", formatBytes(opt.Free), formatBytes(minFree))
		}
	}
	varLib, err := r.statfsExisting("/var/lib")
	switch {
	case err != nil:
		fail("cannot check /var/lib: %v", err)
	case varLib.Free < minFree:
		fail("Not enough free space under /var/lib: %s free, xDesign needs %s for the database, media and backups.",
			formatBytes(varLib.Free), formatBytes(minFree))
	}
}

func (r *run) checkTimeSync(ctx context.Context, env *Env) {
	res, err := env.Query(ctx, host.Command("timedatectl", "show", "-p", "NTPSynchronized", "--value"))
	if err == nil && res.OK() && res.Out() == "yes" {
		return
	}
	fix := "apt install systemd-timesyncd"
	if r.distro.Family == familyRHEL {
		fix = "dnf install chrony && systemctl enable --now chronyd"
	}
	env.Warnf("the system clock is not synchronized (NTP), and HTTPS certificates and sign-in sessions need a correct clock. Fix: %s", fix)
}

func (r *run) detectSELinux(ctx context.Context, env *Env) {
	r.selinux = selinuxMode(ctx, env)
}

// earlierFiles are the files an earlier installation leaves: any of them without
// install.json means its data is kept here.
func earlierFiles() []string {
	return []string{configPath, currentLink, dataDir, unitDir + "/" + serviceUnit}
}

// minSystemd is the oldest systemd xDesign's unit runs on (section 1).
const minSystemd = 252

// checkOS checks the distribution (section 1) and reports whether it is one the later
// checks understand.
func (r *run) checkOS(_ *Env, fail func(string, ...any)) bool {
	osr, err := host.ReadOSRelease(r.sys.FS)
	if err != nil {
		fail("Cannot tell which operating system this is (%v). xDesign installs on %s.", err, supportedSystems)
		return false
	}
	r.osr = osr
	r.distro = detectDistro(osr)
	if !r.distro.supported {
		fail("%s.", upperFirst(r.distro.why))
		return false
	}
	return true
}

// systemdVersionRE finds the version in the first line of `systemctl --version`:
// "systemd 257 (257.8-1~deb13u1)".
var systemdVersionRE = regexp.MustCompile(`^systemd (\d+)`)

// checkSystemdVersion asks systemd for its version (section 1: 252 or newer).
func (r *run) checkSystemdVersion(ctx context.Context, env *Env, fail func(string, ...any)) {
	res, err := env.Query(ctx, host.Command("systemctl", "--version"))
	if err != nil || !res.OK() {
		env.Warnf("cannot read the version of systemd (systemctl --version); xDesign needs %d or newer", minSystemd)
		return
	}
	m := systemdVersionRE.FindStringSubmatch(res.Out())
	if m == nil {
		env.Warnf("cannot read the version of systemd from %q; xDesign needs %d or newer", firstLine(res.Out()), minSystemd)
		return
	}
	r.systemd, _ = strconv.Atoi(m[1])
	if r.systemd >= minSystemd {
		return
	}
	fail("This system runs systemd %d, and xDesign's unit needs systemd %d or newer. Use a newer release of the system "+
		"(%s).", r.systemd, minSystemd, supportedSystems)
}

// firstLine returns the first line of s.
func firstLine(s string) string {
	line, _, _ := strings.Cut(s, "\n")
	return line
}

// selinuxMode is SELinux's mode from getenforce: "enforcing", "permissive", or "" when
// it is off or missing.
func selinuxMode(ctx context.Context, env *Env) string {
	res, err := env.Query(ctx, host.Command("getenforce"))
	if err != nil || !res.OK() {
		return ""
	}
	switch strings.ToLower(res.Out()) {
	case "enforcing":
		return "enforcing"
	case "permissive":
		return "permissive"
	}
	return ""
}
