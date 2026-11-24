package config

// fileHeader starts the config file the installer writes.
const fileHeader = "# xDesign's settings, written by the installer (sudo ./xdesign --install).\n" +
	"# xdesign serve reads them at its start: systemctl restart xdesign after a change.\n"
