package platform

// The folders and files of an installed xDesign on Linux (docs/plan/07-server-install-update.md
// sections 1 and 3).
const (
	// ProgramDir holds the releases and the link to the running one.
	ProgramDir = "/opt/xdesign"
	// ReleasesDir holds a folder per kept release.
	ReleasesDir = "/opt/xdesign/releases"
	// CurrentDir is the symbolic link to the running release's folder.
	CurrentDir = "/opt/xdesign/current"
	// ConfigDir holds config.toml and install.json.
	ConfigDir = "/etc/xdesign"
	// ConfigPath is the configuration file the installer writes; `xdesign serve --config`
	// names another.
	ConfigPath = "/etc/xdesign/config.toml"
	// StatePath is install.json, what the installer set up.
	StatePath = "/etc/xdesign/install.json"
	// DataDir is the default data folder: the database, the media, the backups, the
	// certificates, the maintenance requests and the update failures.
	DataDir = "/var/lib/xdesign"
	// RunDir holds the Unix sockets of the app and the control server; systemd creates it
	// (RuntimeDirectory).
	RunDir = "/run/xdesign"
	// InstallLog is the log of the installer and the other commands that change the
	// installation.
	InstallLog = "/var/log/xdesign-install.log"
)
