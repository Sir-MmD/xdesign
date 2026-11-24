package install

import (
	"context"
	"errors"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// ssUsersRE finds the program names in the users column of ss -p: users:(("nginx",pid=1,fd=6)).
var ssUsersRE = regexp.MustCompile(`\("([^"]+)",pid=`)

// listeningPrograms reads `ss -ltnpH`: the names of the programs that listen on each TCP
// port. Without root ss names no program of another user; a failure leaves it empty.
func listeningPrograms(ctx context.Context, env *Env) map[int][]string {
	res, err := env.Query(ctx, host.Command("ss", "-ltnpH"))
	if err != nil || !res.OK() {
		return nil
	}
	found := map[int][]string{}
	for line := range strings.SplitSeq(string(res.Stdout), "\n") {
		f := strings.Fields(line)
		if len(f) < 4 {
			continue
		}
		port, err := strconv.Atoi(f[3][strings.LastIndex(f[3], ":")+1:])
		if err != nil {
			continue
		}
		for _, m := range ssUsersRE.FindAllStringSubmatch(line, -1) {
			if !slices.Contains(found[port], m[1]) {
				found[port] = append(found[port], m[1])
			}
		}
	}
	return found
}

// portNeedsPrivilege reports whether a port could not be opened only because this process
// is not root (a port below 1024).
func portNeedsPrivilege(err error) bool {
	return errors.Is(err, platform.ErrAccess) || errors.Is(err, platform.ErrPerm)
}

// certsFileOwner is the owner and mode of the HTTPS manager's files, for the plan.
const certsFileOwner = "xdesign:xdesign 0600"

// makeCertsDir makes the HTTPS manager's folder dir, xdesign:xdesign 0700, and returns the
// owner of its files.
func (r *run) makeCertsDir(ctx context.Context, env *Env, dir string) (host.Owner, error) {
	uid, gid, err := r.sys.Users.LookupUser(serviceUser)
	if err != nil && !env.DryRun {
		return host.Owner{}, err
	}
	if _, err := env.Run(ctx, host.Command("install", "-d", "-m", "0700", "-o", serviceUser, "-g", serviceUser, dir)); err != nil {
		return host.Owner{}, err
	}
	return host.Owner{UID: uid, GID: gid}, nil
}
