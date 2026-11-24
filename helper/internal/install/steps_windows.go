package install

import "strconv"

// steps returns the installer's steps on Windows (docs/plan/18-third-owner-list-2026-11-23.md
// section 8.3 step 7), numbered in their order: the folders of section 8.2 with their
// permissions, the release folder with the current junction and the system PATH,
// config.toml, the backup of the restore question, the database and the owner, the HTTPS
// method, then the two services (services_windows.go), the start with its health check,
// the entry in Windows' list of installed apps (apps_windows.go,
// docs/plan/19-uninstall-2026-11-24.md section 3), the firewall and the certificate (the
// shared step, which asks the running site through control.json). Windows has no system
// user to make (the service's virtual account NT SERVICE\xdesign comes with its service)
// and no SELinux. The services are made once the files and the data they run with are in
// place.
func (r *run) steps() []Step {
	steps := []Step{
		r.stepPreflight(),
		r.stepDirectories(),
		r.stepProgramFiles(),
		r.stepConfig(),
		r.stepRestore(),
		r.stepMigrations(),
		r.stepOwner(),
		r.stepHTTPSMethod(),
		r.stepServices(),
		r.stepStart(),
		r.stepApps(),
		r.stepFirewall(),
		r.stepCertificate(),
		r.stepFinish(),
	}
	for i := range steps {
		steps[i].Num = strconv.Itoa(i + 1)
	}
	return steps
}
