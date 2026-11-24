// Package release reads xDesign releases without installing them
// (docs/plan/07-server-install-update.md sections 2 and 6.3): the single xdesign file,
// whose build information is read without running it, and SHA256SUMS with its SSH
// signature. The update (later internal/cli and internal/maintenance) shares it, so it uses
// only the standard library and internal/buildinfo. Copied from xWriter's internal/release
// without its release folders and archives: an xDesign release is the single file. The
// package internal/unpack opens the zip, tar and compressed files an update may come in
// and finds the file inside; it alone needs the archive libraries.
package release
