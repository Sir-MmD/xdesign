package install

import (
	"context"
	"fmt"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// httpSysText names the program behind a port the System process holds: HTTP.sys, which
// serves IIS and the other programs that use it (docs/plan/18-third-owner-list-
// 2026-11-23.md section 8.3 step 1, R-343).
const httpSysText = "IIS or another HTTP.sys program"

// listeningPrograms reads the table of listening TCP sockets (GetExtendedTcpTable): the
// names of the programs that listen on each port, HTTP.sys's as httpSysText. A failure
// leaves it empty.
func listeningPrograms(_ context.Context, env *Env) map[int][]string {
	pids, err := platform.ListeningPIDs()
	if err != nil {
		env.Log().Printf("the programs that listen on the ports: %v", err)
		return nil
	}
	found := map[int][]string{}
	for port, list := range pids {
		for _, pid := range list {
			name := httpSysText
			if pid != platform.SystemPID {
				if name, err = platform.ProgramName(pid); err != nil {
					name = fmt.Sprintf("process %d", pid)
				}
			}
			found[port] = append(found[port], name)
		}
	}
	return found
}

// portNeedsPrivilege reports false: Windows has no ports that need a privilege, and a
// port it refuses (WSAEACCES) is held by another program for itself alone or reserved.
func portNeedsPrivilege(error) bool {
	return false
}

// certsFileOwner says whose the HTTPS manager's files are, for the plan.
const certsFileOwner = "the data folder's permissions"

// makeCertsDir makes the HTTPS manager's folder dir in the data folder, whose permissions
// it takes (the service's account changes it); the owner of its files does not matter.
func (r *run) makeCertsDir(_ context.Context, env *Env, dir string) (host.Owner, error) {
	err := env.Do("mkdir "+dir, func() error { return r.sys.FS.MkdirAll(dir, 0o700) })
	return host.Owner{}, err
}
