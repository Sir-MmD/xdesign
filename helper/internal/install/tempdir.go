package install

import "github.com/Sir-MmD/xdesign/helper/internal/host"

// The private folders of the update and the root helper: MakePrivateDir and MakeExecDir are
// in tempdir_linux.go and tempdir_windows.go.

// scratchPrefix starts the name of the scratch folder that MakeExecDir makes under
// /opt/xdesign/releases. It starts with stagingPrefix, so the staging folders an
// interrupted run left there are removed with it (removeStaging).
const scratchPrefix = stagingPrefix + "scratch-"

// SelfOwner is the owner of the files the installer writes for itself: root:root as
// root; otherwise (a dry run by another user) -1:-1, so the files keep the user of
// the process.
func SelfOwner(m host.Machine) host.Owner {
	if m.Euid() == 0 {
		return host.Root()
	}
	return host.Owner{UID: -1, GID: -1}
}
