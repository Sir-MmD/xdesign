package app

// The words of the usage that name Linux things (app.go); usage_windows.go has the Windows
// forms (docs/plan/18-third-owner-list-2026-11-23.md section 8.7).
const (
	// installLine and uninstallLine follow the usage's first line.
	installLine   = "       sudo ./xdesign " + installFlag + " [flags]    install, continue, repair or update xDesign on this server\n"
	uninstallLine = "       sudo xdesign " + uninstallFlag + " [flags]    remove xDesign, keeping its data or removing everything\n"
	// logsSummary is the summary of xdesign logs.
	logsSummary = "the last lines of the service's log on Windows ([-f] [--lines N]); on Linux journalctl -u xdesign"
)
