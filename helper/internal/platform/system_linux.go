package platform

import (
	"fmt"
	"syscall"
)

// Name is the system's name as the commands and the website say it ("System: Linux").
const Name = "Linux"

// The errors of a port that cannot be opened, for errors.Is.
const (
	// ErrAddrInUse: another program holds the port.
	ErrAddrInUse = syscall.EADDRINUSE
	// ErrAccess and ErrPerm: this process may not open the port.
	ErrAccess = syscall.EACCES
	ErrPerm   = syscall.EPERM
)

// Machine returns the hardware name of the kernel, the output of uname -m ("x86_64",
// "aarch64").
func Machine() (string, error) {
	var u syscall.Utsname
	if err := syscall.Uname(&u); err != nil {
		return "", fmt.Errorf("uname: %w", err)
	}
	return utsString(u.Machine[:]), nil
}

// Version returns the kernel's release, the output of uname -r ("6.12.48+deb13-amd64").
func Version() (string, error) {
	var u syscall.Utsname
	if err := syscall.Uname(&u); err != nil {
		return "", fmt.Errorf("uname: %w", err)
	}
	return utsString(u.Release[:]), nil
}

// utsString is a field of Utsname up to its terminating zero. Its characters are int8 or
// uint8 depending on the architecture.
func utsString[T int8 | uint8](field []T) string {
	b := make([]byte, 0, len(field))
	for _, c := range field {
		if c == 0 {
			break
		}
		b = append(b, byte(c)) // the name is ASCII
	}
	return string(b)
}
