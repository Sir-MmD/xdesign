package certs

import "io/fs"

// The Windows parts of the checks of a certificate's files (load.go), with the names of
// load_linux.go (docs/plan/18-third-owner-list-2026-11-23.md section 8.7).

// ExampleDir is the folder of the example paths in the messages.
const ExampleDir = `C:\Certificates\design.example.com\`

// serviceAccount names who must be able to read the files: the account serve runs as.
const serviceAccount = `NT SERVICE\xdesign`

// checkMode finds nothing on Windows: a file's mode there tells only whether it is
// read-only, never who may read it, so rule 3 of Load does not apply.
func checkMode(string, File, fs.FileMode) (code, msg string) {
	return "", ""
}

// underHome reports false: Windows hides no folder from the service as ProtectHome does.
func underHome(string) bool {
	return false
}
