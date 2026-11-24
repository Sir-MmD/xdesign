// Package deploy holds the files the xdesign file installs on the server
// (docs/plan/07-server-install-update.md sections 1 and 3): the systemd units and the
// sysusers file. The file carries them, so the installer writes them out of itself. Copied
// from xWriter's deploy/embed.go and cut to these files: xdesign.service and the daily
// backup's xdesign-backup.service and .timer (section 5.1), and the root helper's
// xdesign-maintenance.path and .service (section 6).
package deploy

import (
	"embed"
	"fmt"
	"io/fs"
)

// files are the installed files by their path in this folder. Every file of deploy/
// except this Go source belongs here.
//
//go:embed sysusers systemd
var files embed.FS

// Files returns the installed files with their paths in this folder, for example
// systemd/xdesign.service.
func Files() fs.FS {
	return files
}

// Unit returns the systemd unit name (xdesign.service).
func Unit(name string) ([]byte, error) {
	return read("systemd/" + name)
}

// Sysusers returns the sysusers.d file that defines the xdesign system user.
func Sysusers() ([]byte, error) {
	return read("sysusers/xdesign.conf")
}

func read(name string) ([]byte, error) {
	data, err := files.ReadFile(name)
	if err != nil {
		return nil, fmt.Errorf("the embedded %s: %w", name, err)
	}
	return data, nil
}
