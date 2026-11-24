package cli

import (
	"context"
	"fmt"
)

const logsUsage = `Usage: xdesign logs [-f] [--lines N]

Shows the last lines of the xdesign service's log
(docs/plan/18-third-owner-list-2026-11-23.md section 8.2): on Windows the lines of the
service and of the website in C:\ProgramData\xDesign\logs\xdesign.log, each with its
time; a new file starts at 10 MB, and the 5 before it are kept (xdesign.log.1 to .5). Run
it in a terminal opened as Administrator. On Linux the journal keeps them: journalctl -u
xdesign.

Flags:
  -f           go on showing the new lines as they come, after a new file too (Ctrl-C ends it)
  --lines N    how many of the last lines to show (default 100)
`

// showLogs says where the service's lines are on Linux: the journal keeps them
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.2).
func showLogs(_ context.Context, env *Env, _ bool, _ int) int {
	fmt.Fprintln(env.Stdout, "Use journalctl -u xdesign (add -f to follow).")
	return ExitOK
}
