package platform

import (
	"debug/pe"
	"fmt"
	"strings"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

// Name is the system's name as the commands and the website say it ("System: Windows").
const Name = "Windows"

// The errors of a port that cannot be opened, for errors.Is: Windows answers a bind with
// its own socket error numbers.
const (
	// ErrAddrInUse: another program holds the port.
	ErrAddrInUse = windows.WSAEADDRINUSE
	// ErrAccess and ErrPerm: this process may not open the port, or another opened it for
	// itself alone.
	ErrAccess = windows.WSAEACCES
	ErrPerm   = windows.WSAEACCES
)

// Machine returns the processor of the system as Windows names it ("AMD64", "ARM64"),
// not the one of this file: an amd64 file runs on arm64 Windows too, emulated, and
// IsWow64Process2 tells the system's own.
func Machine() (string, error) {
	var process, native uint16
	if err := windows.IsWow64Process2(windows.CurrentProcess(), &process, &native); err != nil {
		return "", fmt.Errorf("the processor's name: %w", err)
	}
	switch native {
	case pe.IMAGE_FILE_MACHINE_AMD64:
		return "AMD64", nil
	case pe.IMAGE_FILE_MACHINE_ARM64:
		return "ARM64", nil
	case pe.IMAGE_FILE_MACHINE_I386:
		return "x86", nil
	}
	return fmt.Sprintf("machine 0x%04x", native), nil
}

// Version returns the version and build of Windows ("10.0.17763"), as RtlGetVersion
// reports them whatever the file's manifest says.
func Version() (string, error) {
	v := windows.RtlGetVersion()
	return fmt.Sprintf("%d.%d.%d", v.MajorVersion, v.MinorVersion, v.BuildNumber), nil
}

// windows11Build is the first build of Windows 11, which the registry still names
// "Windows 10".
const windows11Build = 22000

// Product returns the edition of Windows as the registry names it ("Windows Server 2022
// Datacenter", "Windows 11 Pro").
func Product() (string, error) {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows NT\CurrentVersion`, registry.QUERY_VALUE)
	if err != nil {
		return "", fmt.Errorf("the edition of Windows: %w", err)
	}
	defer func() { _ = k.Close() }() // read-only
	name, _, err := k.GetStringValue("ProductName")
	if err != nil {
		return "", fmt.Errorf("the edition of Windows: %w", err)
	}
	if rest, ok := strings.CutPrefix(name, "Windows 10"); ok && windows.RtlGetVersion().BuildNumber >= windows11Build {
		name = "Windows 11" + rest
	}
	return name, nil
}
