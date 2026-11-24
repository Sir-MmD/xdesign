// Package payload carries the payload of a release build, payload-<arch>.tar.zst
// (docs/plan/07-server-install-update.md section 2): runtime/node, the pinned Node.js
// runtime, and app/ (server.mjs, cli.mjs, web/, migrations/, node_modules/ with the native
// modules for the CPU, LICENSES/). The Windows file's payload, payload-windows-<arch>.tar.zst,
// holds runtime/node.exe, Node's official Windows build, and the Windows native modules
// (docs/plan/18-third-owner-list-2026-11-23.md section 10). build.sh copies the payload of
// the system and CPU into this folder as payload.tar.zst (git-ignored) and builds with the tag
// payload, which embeds it (embedded.go); without the tag (make helper, go build) the payload
// is empty (none.go): a development build. `xdesign release-files` unpacks it into a release
// folder after checking it against the SHA-256 the build stamped (buildinfo.PayloadSHA256).
// It uses the standard library and the zstd reader only (depguard rule payload-imports).
package payload
