package certs

import (
	"errors"
	"fmt"
	"net"
	"net/netip"
)

// ErrNotLoopback reports a plain HTTP listen address that is not a loopback IP.
var ErrNotLoopback = errors.New("development mode serves plain HTTP only on a loopback IP address (127.0.0.1 or ::1)")

// CheckPlainHTTPAddr reports an error unless addr is host:port with a loopback IP
// literal as the host: plain HTTP exists only in development mode, and only where
// nobody on the network can reach it (docs/plan/11-security.md section 4.6). Host
// names, localhost included, are refused, so name resolution can never put the
// unencrypted listener on another address. The error wraps ErrNotLoopback, except
// when addr is not host:port at all.
func CheckPlainHTTPAddr(addr string) error {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return fmt.Errorf("development listen address %q: %w", addr, err)
	}
	ip, err := netip.ParseAddr(host)
	if err != nil || !ip.IsLoopback() {
		return fmt.Errorf("development listen address %q: %w", addr, ErrNotLoopback)
	}
	return nil
}

// IsLoopbackAddr reports whether a is a TCP address on a loopback IP. Callers check a
// listener with it after binding, in case the address resolved to something else.
func IsLoopbackAddr(a net.Addr) bool {
	tcp, ok := a.(*net.TCPAddr)
	return ok && tcp.IP.IsLoopback()
}
