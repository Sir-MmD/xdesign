package install

// steps returns the installer's steps in the order of docs/plan/07-server-install-update.md
// section 3 step 7: the system user, the release folder and its links, the settings, the
// units, the backup of the restore question, the database and the owner, the SELinux
// label of the site's port and the HTTPS method, the start with its health check, then
// what faces the internet: the firewall, and the Let's Encrypt certificate it lets in
// (docs/plan/17-second-owner-list-2026-11-23.md section 5).
//
// To add a step, write a method that returns a [Step] (Check, Act, Verify; system
// changes only through Env.Run and Env.Do so dry runs print them), put it here in its
// place, give it its weight in weights.go and its section in output.go.
func (r *run) steps() []Step {
	return []Step{
		r.stepPreflight(),      // 1
		r.stepSystemUser(),     // 2
		r.stepDirectories(),    // 3
		r.stepProgramFiles(),   // 4
		r.stepSELinux(),        // 5
		r.stepConfig(),         // 6
		r.stepUnits(),          // 7
		r.stepEnable(),         // 8
		r.stepRestore(),        // 9
		r.stepMigrations(),     // 10
		r.stepOwner(),          // 11
		r.stepSELinuxNetwork(), // 12
		r.stepHTTPSMethod(),    // 13
		r.stepStart(),          // 14
		r.stepFirewall(),       // 15
		r.stepCertificate(),    // 16
		r.stepFinish(),         // 17
	}
}
