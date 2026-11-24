package platform

import (
	"encoding/binary"
	"fmt"
	"path/filepath"
	"slices"
	"unsafe"

	"golang.org/x/sys/windows"
)

// SystemPID is the process of the Windows kernel, System: a port it listens on belongs to
// HTTP.sys, which serves IIS and the other programs that use it.
const SystemPID = 4

// The tables of GetExtendedTcpTable with the listening sockets and their processes
// (TCP_TABLE_OWNER_PID_LISTENER): a count, then a row per socket.
const (
	tcpTableOwnerPIDListener = 3
	// tcp4Row is MIB_TCPROW_OWNER_PID: state, local address, local port, remote address,
	// remote port, process; tcp6Row is MIB_TCP6ROW_OWNER_PID: local address and scope,
	// local port, remote address and scope, remote port, state, process.
	tcp4Row, tcp4Port, tcp4PID = 24, 8, 20
	tcp6Row, tcp6Port, tcp6PID = 56, 20, 52
	errInsufficientBuffer      = 122
)

// ListeningPIDs returns the processes that listen on each TCP port, on IPv4 and IPv6
// (GetExtendedTcpTable). [SystemPID] stands for HTTP.sys.
func ListeningPIDs() (map[int][]uint32, error) {
	found := map[int][]uint32{}
	for _, t := range []struct {
		family         uint32
		row, port, pid int
	}{
		{windows.AF_INET, tcp4Row, tcp4Port, tcp4PID},
		{windows.AF_INET6, tcp6Row, tcp6Port, tcp6PID},
	} {
		table, err := tcpTable(t.family)
		if err != nil {
			return nil, err
		}
		if len(table) < 4 {
			continue
		}
		n := int(binary.LittleEndian.Uint32(table))
		for i := range n {
			off := 4 + i*t.row
			if off+t.row > len(table) {
				break
			}
			// The port is in network byte order in the first two bytes of its field.
			port := int(table[off+t.port])<<8 | int(table[off+t.port+1])
			pid := binary.LittleEndian.Uint32(table[off+t.pid:])
			if !slices.Contains(found[port], pid) {
				found[port] = append(found[port], pid)
			}
		}
	}
	return found, nil
}

// tcpTable returns the table of listening TCP sockets of the address family with their
// processes, as GetExtendedTcpTable writes it.
func tcpTable(family uint32) ([]byte, error) {
	proc := windows.NewLazySystemDLL("iphlpapi.dll").NewProc("GetExtendedTcpTable")
	if err := proc.Find(); err != nil {
		return nil, fmt.Errorf("the listening ports: %w", err)
	}
	size := uint32(4096)
	for range 5 { // the table may grow between the calls
		buf := make([]byte, size)
		//nolint:gosec // G103: GetExtendedTcpTable fills the buffer at the address and says its size there
		r, _, _ := proc.Call(uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&size)), 0, uintptr(family),
			tcpTableOwnerPIDListener, 0)
		switch r {
		case 0:
			return buf, nil
		case errInsufficientBuffer:
			continue
		}
		return nil, fmt.Errorf("the listening ports: %w", windows.Errno(r))
	}
	return nil, fmt.Errorf("the listening ports: %w", windows.Errno(errInsufficientBuffer))
}

// ProgramName returns the file name of the program process pid runs ("nginx.exe").
func ProgramName(pid uint32) (string, error) {
	h, err := windows.OpenProcess(windows.PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
	if err != nil {
		return "", fmt.Errorf("process %d: %w", pid, err)
	}
	defer func() { _ = windows.CloseHandle(h) }() // a query handle
	n := uint32(windows.MAX_LONG_PATH)
	buf := make([]uint16, n)
	if err := windows.QueryFullProcessImageName(h, 0, &buf[0], &n); err != nil {
		return "", fmt.Errorf("process %d: %w", pid, err)
	}
	return filepath.Base(windows.UTF16ToString(buf[:n])), nil
}
