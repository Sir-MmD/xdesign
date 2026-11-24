package install

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// SELinux for the site's port (docs/plan/07-server-install-update.md section 4.5): on a
// Fedora whose SELinux is enforcing, a port that is not labeled http_port_t gets that
// label. It is asked first, and its command goes to the install log like every other.

// selinuxBinType is the part of a context with the type systemd may execute.
const selinuxBinType = ":bin_t:"

// selinuxPortType is the SELinux type the installer gives the site's port.
const selinuxPortType = "http_port_t"

// semanageHint says where semanage comes from when it is missing.
const semanageHint = "semanage is not installed (dnf install policycoreutils-python-utils)"

// portLabel returns the SELinux type of TCP port in `semanage port -l` ("" when no type
// holds it): lines such as "http_port_t  tcp  80, 81, 443, 8008-8009".
func portLabel(ctx context.Context, env *Env, port int) (string, error) {
	cmd := host.Command("semanage", "port", "-l")
	res, err := env.Query(ctx, cmd)
	if err != nil {
		return "", err
	}
	if err := res.Err(cmd); err != nil {
		return "", err
	}
	label := ""
	for line := range strings.SplitSeq(string(res.Stdout), "\n") {
		f := strings.Fields(line)
		if len(f) < 3 || f[1] != "tcp" {
			continue
		}
		for _, item := range strings.Split(strings.Join(f[2:], ""), ",") {
			lo, hi, isRange := strings.Cut(item, "-")
			a, errA := strconv.Atoi(lo)
			b, errB := strconv.Atoi(hi)
			if !isRange {
				b, errB = a, errA
			}
			if errA == nil && errB == nil && a <= port && port <= b {
				if f[0] == selinuxPortType {
					return f[0], nil
				}
				label = f[0]
			}
		}
	}
	return label, nil
}

// askSELinux asks for the label of the site's port while SELinux is enforcing; without
// questions (--yes, dry runs) it is made. A tool that is missing is a warning: the owner
// runs the command later.
func (r *run) askSELinux(ctx context.Context, ask bool) error {
	r.labelPort = 0
	if r.selinux != "enforcing" {
		return nil
	}
	port, err := strconv.Atoi(listenPort(r.cfg.Listen))
	if err != nil {
		return nil //nolint:nilerr // config.Parse checks the port; nothing to label without one
	}
	label, err := portLabel(ctx, r.env, port)
	switch {
	case errors.Is(err, host.ErrCommandNotFound):
		r.warningf("%s, so port %d is not labeled %s; run semanage port -a -t %s -p tcp %d once it is", semanageHint, port,
			selinuxPortType, selinuxPortType, port)
		return nil
	case err != nil:
		r.warningf("the SELinux port labels cannot be read (%v)", err)
		return nil
	case label == selinuxPortType:
		return nil
	}
	ok := true
	if ask {
		question := fmt.Sprintf("Label port %d for HTTPS under SELinux (semanage port %s -t %s -p tcp %d)?", port, semanageFlag(label),
			selinuxPortType, port)
		if ok, err = r.ask.confirm(question, true); err != nil {
			return err
		}
	}
	if ok {
		r.labelPort = port
	}
	return nil
}

// semanageFlag adds a port's label (-a), or moves it from another type (-m).
func semanageFlag(label string) string {
	if label == "" {
		return "-a"
	}
	return "-m"
}
