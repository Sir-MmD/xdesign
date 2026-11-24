package buildinfo

import (
	"cmp"
	"fmt"
	"runtime"
	"runtime/debug"
	"strings"
)

// Package is the import path of this package, which -ldflags names, for example
// -X github.com/Sir-MmD/xdesign/helper/internal/buildinfo.Version=1.2.0.
const Package = "github.com/Sir-MmD/xdesign/helper/internal/buildinfo"

// Values stamped by the linker. They are never assigned in code. [StampNames] lists their
// names, which internal/release reads from another file's symbol table.
//
//nolint:gochecknoglobals // the linker can only stamp package-level string variables
var (
	// Version is the semantic version: "X.Y.Z" for releases, "0.0.0-dev+<short commit>"
	// for development builds. It is a label only: no git tag is needed.
	Version string
	// Commit is the full git commit hash.
	Commit string
	// BuiltAt is the commit time in RFC 3339 UTC; release builds use it as the build
	// date so the same commit always produces identical files.
	BuiltAt string
	// Arch is the CPU architecture the file was built for: amd64 or arm64.
	Arch string
	// NodeVersion is the version of the pinned Node.js runtime in the payload ("v26.13.1");
	// empty for a build without a payload.
	NodeVersion string
	// PayloadSHA256 is the SHA-256 of the embedded payload (payload-<arch>.tar.zst); empty
	// for a build without a payload.
	PayloadSHA256 string
	// MinUpgradeFrom is the oldest installed version this file updates from directly.
	MinUpgradeFrom string
	// SchemaFloor is the oldest release that runs on the database schema this file's
	// migrations create.
	SchemaFloor string
)

// StampNames returns the names of the stamped variables, in the order of the keys of
// `xdesign version --json`.
func StampNames() []string {
	return []string{"Version", "Commit", "BuiltAt", "Arch", "NodeVersion", "PayloadSHA256", "MinUpgradeFrom", "SchemaFloor"}
}

// unknown stands for a commit or build date that a build does not know.
const unknown = "unknown"

// zeroVersion is min_upgrade_from and schema_floor when there is no limit.
const zeroVersion = "0.0.0"

// devVersion is reported when the binary was built without -ldflags stamping.
const devVersion = "0.0.0-dev"

// ReleaseFileName is the metadata file at the top of xWriter's release archives (beside
// internal/release.ManifestName). An xDesign release is the single file, never such an
// archive; internal/unpack, copied from xWriter as it is, still tells that layout apart.
const ReleaseFileName = "VERSION"

// Info describes a build. Its JSON form is the output of `xdesign version --json`
// (docs/plan/07-server-install-update.md section 2).
type Info struct {
	Version  string `json:"version"`
	Commit   string `json:"commit"`
	BuiltAt  string `json:"built_at"`
	Modified bool   `json:"modified"`
	Arch     string `json:"arch"`
	// NodeVersion and PayloadSHA256 describe the embedded payload, both empty for a build
	// without one.
	NodeVersion    string `json:"node_version"`
	PayloadSHA256  string `json:"payload_sha256"`
	MinUpgradeFrom string `json:"min_upgrade_from"`
	SchemaFloor    string `json:"schema_floor"`
	Go             string `json:"go"`
	OS             string `json:"os"`
}

// Get returns the build information of the running binary, preferring stamped values and
// falling back to the VCS settings recorded by the Go toolchain.
func Get() Info {
	info := FromStamps(map[string]string{
		"Version": Version, "Commit": Commit, "BuiltAt": BuiltAt, "Arch": Arch,
		"NodeVersion": NodeVersion, "PayloadSHA256": PayloadSHA256,
		"MinUpgradeFrom": MinUpgradeFrom, "SchemaFloor": SchemaFloor,
	}, runtime.Version(), runtime.GOOS, runtime.GOARCH)
	if bi, ok := debug.ReadBuildInfo(); ok {
		info = WithVCS(info, bi.Settings)
	}
	return info
}

// FromStamps returns the build information of a binary from its stamped values (by the
// names of [StampNames]) and the Go toolchain, system and CPU it was built with. What the
// build did not stamp is filled in: the version 0.0.0-dev, the arch from goarch, and
// 0.0.0 (no limit) for min_upgrade_from and schema_floor.
func FromStamps(stamps map[string]string, goVersion, goos, goarch string) Info {
	return Info{
		Version:        cmp.Or(stamps["Version"], devVersion),
		Commit:         stamps["Commit"],
		BuiltAt:        stamps["BuiltAt"],
		Arch:           cmp.Or(stamps["Arch"], goarch),
		NodeVersion:    stamps["NodeVersion"],
		PayloadSHA256:  stamps["PayloadSHA256"],
		MinUpgradeFrom: cmp.Or(stamps["MinUpgradeFrom"], zeroVersion),
		SchemaFloor:    cmp.Or(stamps["SchemaFloor"], zeroVersion),
		Go:             goVersion,
		OS:             goos,
	}
}

// WithVCS fills an empty commit and build date from the vcs.* build settings, and the
// modified flag.
func WithVCS(info Info, settings []debug.BuildSetting) Info {
	for _, s := range settings {
		switch s.Key {
		case "vcs.revision":
			if info.Commit == "" {
				info.Commit = s.Value
			}
		case "vcs.time":
			if info.BuiltAt == "" {
				info.BuiltAt = s.Value
			}
		case "vcs.modified":
			info.Modified = s.Value == "true"
		}
	}
	return info
}

// String formats the information for humans, on one line.
func (i Info) String() string {
	commit := i.Commit
	if len(commit) > 12 {
		commit = commit[:12]
	}
	if commit == "" {
		commit = unknown
	}
	if i.Modified {
		commit += " (modified)"
	}
	parts := []string{"commit " + commit, "built " + cmp.Or(i.BuiltAt, unknown)}
	if i.NodeVersion != "" {
		parts = append(parts, "Node.js "+i.NodeVersion)
	}
	parts = append(parts, fmt.Sprintf("%s %s/%s", i.Go, i.OS, i.Arch))
	return fmt.Sprintf("xdesign %s (%s)", i.Version, strings.Join(parts, ", "))
}
