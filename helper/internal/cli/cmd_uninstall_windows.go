package cli

import (
	"flag"
	"fmt"
	"strings"

	"golang.org/x/sys/windows"

	"github.com/Sir-MmD/xdesign/helper/internal/install"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

const uninstallUsage = `Usage: xdesign --uninstall [flags], in a terminal opened as Administrator

Removes xDesign from this Windows server (docs/plan/18-third-owner-list-2026-11-23.md
section 8.7). It asks first: "Keep the data" or "Remove everything", and offers a backup.

Keep the data: the program, its two services, its folder on the system PATH and the
firewall rules the installer made are removed. C:\ProgramData\xDesign (the settings, the
database, the media, the backups, the certificates and the logs) stays, so the installer
picks everything up again later.

Remove everything: C:\ProgramData\xDesign is deleted too, after a final backup in
xdesign-final-<time> in your profile folder when you want one.

Flags:
  --keep-data          keep the data, without the question
  --remove-everything  remove everything, without the question
  --backup             make a backup first, without the question
  --no-backup          make no backup first
  --yes                ask nothing (needs --keep-data or --remove-everything; a backup is
                       made unless --no-backup)
  --json               progress as JSON lines on standard error, one result object on
                       standard output (needs --yes)
  --dry-run            show what would be removed; change nothing
  --no-color           no colors (also NO_COLOR=1)
  --log FILE           log file (default ` + install.DefaultLogPath + `)
`

// uninstallAsAdministrator starts xdesign.exe --uninstall with args again through the
// Administrator prompt when it runs in a window of its own without Administrator: the
// Uninstall button of Windows' list of installed apps, or a double click in Explorer
// (docs/plan/19-uninstall-2026-11-24.md section 3), as the double-clicked installer does
// (RunDoubleClicked). The elevated copy asks its questions in its own window and waits for
// Enter at its end; a refused or cancelled prompt says to use a terminal opened as
// Administrator and waits for Enter. ok is false when the uninstall runs here: in a
// terminal, which refuses it without Administrator as before, or elevated already.
func uninstallAsAdministrator(env *Env, args []string) (code int, ok bool) {
	if !ownConsole() || platform.Elevated() {
		return 0, false
	}
	words := []string{"--uninstall"}
	for _, a := range args {
		words = append(words, windows.EscapeArg(a))
	}
	if err := runAsAdministrator(env, strings.Join(words, " ")); err != nil {
		fmt.Fprintln(env.Stderr, "Run this in a terminal opened as Administrator.")
		holdWindow(env)
		return ExitError, true
	}
	return ExitOK, true
}

// uninstallSystemFlags adds the flags only one system has: none on Windows, which has no
// SELinux.
func uninstallSystemFlags(*flag.FlagSet, *install.UninstallOptions) {}
