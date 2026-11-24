package platform

import "golang.org/x/sys/windows"

// Elevated reports whether this process runs elevated, in place of root: in a terminal
// opened as Administrator, or as LocalSystem (section 8.7).
func Elevated() bool {
	return windows.GetCurrentProcessToken().IsElevated()
}
