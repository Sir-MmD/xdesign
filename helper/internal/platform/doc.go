// Package platform is what differs between the systems xDesign runs on, Linux and Windows
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.8): the folders of an installed
// xDesign, the free disk space, file locks, links, file owners, the child process's start
// and stop, the socket errors, the system's name and version, and whether the process runs
// as root or Administrator. Each part has a file per system (_linux.go, _windows.go) with
// the same names; the rest of the helper calls these instead of the system calls.
//
// Nothing here has run on Windows yet: the hand tests on Windows machines are its first
// run.
package platform
