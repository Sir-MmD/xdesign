package install

import "github.com/Sir-MmD/xdesign/helper/internal/host"

// refreshAppsEntry does nothing on Linux, which has no list of installed apps to keep
// current (apps_windows.go).
func refreshAppsEntry(*Env, host.FS, string) {}
