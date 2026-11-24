package platform

import (
	"errors"
	"fmt"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

// environmentKey holds the system's environment variables, the PATH of every new process
// among them.
const environmentKey = `SYSTEM\CurrentControlSet\Control\Session Manager\Environment`

// OnSystemPath reports whether dir is one of the folders of the system PATH (the
// machine's, not the user's): the same folder, ignoring case, quotes, a final backslash
// and the variables it names.
func OnSystemPath(dir string) (bool, error) {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, environmentKey, registry.QUERY_VALUE)
	if err != nil {
		return false, fmt.Errorf("the system PATH: %w", err)
	}
	defer func() { _ = k.Close() }() // read-only
	value, _, err := k.GetStringValue("Path")
	if errors.Is(err, registry.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("the system PATH: %w", err)
	}
	return pathHas(value, dir), nil
}

// pathHas reports whether the PATH value names dir.
func pathHas(value, dir string) bool {
	want := strings.TrimRight(dir, `\`)
	for entry := range strings.SplitSeq(value, ";") {
		entry = strings.Trim(strings.TrimSpace(entry), `"`)
		if expanded, err := registry.ExpandString(entry); err == nil {
			entry = expanded
		}
		if entry != "" && strings.EqualFold(strings.TrimRight(entry, `\`), want) {
			return true
		}
	}
	return false
}

// AddToSystemPath adds dir at the end of the system PATH, unless it is there already, and
// tells the running programs (WM_SETTINGCHANGE), so a terminal opened afterwards finds
// what dir holds. The value keeps its type (REG_EXPAND_SZ, as Windows writes it).
func AddToSystemPath(dir string) error {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, environmentKey, registry.QUERY_VALUE|registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("the system PATH: %w", err)
	}
	defer func() { _ = k.Close() }() // the value is written before
	value, kind, err := k.GetStringValue("Path")
	switch {
	case errors.Is(err, registry.ErrNotExist):
		value, kind = "", registry.EXPAND_SZ
	case err != nil:
		return fmt.Errorf("the system PATH: %w", err)
	case pathHas(value, dir):
		return nil
	}
	if value != "" && !strings.HasSuffix(value, ";") {
		value += ";"
	}
	value += dir
	if kind == registry.SZ {
		err = k.SetStringValue("Path", value)
	} else {
		err = k.SetExpandStringValue("Path", value)
	}
	if err != nil {
		return fmt.Errorf("the system PATH: %w", err)
	}
	announceEnvironment()
	return nil
}

// RemoveFromSystemPath removes every folder of the system PATH that names dir (as
// OnSystemPath compares them) and tells the running programs, as AddToSystemPath does; a
// PATH without dir is left as it is. The value keeps its type.
func RemoveFromSystemPath(dir string) error {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, environmentKey, registry.QUERY_VALUE|registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("the system PATH: %w", err)
	}
	defer func() { _ = k.Close() }() // the value is written before
	value, kind, err := k.GetStringValue("Path")
	switch {
	case errors.Is(err, registry.ErrNotExist):
		return nil
	case err != nil:
		return fmt.Errorf("the system PATH: %w", err)
	case !pathHas(value, dir):
		return nil
	}
	var kept []string
	for entry := range strings.SplitSeq(value, ";") {
		if !pathHas(entry, dir) {
			kept = append(kept, entry)
		}
	}
	value = strings.Join(kept, ";")
	if kind == registry.SZ {
		err = k.SetStringValue("Path", value)
	} else {
		err = k.SetExpandStringValue("Path", value)
	}
	if err != nil {
		return fmt.Errorf("the system PATH: %w", err)
	}
	announceEnvironment()
	return nil
}

// announceEnvironment tells the programs with windows that the system's environment
// changed, as the System Properties window does, so Explorer starts the next terminal with
// the new PATH. It waits at most 5 seconds for each program; a program that does not
// answer only keeps its old PATH, so nothing is reported.
func announceEnvironment() {
	const (
		hwndBroadcast   = 0xffff
		wmSettingChange = 0x001a
		smtoAbortIfHung = 0x0002
		timeoutMS       = 5000
	)
	area, err := windows.UTF16PtrFromString("Environment")
	if err != nil {
		return
	}
	var result uintptr
	send := windows.NewLazySystemDLL("user32.dll").NewProc("SendMessageTimeoutW")
	//nolint:gosec // G103: SendMessageTimeoutW takes the text's and the result's addresses
	_, _, _ = send.Call(hwndBroadcast, wmSettingChange, 0, uintptr(unsafe.Pointer(area)), smtoAbortIfHung, timeoutMS,
		uintptr(unsafe.Pointer(&result)))
}
