package platform

// The folders and files of an installed xDesign on Windows, with the same names as on
// Linux (docs/plan/18-third-owner-list-2026-11-23.md section 8.2).
const (
	// ProgramDir holds the releases and the junction to the running one.
	ProgramDir = `C:\Program Files\xDesign`
	// ReleasesDir holds a folder per kept release.
	ReleasesDir = `C:\Program Files\xDesign\releases`
	// CurrentDir is the directory junction to the running release's folder, on the
	// system PATH.
	CurrentDir = `C:\Program Files\xDesign\current`
	// ConfigDir holds config.toml, install.json, the data folder and the folders below.
	ConfigDir = `C:\ProgramData\xDesign`
	// ConfigPath is the configuration file the installer writes; `xdesign serve --config`
	// names another.
	ConfigPath = `C:\ProgramData\xDesign\config.toml`
	// StatePath is install.json, what the installer set up.
	StatePath = `C:\ProgramData\xDesign\install.json`
	// DataDir is the default data folder: the database and the media.
	DataDir = `C:\ProgramData\xDesign\data`
	// RunDir is empty: Windows has no Unix sockets that both Go and Node use, so the app
	// channel uses loopback ports and secrets (section 8.2).
	RunDir = ""
	// ControlFile holds the control server's loopback address and secret while `xdesign
	// serve` runs, for the installer and `xdesign status`: only the service account and
	// Administrators can read it (the folder's permissions).
	ControlFile = `C:\ProgramData\xDesign\control.json`
	// InstallLog is the log of the installer and the other commands that change the
	// installation.
	InstallLog = `C:\ProgramData\xDesign\logs\install.log`
)

// The folders of ConfigDir beside the data folder, which Linux keeps in the data folder
// (section 8.2).
const (
	// CertsDir holds the HTTPS manager's state and certificate files.
	CertsDir = `C:\ProgramData\xDesign\certs`
	// BackupsDir holds the backups.
	BackupsDir = `C:\ProgramData\xDesign\backups`
	// MaintenanceDir holds the maintenance requests and the copy of the new file that the
	// maintenance service runs.
	MaintenanceDir = `C:\ProgramData\xDesign\maintenance`
	// UpdateFailuresDir holds the reports of updates that went back.
	UpdateFailuresDir = `C:\ProgramData\xDesign\update-failures`
	// LogDir holds xdesign.log and install.log.
	LogDir = `C:\ProgramData\xDesign\logs`
	// ServiceLog is the log of the service and the app's output (a new file at 10 MB, 5
	// kept); `xdesign logs` shows it.
	ServiceLog = `C:\ProgramData\xDesign\logs\xdesign.log`
	// MaintenanceRunDir holds the copy of the new file that an update's second stage runs
	// and the maintenance service's copies of uploads, readable by SYSTEM and Administrators
	// only (section 8.6).
	MaintenanceRunDir = `C:\ProgramData\xDesign\maintenance\run`
	// MaintenanceLog is the log of the maintenance service xdesign-maintenance (a new file
	// at 10 MB, 5 kept), as the journal of xdesign-maintenance.service on Linux.
	MaintenanceLog = `C:\ProgramData\xDesign\logs\maintenance.log`
)
