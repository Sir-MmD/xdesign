package platform

import "os"

// Elevated reports whether this process runs as root, as the commands that need it check
// ("sudo xdesign restore FILE").
func Elevated() bool {
	return os.Geteuid() == 0
}
