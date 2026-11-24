package platform

import (
	"errors"
	"fmt"

	"golang.org/x/sys/windows/registry"
)

// The registry keys of Windows Defender Firewall's settings: a Group Policy's, which wins
// when it sets a profile, and the local ones that the Windows Security app and netsh write.
const (
	firewallPolicyKey = `SOFTWARE\Policies\Microsoft\WindowsFirewall`
	firewallLocalKey  = `SYSTEM\CurrentControlSet\Services\SharedAccess\Parameters\FirewallPolicy`
)

// FirewallOn returns the profiles of Windows Defender Firewall that are on, by the names
// Windows shows ("Domain", "Private", "Public"), from the registry's EnableFirewall values:
// a Group Policy's value wins over the local one, and a profile with neither is on, as
// Windows starts it. The registry's numbers read the same in every language of Windows,
// where netsh's and PowerShell's words do not.
func FirewallOn() ([]string, error) {
	profiles := []struct{ key, name string }{
		{"DomainProfile", "Domain"}, {"StandardProfile", "Private"}, {"PublicProfile", "Public"},
	}
	var on []string
	for _, p := range profiles {
		enabled, err := firewallSetting(firewallPolicyKey + `\` + p.key)
		if err != nil {
			return nil, err
		}
		if enabled < 0 {
			if enabled, err = firewallSetting(firewallLocalKey + `\` + p.key); err != nil {
				return nil, err
			}
		}
		if enabled != 0 {
			on = append(on, p.name)
		}
	}
	return on, nil
}

// firewallSetting reads EnableFirewall under the key: 1 (on) or 0 (off), -1 when the key
// or the value is missing.
func firewallSetting(key string) (int, error) {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, key, registry.QUERY_VALUE)
	if errors.Is(err, registry.ErrNotExist) {
		return -1, nil
	}
	if err != nil {
		return 0, fmt.Errorf("the settings of Windows Defender Firewall (HKLM\\%s): %w", key, err)
	}
	defer func() { _ = k.Close() }() // read-only
	value, _, err := k.GetIntegerValue("EnableFirewall")
	switch {
	case errors.Is(err, registry.ErrNotExist):
		return -1, nil
	case err != nil:
		return 0, fmt.Errorf("the settings of Windows Defender Firewall (HKLM\\%s): %w", key, err)
	case value != 0:
		return 1, nil
	}
	return 0, nil
}
