// Package controlclient is how the helper's commands reach the control server of `xdesign
// serve` (docs/plan/07-server-install-update.md section 1,
// docs/plan/18-third-owner-list-2026-11-23.md section 8.2): on Linux its Unix socket, which
// only root and the service's user can open; on Windows its loopback address with the secret
// every request must carry, from the file that serve writes when it starts and only the
// service account and Administrators can read. internal/control writes that file with this
// package, and internal/install, which internal/control imports, can use it too.
package controlclient
