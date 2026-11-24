package cli

import (
	"context"
	"errors"
	"flag"
	"fmt"
)

// How `xdesign logs` shows the service's log differs between Linux and Windows:
// cmd_logs_linux.go (the journal has it) and cmd_logs_windows.go (the log files).

// defaultLogLines is how many of the last lines `xdesign logs` shows without --lines.
const defaultLogLines = 100

// RunLogs is `xdesign logs [-f] [--lines N]` (section 8.2).
func RunLogs(ctx context.Context, env *Env, args []string) int {
	fs := flag.NewFlagSet("xdesign logs", flag.ContinueOnError)
	fs.SetOutput(env.Stderr)
	fs.Usage = func() { fmt.Fprint(env.Stderr, logsUsage) }
	follow := fs.Bool("f", false, "")
	lines := fs.Int("lines", defaultLogLines, "")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return ExitOK
		}
		return ExitUsage
	}
	if fs.NArg() > 0 {
		fmt.Fprintf(env.Stderr, "xdesign logs: unexpected argument %q\n", fs.Arg(0))
		return ExitUsage
	}
	if *lines < 0 {
		fmt.Fprintln(env.Stderr, "xdesign logs: --lines takes 0 or more")
		return ExitUsage
	}
	return showLogs(ctx, env, *follow, *lines)
}
