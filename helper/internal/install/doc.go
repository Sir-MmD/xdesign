// Package install is the step engine behind the installer, and later the updater,
// restore and uninstall commands, and the installer built on it
// (docs/plan/07-server-install-update.md sections 1 and 3). Copied from xWriter's
// internal/cli/install by file (engine, steps, progress, output, report, pacman, log,
// tempdir, preflight, questions, options, system, files, release, releases, service,
// installer, state, with distro and weights) and cut to what xDesign installs: no
// database server, packages, browsers, proxies or keys. The update (update.go and
// update_stage2.go, [Updater]), the rollback (rollback.go), the kept releases (goback.go)
// and the maintenance units (maintenance.go) follow section 6; the uninstall (uninstall.go)
// and the domain change of Settings > HTTPS (domain.go) follow sections 7 and 4; the
// restore (restore.go) is the
// installer's restore question and step, the backup units, and [Service], the systemd
// service that backup.Restore stops, migrates and starts. Its comments that name a section
// without a file mean 07's.
//
// # The engine
//
// A [Step] has three parts: Check (is it already done? then it is skipped), Act (do
// it) and Verify (did it work?). [Engine.Run] runs a list of steps in order and stops
// at the first failure with a [*StepError] that names the step and its last command.
// Because done steps are skipped, a list can always run again: after a failure the
// owner fixes the problem and reruns, and a finished installation reruns as a
// repair.
//
// Steps read the system through [Env].Sys and change it only through [Env.Run]
// (commands) and [Env.Do] (operations in Go with a shell-form description). In a dry
// run both record what they would do instead, so `--dry-run` prints the exact
// commands, and the same description goes to the install log in real runs. Commands
// and their output are logged to /var/log/xdesign-install.log with every secret the
// [Masker] knows replaced; commands marked SecretStdin or SecretOutput never show
// their input or output.
//
// A [Reporter] shows progress: [PacmanReporter] prints the installer in pacman's
// style (pacman.go: ":: Section..." lines, " -> label  value" facts, "warning:" and
// "error:"), [TextReporter] prints one line per step with a status mark ("[ ok ]",
// "[skip]", "[warn]", "[plan]", "[FAIL]") for the commands that come later, and
// [JSONReporter] prints JSON lines for --json. newReporter (report.go) builds the
// reporter of every command, with the plan that gives it its percent.
//
// # Progress
//
// Every bar of a run shows one number, the percent of the whole run (progress.go). A
// [Plan] lists the steps of the run with their weights (weights.go). A step that knows
// how far it is calls [Env.Report] with a [ProgressEvent], which passes on at most four
// readings a second and none that repeats the last; a step that waits says what it waits
// for and for how long (Env.waiting). A reporter that implements [ProgressReporter] turns
// the reading and the plan into the percent that never goes down and stays at 99 until
// the last step ends.
//
// # The installer
//
// [Installer.Run] is `sudo ./xdesign --install`: preflight (root, systemd 252 or newer,
// Ubuntu 24.04 or 26.04, Debian 12 or 13, Fedora 43 or newer, amd64 or arm64, 1 GB free,
// the clock, what is installed), the questions of section 3 or the --yes flags, then the
// steps of steps.go in order, the end of section 3 step 8 or the --json result, and
// install.json ([State]) recording what xDesign created. The mode (fresh, resume,
// repair, existing data, update, newer) comes from install.json and the files of an
// earlier installation: the same version repairs, an older one is updated as
// `sudo xdesign update FILE` does (the installer hands the run to [Updater] after its
// preflight), and a newer one is refused. The flow follows xmtp-panel's
// installer: the app's migrations and owner (`node app/cli.mjs migrate` and `init-owner`
// as the xdesign user, whose printed password the end shows once), the start, and the
// wait until the website answers /api/health.
//
// Every system interaction goes through internal/host.
package install
