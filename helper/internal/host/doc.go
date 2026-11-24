// Package host is the operating system as the admin CLI and the installer see it:
// commands, files, users and facts about the machine (docs/plan/12-deployment.md
// sections 4 and 6). Every system interaction of internal/cli goes through the
// interfaces bundled in [System], so the installer's steps are unit-tested against
// the simulated Debian and Fedora systems of internal/testutil/fakehost instead of a
// real server. [OS] returns the real implementations.
//
// Paths are absolute. Commands never go through a shell: [Cmd.String] only formats
// them in shell form for logs and dry runs.
//
// Copied from xWriter's internal/cli/host as it is (docs/plan/07-server-install-update.md
// section 10); the other docs/plan references in this package are xWriter's plan.
package host
