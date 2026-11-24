package cli

const updateUsage = `Usage: xdesign update FILE [flags]

Updates xDesign from the new xdesign file FILE (xdesign-<version>-windows-<cpu>.exe), or
from the .zip, tar.gz, tar.xz or tar.zst file that holds it
(docs/plan/18-third-owner-list-2026-11-23.md section 8.6). Run it in a terminal opened as
Administrator. It checks the file first: SHA256SUMS next to it (or inside the packed file)
or --sha256, the signature of SHA256SUMS.sig, its build information, the system, the
versions, the CPU and the free space. Then the new file, copied to
C:\ProgramData\xDesign\maintenance\run, backs the site up, writes the new release folder,
stops the service xdesign, runs the new migrations, points C:\Program Files\xDesign\current
at the new release and starts the service with a health check of up to two minutes. When a
step fails after xDesign stopped, it goes back to the release before by itself. The last 3
releases are kept for xdesign rollback.

Flags:
  --dry-run        check the file and print the plan, change nothing
  --sha256 SUM     the SHA-256 of the file (or of the packed file), when there is no
                   SHA256SUMS next to it
  --yes            ask nothing
  --json           progress as JSON lines on standard error, one result object on
                   standard output (needs --yes)
  --no-color       no colors (also NO_COLOR=1)
  --log FILE       log file (default C:\ProgramData\xDesign\logs\install.log)
`

const rollbackUsage = `Usage: xdesign rollback [--to VERSION] [--restore-db] [flags]

Goes back to a release this server keeps (docs/plan/18-third-owner-list-2026-11-23.md
section 8.6): the release before the running one, or VERSION. Run it in a terminal opened
as Administrator. It stops the service xdesign, points C:\Program Files\xDesign\current
back at that release and starts the service with a health check. When the running release
changed the database in a way the older one cannot read, it needs --restore-db, which puts
back the database and the media of the backup made before the update from that release
(after a backup of the site as it is now).

Flags:
  --to VERSION     the release to go back to (default: the one before)
  --restore-db     also put back the data from before the update
  --yes            ask nothing
  --json           progress as JSON lines on standard error, one result object on
                   standard output (needs --yes)
  --no-color       no colors (also NO_COLOR=1)
  --log FILE       log file (default C:\ProgramData\xDesign\logs\install.log)
`
