// Package config reads the helper's configuration file, /etc/xdesign/config.toml
// (docs/plan/07-server-install-update.md section 3), which the installer writes: the
// address and port the front serves HTTPS on, the domain, the data folder and the log
// level. The HTTPS method and certificates are kept by the helper in the data folder;
// website settings live in the app's database.
//
// Load reads the file strictly, as xWriter's internal/config does (go-toml v2 with unknown
// keys refused, so a typo never passes silently), fills in the defaults and checks every
// value, reporting every problem at once with the key it concerns.
package config
