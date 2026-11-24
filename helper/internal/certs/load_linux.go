package certs

import (
	"fmt"
	"io/fs"
	"path/filepath"
	"strings"
)

// The Linux parts of the checks of a certificate's files (load.go); load_windows.go has the
// Windows forms (docs/plan/18-third-owner-list-2026-11-23.md section 8.7).

// ExampleDir is the folder of the example paths in the messages: where certbot keeps a
// domain's certificate and key.
const ExampleDir = "/etc/letsencrypt/live/design.example.com/"

// serviceAccount names who must be able to read the files: the user serve runs as.
const serviceAccount = "the xdesign user"

// checkMode applies rule 3 of Load: it returns a code and a message when the
// permissions are unsafe, and an empty code otherwise.
func checkMode(path string, which File, mode fs.FileMode) (code, msg string) {
	perm := mode.Perm()
	switch which {
	case FileKey:
		if perm&0o006 != 0 {
			return CodeKeyPermissions, fmt.Sprintf("The key file %s can be read or changed by every user on the server. Run: chmod o-rwx %s",
				path, path)
		}
	case FileCert:
		if perm&0o002 != 0 {
			return CodeCertPermissions, fmt.Sprintf("The certificate file %s can be changed by every user on the server. Run: chmod o-w %s",
				path, path)
		}
	}
	return "", ""
}

// underHome reports whether path is in a folder hidden from the service.
func underHome(path string) bool {
	p := filepath.Clean(path)
	for _, dir := range []string{"/home", "/root", "/run/user"} {
		if p == dir || strings.HasPrefix(p, dir+"/") {
			return true
		}
	}
	return false
}
