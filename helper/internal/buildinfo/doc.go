// Package buildinfo reports the version, commit and build date of the xdesign file and what
// its payload carries. make helper and the release build stamp them with -ldflags
// (docs/plan/07-server-install-update.md section 2); plain `go build` falls back to the VCS
// data the Go toolchain records. Copied from xWriter's internal/buildinfo and adapted to the
// keys of `xdesign version --json`.
package buildinfo
