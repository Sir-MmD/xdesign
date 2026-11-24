package app

// The words of the usage that name Windows things (app.go), in a terminal opened as
// Administrator in place of sudo (docs/plan/18-third-owner-list-2026-11-23.md section 8.7),
// with the names of usage_linux.go.
const (
	// installLine and uninstallLine follow the usage's first line.
	installLine   = `       .\xdesign.exe ` + installFlag + " [flags]    install, continue, repair or update xDesign on this server\n"
	uninstallLine = "       xdesign " + uninstallFlag + " [flags]        remove xDesign, keeping its data or removing everything\n"
	// logsSummary is the summary of xdesign logs.
	logsSummary = "the last lines of the service's log ([-f] [--lines N])"
)
