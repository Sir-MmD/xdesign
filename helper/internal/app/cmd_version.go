package app

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"

	"github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
)

// cmdVersion prints the build information of this file: one line, or with --json the
// keys of docs/plan/07-server-install-update.md section 2 (version, commit, built_at,
// arch, node_version, payload_sha256, min_upgrade_from, schema_floor), which the release
// build checks and an update reads from a new file.
func cmdVersion(_ context.Context, args []string, stdout, stderr io.Writer) int {
	fs := flag.NewFlagSet("xdesign version", flag.ContinueOnError)
	fs.SetOutput(stderr)
	asJSON := fs.Bool("json", false, "print machine-readable JSON")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return exitOK
		}
		return exitUsage
	}
	if fs.NArg() > 0 {
		fmt.Fprintf(stderr, "xdesign version: unexpected argument %q\n", fs.Arg(0))
		return exitUsage
	}

	info := buildinfo.Get()
	if !*asJSON {
		fmt.Fprintln(stdout, info.String())
		return exitOK
	}
	enc := json.NewEncoder(stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(info); err != nil {
		fmt.Fprintf(stderr, "xdesign version: %v\n", err)
		return exitError
	}
	return exitOK
}
