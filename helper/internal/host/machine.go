package host

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"os"
	"os/user"
	"strconv"

	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// OSUsers looks users and groups up in /etc/passwd and /etc/group (the pure Go
// implementation of os/user, since the binary is built without cgo).
type OSUsers struct{}

// LookupUser implements [Users].
func (OSUsers) LookupUser(name string) (uid, gid int, err error) {
	u, err := user.Lookup(name)
	var unknown user.UnknownUserError
	if errors.As(err, &unknown) {
		return 0, 0, fmt.Errorf("user %s: %w", name, ErrUnknownUser)
	}
	if err != nil {
		return 0, 0, fmt.Errorf("look up user %s: %w", name, err)
	}
	if uid, err = strconv.Atoi(u.Uid); err == nil {
		gid, err = strconv.Atoi(u.Gid)
	}
	if err != nil {
		return 0, 0, fmt.Errorf("look up user %s: %w", name, err)
	}
	return uid, gid, nil
}

// LookupGroup implements [Users].
func (OSUsers) LookupGroup(name string) (int, error) {
	g, err := user.LookupGroup(name)
	var unknown user.UnknownGroupError
	if errors.As(err, &unknown) {
		return 0, fmt.Errorf("group %s: %w", name, ErrUnknownUser)
	}
	if err != nil {
		return 0, fmt.Errorf("look up group %s: %w", name, err)
	}
	gid, err := strconv.Atoi(g.Gid)
	if err != nil {
		return 0, fmt.Errorf("look up group %s: %w", name, err)
	}
	return gid, nil
}

// OSMachine reports facts about the real machine.
type OSMachine struct{}

// Euid implements [Machine].
func (OSMachine) Euid() int {
	return os.Geteuid()
}

// Arch implements [Machine].
func (OSMachine) Arch() (string, error) {
	return platform.Machine()
}

// Statfs implements [Machine].
func (OSMachine) Statfs(path string) (Statfs, error) {
	space, err := platform.DiskSpace(path)
	if err != nil {
		return Statfs{}, err
	}
	return Statfs{Free: space.Free, NoExec: space.NoExec}, nil
}

// ProbePort implements [Machine].
func (OSMachine) ProbePort(ctx context.Context, ip string, port int) error {
	var lc net.ListenConfig
	ln, err := lc.Listen(ctx, "tcp", net.JoinHostPort(ip, strconv.Itoa(port)))
	if err != nil {
		return fmt.Errorf("port %d on %s: %w", port, ip, err)
	}
	if err := ln.Close(); err != nil {
		return fmt.Errorf("port %d on %s: %w", port, ip, err)
	}
	return nil
}

// Hostname implements [Machine].
func (OSMachine) Hostname() (string, error) {
	name, err := os.Hostname()
	if err != nil {
		return "", fmt.Errorf("host name: %w", err)
	}
	return name, nil
}

// GlobalAddrs implements [Machine].
func (OSMachine) GlobalAddrs() ([]netip.Addr, error) {
	addrs, err := net.InterfaceAddrs()
	if err != nil {
		return nil, fmt.Errorf("network addresses: %w", err)
	}
	var out []netip.Addr
	for _, a := range addrs {
		ipNet, ok := a.(*net.IPNet)
		if !ok {
			continue
		}
		addr, ok := netip.AddrFromSlice(ipNet.IP)
		if !ok {
			continue
		}
		if addr = addr.Unmap(); addr.IsGlobalUnicast() {
			out = append(out, addr)
		}
	}
	return out, nil
}
