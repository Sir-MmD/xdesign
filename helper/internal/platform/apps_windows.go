package platform

import (
	"errors"
	"fmt"

	"golang.org/x/sys/windows/registry"
)

// AppsKey is xDesign's entry in Windows' list of installed apps (Settings > Apps >
// Installed apps, and Control Panel > Programs and Features), under HKEY_LOCAL_MACHINE
// (docs/plan/19-uninstall-2026-11-24.md section 3). AppsEntry names it for the log and
// install.json.
const (
	AppsKey   = `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\xDesign`
	AppsEntry = `HKLM\` + AppsKey
)

// AppValue is one value of the entry: a text (REG_SZ), or a number (REG_DWORD) when
// IsNumber is set.
type AppValue struct {
	Name     string
	Text     string
	Number   uint32
	IsNumber bool
}

// ReadAppsEntry returns the texts and the numbers of the entry by their names; found is
// false when there is no entry. Values of other types are left out.
func ReadAppsEntry() (texts map[string]string, numbers map[string]uint64, found bool, err error) {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, AppsKey, registry.QUERY_VALUE)
	if errors.Is(err, registry.ErrNotExist) {
		return nil, nil, false, nil
	}
	if err != nil {
		return nil, nil, false, fmt.Errorf("read %s: %w", AppsEntry, err)
	}
	defer func() { _ = k.Close() }() // read-only
	names, err := k.ReadValueNames(0)
	if err != nil {
		return nil, nil, true, fmt.Errorf("read %s: %w", AppsEntry, err)
	}
	texts, numbers = map[string]string{}, map[string]uint64{}
	for _, name := range names {
		if s, _, err := k.GetStringValue(name); err == nil {
			texts[name] = s
		} else if n, _, err := k.GetIntegerValue(name); err == nil {
			numbers[name] = n
		}
	}
	return texts, numbers, true, nil
}

// WriteAppsEntry sets the values of the entry, which it creates when it is missing; the
// entry's other values stay.
func WriteAppsEntry(values []AppValue) error {
	k, _, err := registry.CreateKey(registry.LOCAL_MACHINE, AppsKey, registry.QUERY_VALUE|registry.SET_VALUE)
	if err != nil {
		return fmt.Errorf("write %s: %w", AppsEntry, err)
	}
	defer func() { _ = k.Close() }() // the values are written before
	for _, v := range values {
		if v.IsNumber {
			err = k.SetDWordValue(v.Name, v.Number)
		} else {
			err = k.SetStringValue(v.Name, v.Text)
		}
		if err != nil {
			return fmt.Errorf("write %s of %s: %w", v.Name, AppsEntry, err)
		}
	}
	return nil
}

// DeleteAppsEntry deletes the entry; a missing one is no error.
func DeleteAppsEntry() error {
	err := registry.DeleteKey(registry.LOCAL_MACHINE, AppsKey)
	if err != nil && !errors.Is(err, registry.ErrNotExist) {
		return fmt.Errorf("delete %s: %w", AppsEntry, err)
	}
	return nil
}
