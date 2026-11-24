# 07. Server, the Go helper, install, HTTPS, backups and updates

xDesign installs and updates **the same way as xWriter and xmtp-panel** (Q-25, D-21) and ships
as **one self-installing file like xWriter** (Q-29, D-29): a Go program, the **helper**, copied
from xWriter and xmtp-panel, that does setup, updates, going back, backups, the maintenance
helper and HTTPS, and runs the TypeScript website inside it. There is no online release channel
and no version check: a release file built on the owner's desktop is copied to the server,
`sudo ./xdesign --install`; updates by `xdesign update FILE` or by uploading the file in
Maintenance; checks, a backup first, the `current` symlink switch, a health check, going back by
itself on failure, the last 3 releases kept.

References: xWriter `docs/plan/12-deployment.md` (3.5, 4.4, the update and rollback chapters),
`docs/plan/18-install-ssl-update.md`, `docs/user-guide.md` (install, SSL, update); xmtp-panel
`README.md` (install, updates). What is copied from which file is section 10.

## 1. Runtime

```
 internet --> :<site port> (and :80 for Let's Encrypt checks)
              xdesign serve (Go, user xdesign)                 node app (child, user xdesign)
              +------------------------------+  unix socket   +---------------------------+
              | HTTPS front: certificates,   | -------------> | Fastify /api, Hocuspocus  |
              | SSL manager, port-80 answers |  /run/xdesign/ | /live, /mcp, the SPA      |
              | reverse proxy (WebSockets)   |   app.sock     |                           |
              | starts and watches the child | <------------- | calls the helper for      |
              | control socket: HTTPS,       |  control.sock  | HTTPS, backups, updates   |
              | backups, updates, status     |                |                           |
              +------------------------------+                +---------------------------+
              maintenance/request.json --> xdesign-maintenance.path --> xdesign admin maintenance (root)
```

- One systemd service `xdesign.service` runs `/opt/xdesign/current/xdesign serve` as the system user
  `xdesign` (no login shell), hardened like xWriter's `xwriter-web.service` (`Type=exec`, as serve
  sends no READY; without `MemoryDenyWriteExecute`, which Node.js cannot run under)
  (`ProtectSystem=strict`, `ReadWritePaths=/var/lib/xdesign`, `RuntimeDirectory=xdesign`,
  `PrivateTmp`, `NoNewPrivileges`; `AmbientCapabilities=CAP_NET_BIND_SERVICE` only when the site's
  port is below 1024 or xDesign answers Let's Encrypt on port 80).
- `serve` starts the Node app (`runtime/node app/server.mjs`) as its child with the socket paths
  and the data folder in its environment, restarts it with backoff when it stops, passes its
  logs to the journal, and stops it cleanly on shutdown (D-30).
- The front proxies every request under the web base path to the app's Unix socket, unchanged
  (`httputil.ReverseProxy` with a Unix dialer; WebSocket upgrades for `<base path>live` and
  `<base path>mcp` pass through), sets `X-Forwarded-For` and `X-Forwarded-Proto`, and answers
  "xDesign is starting..." (503 with retry) while the child starts or restarts. The base path
  without its last slash gets a 308 to the base path; the two OAuth metadata addresses with the
  path after the well-known name, exactly `/.well-known/oauth-protected-resource/<path>/mcp` and
  `/.well-known/oauth-authorization-server/<path>` (17 section 13.5, D-660), are proxied to the app
  unchanged too; every other request gets the empty page of 16 section 4 from the front itself,
  without `X-Xdesign-Front` (D-611, D-613).
- The proxied answers carry `X-Xdesign-Front: <version>`; the empty page and the 308 carry no
  header that names xDesign.
- The **control socket** `/run/xdesign/control.sock` (mode 0600, user `xdesign`) is how the
  website asks the helper for HTTPS settings, backups, update uploads and checks, maintenance
  requests and status. The website checks the person (site owner, "Confirm it's you" with the
  password) before it calls; the helper trusts only its own socket (D-33).
- The app reaches it on `XD_CONTROL_SOCKET` and answers `no_helper` (503, "The server helper is not
  running (development).") without it; its routes keep the helper's plain words and give its answers
  camelCase names and times in milliseconds. On Windows it reaches it at `XD_CONTROL_URL`
  (127.0.0.1) with `Authorization: Bearer <XD_CONTROL_SECRET>` (18 section 8.2).
- The root helper for updates and restores: `xdesign-maintenance.path` watching
  `/var/lib/xdesign/maintenance/request.json`, starting the oneshot `xdesign-maintenance.service`
  (root, `UMask=0077`, `TimeoutStartSec=12h`), which runs `xdesign admin maintenance --request`;
  the same units as xWriter's, renamed, without PostgreSQL.
- Supported: Ubuntu 24.04 and 26.04, Debian 12 and 13, Fedora 43 and later (Q-24), on amd64
  and arm64, with systemd 252 or later. The installer refuses other systems with a plain
  message and the list.

## 2. Release build

- `./build.sh` on the desktop (copied from xmtp-panel's `build.sh` with the checks of xWriter's
  `tools/release/release.sh`, D-31): the pacman-style menu asks the version (for example
  `1.0.0`) and the CPUs ("amd64", "arm64", "both"), shows each step with progress, and writes
  to `dist/`:
  - `xdesign-<version>-linux-<arch>`: the single self-installing file;
  - `xdesign-<version>-linux-<arch>.tar.gz`: the same file in a reproducible tar (mode 0755),
    as xWriter ships it;
  - `SHA256SUMS` covering every file; `SHA256SUMS.sig` when a signing key is set up (the SSH
    signature check copied from xWriter, dormant until then);
  - `release-notes-<version>.md` from `docs/release-notes-template.md` ("What changed", "What
    you must do", "Going back").
- The steps: build the website (`pnpm` web build and server bundle), fetch the pinned Node.js
  runtime for each CPU from nodejs.org and check it against its pinned SHA-256 (cached in
  `.dev/cache/`), take the prebuilt native modules for the CPU, pack the **payload**
  (`payload-<arch>.tar.zst`: `runtime/node`, `app/`), and build the Go helper per CPU with the
  payload embedded (`CGO_ENABLED=0`, `-trimpath`, version keys stamped), then prove the result
  by running `xdesign version --json` on the build machine's CPU.
- The payload inside the helper:

```
runtime/node       the pinned Node.js binary (official build)
app/server.mjs     the server bundle (esbuild), app/cli.mjs the app's own commands
app/web/           the built SPA
app/migrations/    Drizzle migrations
app/node_modules/  only the native modules (better-sqlite3, @node-rs/argon2) for the CPU
app/LICENSES/      third-party notices
```

- The payload also ships `app/LICENSES/THIRD-PARTY.txt` (every production package with its license)
  and Node.js's license in `app/LICENSES/node.js/`. The Node.js version and its SHA-256 per CPU are
  pinned in `tools/release/node.env`; `min_upgrade_from` and the schema floor are kept by hand in
  `tools/release/compat.env`. `SHA256SUMS` lists the single files and their tar.gz, not the release
  notes, which the owner fills in after the build.
- `version --json` reports: version, commit, built_at, arch, node version, payload SHA-256,
  `min_upgrade_from`, the schema floor.
- The keys are stamped with `-ldflags -X` into `internal/buildinfo` (`Version`, `Commit`, `BuiltAt`,
  `Arch`, `NodeVersion`, `PayloadSHA256`, `MinUpgradeFrom`, `SchemaFloor`); builds drop only the
  DWARF data (`-w`), because an update reads the new file's keys from its symbol table without
  running it.
- `xdesign release-files <dir>` (not in the help) writes the release folder: `<dir>/xdesign` and the
  payload unpacked into `<dir>/runtime/` and `<dir>/app/`, after checking the payload against its
  stamped SHA-256; the install and the update use it, and the release build runs it as its last
  check. The release build also stamps the version into the server bundle, so `/api/health` reports
  it.
- Dev builds are `0.0.0-dev+<commit>`. The version is a label only (no git tag needed). `make
  release` refuses a dirty tree unless `ALLOW_DIRTY=1`.
- The desktop app's files are made by electron-builder from the same `app/` and Node's official
  build for each system and CPU (18 sections 9.7 and 10); the macOS app is signed ad hoc with
  rcodesign and zipped.
- The Windows server's file and its zip are made the same way (18 section 10): Node's Windows build,
  the Windows native modules, `GOOS=windows`, and a zip in place of the tar.gz.

## 3. Install

The owner copies the file to the server, checks it (`sha256sum --check --ignore-missing
SHA256SUMS`), makes it executable and runs `sudo ./xdesign --install`. The installer prints in
xWriter's pacman style (`::` lines, `[Y/n]` questions, the step lines with progress) and logs to
`/var/log/xdesign-install.log`. Its flow follows xmtp-panel's simple installer, with xWriter's
output, preflight, questions, firewall and release-folder steps.

1. Preflight: root, systemd, supported OS and CPU, free disk (at least 1 GB), time in sync
   (warn), an existing install (re-running repairs it; an older xDesign is updated as in section
   6; a newer one is refused), and port 80 for Let's Encrypt (" -> ports     80 free" or " ->
   ports     80 (nginx) in use").
2. "Do you have an xDesign backup to restore? [y/N]": a path to a backup file; if yes, it is checked
   at once, and restored after the files are in place (section 5.4): the database, the media, and
   the certificates when the backup's domain is this one; the settings stay this server's answers,
   and the owner questions are then skipped.
3. "Domain for xDesign (for example design.example.com), or leave empty to use this server's
   IP address:"; with a domain, it checks that the domain points at this server (warns if not).
4. ":: Site port [34567]:": a random free port from 20000 to 60999 (xWriter's code); Enter keeps it;
   another number must be 1 to 65535 and free ("please give a port number from 1 to 65535", "port
   8080 is in use; choose another one", "port 80 cannot serve HTTPS; choose another one"); 443 is
   allowed when free (the address then has no port). Then ":: Web base path
   [/k3v9x2m1q8wz7r4t/]:": a random path of 16 characters; Enter keeps it; another one is checked
   as xWriter's `CheckBasePath` ("the path starts and ends with / and has 1 to 3 parts of 4 to 64
   letters, digits, - or _, for example /k3v9x2m1q8wz7r4t/"); `/` gets the warning "with the web
   base path / anyone who finds the port finds the sign-in page; a random path is recommended". A
   reinstall that keeps `config.toml` and a repair ask neither; a restored backup keeps this
   server's answers. Then, when the site has a domain name, the "HTTPS certificate" question (17
   section 5).
5. Firewall and SELinux: "Open port <n> in the firewall? [Y/n]" for the site's port, and port 80
   when xDesign answers Let's Encrypt there, that an active ufw (Ubuntu and Debian) or firewalld
   (Fedora) does not allow; the ports are opened after the health check, recorded in install.json,
   and a repair leaves the firewall alone. The SELinux port label is asked here (section 4.5).
6. "Owner username [owner]:" (Enter takes "owner"; the rules of 18 section 3.1, asked again with
   the problem's words) and "Owner name:". Then the summary, with " -> address
   https://design.example.com:34567/k3v9x2m1q8wz7r4t/" and " -> HTTPS     Let's Encrypt over port 80
   for design.example.com" (or "Let's Encrypt through Cloudflare DNS for design.example.com", "the
   built-in certificate", "the HTTPS settings are kept" for a kept state file, "the HTTPS settings
   of the backup" for a restore of the same domain), and ":: Proceed with installation? [Y/n]".
7. Install: the system user, the release folder `/opt/xdesign/releases/<version>/` (the helper
   writes itself and unpacks its payload there, like xWriter's release files) and the `current`
   symlink, `/etc/xdesign/config.toml`, `/var/lib/xdesign/` (0750), the units (embedded in the
   helper), Fedora SELinux settings when needed (section 4.5), the app's migrations (`node
   app/cli.mjs migrate`), the owner account (`node app/cli.mjs init-owner`, both as the `xdesign`
   user with `XD_DATA_DIR` and `NODE_ENV=production`), start, and a health check (the website
   answers within 45 seconds, as xmtp-panel's `waitReady`, under the base path), then the firewall,
   then, with Let's Encrypt chosen, the certificate step (17 section 5).
8. The end:

```
:: xDesign 1.0.0 is running.
   Open:     https://design.example.com:34567/k3v9x2m1q8wz7r4t/
   HTTPS:    a certificate from Let's Encrypt, valid until 4 Jan 2027
   Username: owner
   Password: 4mB...(32 characters)   (shown only now; change it under Account)
   Keep this address: the site answers only there. sudo xdesign status shows it again.
   Service:  systemctl status xdesign     Logs: journalctl -u xdesign -f
```

The installer's flags: `--yes`, `--json` (with `--yes`; its `url` is the full address), `--dry-run`,
`--domain NAME`, `--port N`, `--base-path PATH`, `--owner-username NAME` (default `owner`), `--owner-name NAME`,
`--https letsencrypt|cloudflare|builtin`, `--cloudflare-token TOKEN`, `--no-color`, `--log FILE`; `--yes` takes the random port and path and, on a site without an owner, needs `--owner-name`. It records what it did
in `/etc/xdesign/install.json` (status, current version, history with the steps' times, OS, SELinux,
last step), and links `/usr/local/bin/xdesign` to the installed file. Without a domain,
`config.toml` holds the server's first public IP address.

`/etc/xdesign/config.toml`: `listen` (`":<port>"`), `domain` (the domain, or the server's IP address
without one), `base_path` (the web base path, default `/`), `data_dir` (default `/var/lib/xdesign`),
`log_level` (`debug`, `info`, `warn` or `error`, default `info`). The HTTPS method and certificates are kept by the helper in `/var/lib/xdesign/certs/`:
`state.json` (0600: the method and its fields, the state, the renewal and the Let's Encrypt
account), `cert.pem` and `key.pem` (0600) with the certificate of the method, and the built-in
`self-signed.crt` and `.key`; website settings live in the database.

## 4. HTTPS (Q-23, D-23)

The helper's front serves HTTPS with xWriter's certificate code (section 10): TLS 1.2 and 1.3
with xWriter's policy, certificates swapped without restart, the built-in self-signed
certificate as the fallback, and the port-80 answerer that opens port 80 only while a Let's
Encrypt challenge waits. xDesign always serves HTTPS itself on its own port, proposed at random
from 20000 to 60999 and changeable at install (D-609); ports 443 and 80 are left to other
programs. An earlier plan offered three modes (D-23); M12 kept this one way (D-614, 16 section
5).

### 4.1 The helper serves HTTPS itself
- Listens on the site's port; port 80 only for Let's Encrypt's challenges, when it was free at
  install (install.json `https.port_80`; the unit then keeps `CAP_NET_BIND_SERVICE`); the installer
  always writes the built-in state and, after the firewall step, asks the running site for the
  certificate chosen at its "HTTPS certificate" question (17 section 5). Port 80 opens on the listen IP only while a challenge waits and
  answers only GET and HEAD of a waiting token; everything else gets the empty page of 16
  section 4, with no redirect (D-615).
- Settings > HTTPS (the website's page, through the control socket) offers xWriter's methods:
  "Let's Encrypt (port 80)", "Let's Encrypt through Cloudflare DNS" (an API token with DNS edit
  rights; no open port 80 needed), "Certificate files on this server" (paths, read every minute;
  for certbot users), "Paste a certificate", and the built-in self-signed certificate (the
  default only when there is no domain).
- Renewal from 30 days before expiry (with Let's Encrypt's renewal information), with backoff;
  failures show in Settings and Maintenance with xWriter's plain-words reasons ("Another program
  on this server uses port 80. Stop it, or use Cloudflare or certificate files."). "Renew now" in
  Settings > HTTPS renews a working Let's Encrypt certificate at once, after asking.
- The control socket's HTTPS endpoints: `GET /https` (mode, method, names, state, expiry, renewal,
  last problem, the certificate served and the last log), `PUT /https` (method, names, Cloudflare
  token, file paths), `POST /https/certificate` (pasted certificate and key), `POST /https/issue`
  (try now); refusals are 400 or 409 with a plain-words `error`. Without a state file the first
  start uses Let's Encrypt (port 80) for the config file's domain when it is a domain name.
- The manager is a small rewrite on a JSON state file with the same states and methods as
  xWriter's SSL service (D-31); its Let's Encrypt engine, certificate loading and checks are
  copied.

### 4.2 The site's port and path
- The port is a random free one from 20000 to 60999 (xWriter's code), proposed at install and
  changeable there; 443 is allowed when free (the address then has no port), port 80 is refused.
  The address is `https://<domain>:<port>/<path>/`, with the web base path of 16 section 4. Both
  move later with `xdesign admin set-port` and `set-path` (section 7, D-610), or in Settings >
  Site address (17 section 6).
- xDesign does not run behind nginx, Caddy or Apache and configures none of them (D-614): it
  writes no site file, installs no certbot and asks no SELinux boolean. Its own certificates
  come from the methods of 4.1.

### 4.3 Another program holds port 80 or 443
- Port 443 held, for example by xWriter's panel (xWriter serves its own HTTPS without a proxy) or
  a web server: nothing changes, xDesign uses its own port and leaves the other program alone.
- Port 80 held: the installer's "HTTPS certificate" question refuses Let's Encrypt over port 80
  ("Another program (nginx) uses port 80, so Let's Encrypt cannot check this server over it. Choose
  2 or 3.") and proposes Let's Encrypt through Cloudflare DNS (no open port 80 needed); certificate
  files stay in Settings > HTTPS for certbot users.

### 4.4 No domain
- The IP address with the self-signed certificate (the browser warns once), or Let's Encrypt for the
  IP address where supported; a domain can be added later in Settings > HTTPS (the control socket's
  `PUT /https/domain`: the root helper writes `config.toml`'s domain, keeping the port and the path,
  and restarts xDesign with a health check, going back to the domain from before when a step
  fails).

### 4.5 Fedora specifics
- firewalld rules; SELinux: the port label of the site's port (`semanage port`), asked first and
  logged, only while SELinux is enforcing; install.json records it for the uninstall.

## 5. Backups

1. **Daily** by `xdesign-backup.timer` (03:30 server time, copied from xWriter's backup timer):
   `xdesign backup` makes a consistent SQLite copy with `VACUUM INTO` (pure-Go SQLite, as in
   xmtp-panel), then packs it with the media folder, `config.toml` and the certificates as
   `backups/xdesign-<UTC time>.tar.zst` (file 0600 in a 0700 folder, written under a partial name
   and renamed, its metadata file written last, as xWriter does); the archive's first member
   `backup.json` lists every file with its size and SHA-256, so a downloaded backup restores alone;
   14 daily and manual backups kept together (D-32).
2. **Before every update and restore**: `backups/pre-update-<version>-<time>.tar.zst`; the last
   3 kept.
3. **Maintenance > Backups** (site owner): the list with size, time, kind and version, "Make a
   backup now", "Download" and "Delete" (after "Confirm it's you"), the space used.
4. **Restore**: at install (section 3.2), `sudo xdesign restore FILE`, or "Restore" on a backup in
   Maintenance (after "Confirm it's you"), through the root helper: the archive is copied into a
   folder of root's first, then a pre-restore backup, stop, replace the database, media, config and
   certificates, the app's migrations if the backup is older, start, health check, going back to the
   pre-restore backup on failure. The reader is strict (metadata first, hashes and size limits, no
   links or `..`), as xWriter's.
5. A backup from a newer xDesign than the installed one is refused ("This backup is from
   xDesign 1.3.0. Update to 1.3.0 or later first.").

## 6. Updates (the xWriter and xmtp-panel scenario)

### 6.1 From the command line
`sudo xdesign update FILE` (the single file, or a tar.gz, zip, tar.xz or tar.zst holding it,
unpacked by xWriter's unpacker) or `sudo ./xdesign --install` with the new file; `--dry-run` checks
the file without changing anything; `--sha256 SUM`, `--yes`, `--json`, `--no-color` and `--log FILE`
as the installer's. Without SHA256SUMS next to the file or `--sha256` the update warns that the file
was not checked against a checksum.

### 6.2 From the website (Maintenance > Update, site owner)
1. Drop the file (and optionally `SHA256SUMS` and its `.sig`), "Upload and check", after "Confirm
   it's you" (the password). The website streams the upload to the helper over the control
   socket into `maintenance/uploads/<id>/` (xWriter's upload protocol).
2. The checks as rows: "1.0.0 to 1.1.0", "System: Linux", "CPU: amd64", "Checksum: matches" (or "not given"),
   "Signature: valid" (or "not signed"), "Disk space: enough", "Can update from 1.0.0: yes"; the
   release notes if the file carries them. A file for the other system is refused: "This file is for
   Windows; this server runs Linux." (18 section 8.6).
3. "Install and restart" (a fresh "Confirm it's you") writes the request; a 4-step tracker reads
   the helper's progress: "Upload the file", "Check it", "Install and restart", "Back on the new
   build"; the last ends with "xDesign 1.1.0 runs now."
4. Open tabs on the old version show "xDesign was updated. Reload to use the new version." (the live
   connection reports the server's version; every page also asks `/api/health` every minute and
   compares with the first version the tab saw).
5. After a failure: "The update went back by itself. xDesign 1.0.0 runs. The log is in
   /var/lib/xdesign/update-failures/<time>.log".
6. A "Go back" card lists the kept releases: "Roll back to 1.0.0" (with "Also restore the data from
   before the update" when the update changed the database); a release below the running release's
   schema floor always goes back with that data.

### 6.3 What an update does (xWriter's two stages)
Stage 1, the running helper (unprivileged, from the upload or the command line):
1. Unpack the upload to the single file; verify the checksum (and the signature when present).
2. Read the new file's build info: refuse an older version, a different CPU, or a running
   version below the new one's `min_upgrade_from`; check disk space.

Stage 2, the root helper (`xdesign admin maintenance`, running the new file's own code):
3. Pre-update backup (section 5.2).
4. Write the new release folder (the helper writes itself and unpacks its payload); stop the
   service; run the new app's migrations; install the new units.
5. Switch `/opt/xdesign/current` to the new release atomically; start.
6. Health check for up to 120 seconds: the front answers, `<base path>api/health` reports the new version,
   the database opens, the live server accepts a connection.
7. On failure: save the journal to `/var/lib/xdesign/update-failures/`, switch `current` back,
   restore the pre-update backup only when the migrations changed the schema below the old
   version's floor, start the old version, record "went back by itself" in the activity list.
8. Keep the last 3 releases; older ones are removed.

Stage 1 copies the file into a private folder where programs may run (`/var/tmp`, else
`/opt/xdesign/releases`) and starts the copy as stage 2, which writes the release folder with
`release-files`. The health check takes the WebSocket upgrade of `/live` as answered when the live
server says 101 or 401 (no session).

A second safety net, from xmtp-panel's self-update guard: before the switch the helper writes a
marker with the old and new file hashes, a deadline and a start count; the new front confirms it
once it serves; after 3 unconfirmed starts or past the deadline it writes a rollback request for the
root helper and exits; the root helper puts the old release back and starts it. The marker is
`/var/lib/xdesign/update-guard.json`; the guard leaves the way back to stage 2 while stage 2 still
watches the start.

`sudo xdesign rollback [--to <version>] [--restore-db]` goes back by hand.

## 7. The command line

`xdesign serve` (the service), `--install`, `update FILE [--dry-run]`, `rollback`, `backup [--daily]
[--json]`, `restore FILE [--yes]`, `status [--json]` (version, port, the full address with the port
and the path (`address`, also in `--json`), health of the front and the app, uptime, database and
media sizes, free disk, the last backups, the HTTPS method and certificate expiry; as root or the
`xdesign` user; the line " -> port" says "xDesign serves HTTPS itself on it"), `logs [-f] [--lines N]` (the Windows service's log, 18 section
8.2; on Linux it names journalctl), `admin
reset-password <username>`, `admin reset-2fa <username> [--yes]` (asks ":: Turn off two-factor
authentication for <username>? [y/N]" first, 17 section 7), `admin list-users` (Username, Name,
Role, Status, Last seen (UTC); the three run the
app's own commands `node app/cli.mjs ...` as the `xdesign` user), `admin set-port PORT [--no-firewall] [--json] [--yes]` and `admin set-path
PATH | --random [--json] [--yes]` (root; move the site later as xWriter's commands do, D-610: the
new port is opened in the firewall and labeled under SELinux first, config.toml is saved, xDesign
restarts with the health check and the old port is closed if xDesign opened it; set-path warns
that the old address, links already sent and Claude Code's connection stop working and asks with
No as the default; both go back to the settings from before when the site does not answer, refuse
while the maintenance helper or a backup runs, and are recorded in install.json's history and the
install log), `admin maintenance --request` (the root helper), `--uninstall` ("Keep the data" or
"Remove everything", a backup offered first; `--keep-data`, `--remove-everything`, `--backup`,
`--no-backup`, `--undo-selinux`, `--yes`, `--json`, `--dry-run`; it undoes what `install.json`
records: the units, the firewall ports, and the SELinux port labels only when asked; no web
server site or certbot hook exists any more; installed packages stay; Maintenance > Uninstall xDesign
starts it with `--yes`, `--keep-data` or `--remove-everything` and `--no-backup` (with
`--undo-selinux` for Remove everything) as the transient unit `xdesign-uninstall-<time>.service`, 19
section 5), `version [--json]`.

## 8. Health and logs

- `<base path>api/health` (no auth; `/api/health` with base path `/`): `{ "ok": true, "version":
  "1.1.0" }` from the app; the front adds `X-Xdesign-Front: <version>`.
- Logs to the journal: the front's lines and the app's pino JSON lines (one per request, no bodies,
  no secrets). `xdesign status` and Maintenance show version, uptime, database and media sizes, free
  disk, backup times, the HTTPS method and certificate expiry. The control socket's `GET /status`
  carries them all.

## 9. Development on the desktop

`make dev` runs the Node app directly on TCP (02 section 10), without the helper. `make helper`
builds the Go helper alone with a dev payload; `xdesign serve --dev`, run from the repository's root
after `make build`, runs the front on `https://localhost:8443` with a self-signed certificate kept
in `.dev/tls/` and starts the app from `apps/server/dist/server.mjs` (data in `.dev/data/`, sockets
in `.dev/run/`), for trying HTTPS and the proxy. The owner's hand tests of install and update use
test VMs, as for xWriter.

## 10. What is copied from where (D-31)

Source paths are in `/mnt/files/work/xwriter` (module `github.com/Sir-MmD/xwriter`, Go 1.27) and
`/mnt/files/work/xmtp-panel`. Line counts are without tests. The helper is the Go module
`github.com/Sir-MmD/xdesign/helper` in `helper/`, same Go toolchain as xWriter.

| Source | Size | In xDesign | Verdict |
|---|---|---|---|
| xWriter `internal/cli/host` | 809 | `helper/internal/host` | copy as is |
| xWriter `internal/certs` | 1,120 | `helper/internal/certs` | copy as is (TLS policy, load, checks, self-signed) |
| xWriter `internal/release/unpack` | 1,831 | `helper/internal/unpack` | copy as is, without rar |
| xWriter `internal/release` (`binary.go`, `sshsig.go`, sums) | 908 | `helper/internal/release` | copy and adapt to the single file and xDesign's build info (`folder.go` and the archive reader are dropped) |
| xWriter `internal/ssl/acme` | 745 | `helper/internal/ssl/acme` | copy and adapt (it imports `ssl/domain` instead of inlining the SSL types; a small redact function) |
| xWriter `internal/domain/ssl` | 635 | `helper/internal/ssl/domain` | copy (methods, names, renew times, problems) |
| xWriter `internal/web/tlscert.go`, `port80.go`, `getCertificate` of `listeners.go` | 548 + 297 + part | `helper/internal/front` | copy and adapt (no network-change listener, no shared addresses, no event bus) |
| xWriter `internal/services/ssl` | 4,371 | none | not copied: rewritten small on a JSON state file with the same state machine (about 1,000 lines) |
| xWriter `internal/cli/install` | 27,080 | `helper/internal/install` | copy and cut: engine, steps, progress, output, report, pacman, log, preflight, questions, options, system, firewall, files, release, releases, service, installer, update, update stage 2, rollback, go back, maintenance; cut everything for PostgreSQL, browsers, CLIs, box, devices, xray, ffmpeg, yt-dlp, proxies, memory caps, keys and the old restore (about 6,000 to 8,000 lines remain) |
| xWriter `internal/cli` top level | 17,108 | `helper/internal/cli` | copy and adapt only: admin, cli, input, osenv, service, terminal, install, update, rollback, uninstall, release files, maintenance and its kinds, ssl, tls, self-signed, firewall; rework backup and restore for SQLite; GO-05 did not copy `admin.go`, `input.go` and `service.go` (the admin commands' context, their line reader and their systemctl helpers: the later commands add what they use), and the admin firewall command (`fwcommand.go`) is not copied (`Firewall.Close` is kept for the uninstall) |
| xWriter `internal/cli/maintreq` | 536 | `helper/internal/maintreq` | copy and adapt: the request envelope, the update, rollback, restore and domain requests, progress, result; drop the other kinds |
| xWriter `internal/services/maintenance` (`helper.go`, `update_upload.go`, `update_check.go`, `update_unpack.go`) | 1,552 | `helper/internal/maintenance` | copy and adapt into the helper's control socket (the website keeps only "Confirm it's you") |
| xWriter `internal/cli/backup`, `internal/xwbackup` | 3,279 | none | not copied (PostgreSQL); their patterns (partial name then rename, 0600 in 0700, metadata last, retention, strict reader) go into a new `helper/internal/backup` on `VACUUM INTO` |
| xWriter `deploy/` (maintenance `.path` and `.service`, backup `.service` and `.timer`, `sysusers`, `embed.go`; the restore goes through the maintenance request, so no restore units) | small | `helper/deploy/` | copy with renames; the main unit from `xwriter-web.service`; no `Wants=postgresql` |
| xWriter `internal/app/app.go` dispatch, `internal/cli/cmd_release_files.go` | 109 + 239 | `helper/cmd/xdesign`, `helper/internal/app` | copy and adapt (the self-installing single file) |
| xmtp-panel `internal/panel/selfupdate/guard.go` | 510 | `helper/internal/guard` | copy and adapt (names, the start-count marker; it asks the root helper for a rollback instead of switching the release itself) |
| xmtp-panel `cmd/xmtp-panel/panel_install.go` | 1,228 | model for `helper/internal/install/installer.go` | the flow (wait for ready, owner, summary) |
| xmtp-panel `internal/panel/certsvc/custom.go` (`parseUpload`, `parsePrivateKeyPEM`), `certs/preflight` | parts | `helper/internal/ssl` | copy the pasted-certificate parsing and the domain preflight |
| xmtp-panel `build.sh` | 612 | `build.sh` | copy and adapt (menu, steps, single file); add the payload step and xWriter's release checks (sums, signature, version proof) |
| none | | `helper/internal/front` (proxy, child), `helper/internal/control` | new: the Unix-socket reverse proxy with WebSockets, the child supervisor, the control socket |

Copying rules (every brief of a GO task carries them):
1. Copy files with `cp` from the source path, rewrite the module path with `sed`, then cut by
   `grep -n` and `sed` ranges; never print a whole source file.
2. Keep xWriter's and xmtp-panel's texts where the behavior is the same, with "xWriter" or "xmtp
   panel" replaced by "xDesign".
3. `make sanity` builds, vets and lints the helper (xWriter's golangci-lint settings).

What differs between Linux and Windows is in `internal/platform`, with the same names in a
`_linux.go` and a `_windows.go` file (the paths, disk space, file locks, owners, the child's start
and stop, the port errors, the system's name and version); see 18 section 8.8.

## As built (M2)

**SRV-01** (7738685, 0eea8d8), environment and commands.

- Environment: `XD_DATA_DIR` (default `.dev/data` of the working folder), `XD_PORT` (5174),
  `XD_SOCKET`, `XD_WEB_DIR`, `XD_PUBLIC_URL` (default `http://localhost:5173`, http or https only,
  kept as its origin), `XD_BASE_PATH` (default `/`, the secret path of 16 section 4: `/` or 1 to 3
  parts of 4 to 64 of `A-Z a-z 0-9 _ -` between slashes; links use the origin plus this path
  without its last slash), `XD_LOG_LEVEL` (default `info`). On Windows also `XD_PROXY_SECRET`, `XD_CONTROL_URL`,
  `XD_CONTROL_SECRET` (18 section 8.2). A wrong value stops the app with "The
  environment is not valid: ...".
- Commands: `node dist/cli.mjs <command>` (`app/cli.mjs` in a release); no command or `help` lists
  them; an unknown command exits 2; a failing command prints its message and exits 1. The table is a
  Map in `src/cli.ts` with one module per command in `src/commands/`. `pnpm --filter @xdesign/server
  run cli <command>` runs one from source.

**AUTH-01** (0570b62), environment and commands.

- Environment: `XD_DEV` (`1` or `true`, default false), set only by `make dev`: Vite's origins pass
  the Origin check and the dev owner is made.
- Environment: `XD_DESKTOP` (`1` or `true`), `XD_DESKTOP_KEY` (64 lower-case hex, needed with
  `XD_DESKTOP`), `XD_DESKTOP_PREFERRED_PORT` (47823), `XD_STOP_ON_STDIN` (stop cleanly when
  standard input closes), set by the desktop app's shell (18 section 9, DESK-01).
- Commands: `init-owner --username <username> --name <name>` prints "Sign in with <username> and
  this password. It is shown only now: <password>. Change it under Account." (exit 0); it exits 2
  with the rule's problem and "Usage: init-owner --username <username> --name <name>" for a
  missing or invalid argument, and 1 with "The site already has an owner: <username>" or "Someone
  on this site already uses this username." `reset-password <username>` prints "Sign in with
  <username> and this new password. It is shown only now: <password>. Change it under Account."
  (exit 0; "Usage: reset-password <username>" exits 2; "No one on this site has the username
  <username>." exits 1) and ends the sessions. `reset-2fa <username>` prints "Two-factor
  authentication is off now." (exit 0; "Usage: reset-2fa <username>" exits 2; "No one on this
  site has the username <username>." and "Two-factor authentication is already off for
  <username>." exit 1). The username is matched ignoring case and surrounding spaces.
  `list-users` prints the header "Username  Name  Role  Status  Last seen (UTC)" and one row each
  (Role "site owner" or "member", Status "active" or "disabled", Last seen "never" or
  "YYYY-MM-DD HH:MM"), or "No one has an account yet." (USER-01a). Generated passwords are 32
  letters and digits without look-alikes.
- Dev owner: with `XD_DEV=1` (the `make dev` target) and no people, the username "owner" named
  "Owner" with a generated password; `<XD_DATA_DIR>/dev-owner.txt` (mode 0600) holds the username
  and the password on two lines; every dev start prints "Dev owner: <the site owner's username> /
  <password>" after the start line (an old file's email line is not shown).

## As built (M6)

Each paragraph is the task's note as it was written; a later task may have changed a line (for
example every command that GO-01 lists as "not built yet" is built by GO-09, and GO-03 adapted the
messages of `certs`).

**GO-01** (ca577ac, 964fd1f), the helper module.

Code: Module: `helper/go.mod` (`github.com/Sir-MmD/xdesign/helper`, `go 1.27.0`, `toolchain
go1.27.1`), `helper/go.sum`; Command and dispatch: `helper/cmd/xdesign/main.go`,
`helper/internal/app/app.go`, `helper/internal/app/cmd_version.go`; Build info:
`helper/internal/buildinfo/doc.go`, `buildinfo.go`, `version.go`; Copied as they are:
`helper/internal/host` (7 files, 812 lines), `helper/internal/certs` (7 files, 1,124 lines),
`helper/internal/unpack` (9 files, 1,772 lines, without rar); Release reader:
`helper/internal/release/doc.go`, `binary.go`, `packed.go`, `sshsig.go`, `sums.go` (654 lines); Lint
settings: `helper/.golangci.yml` (331 lines, from xWriter's 1,124); Makefile: the `helper` target
(dist/dev/xdesign), `GOFLAGS` and `GOTMPDIR` for the Go steps; `.gitignore` now ignores `.tools`
(the worktrees' symlink too).

- Commands: `serve`, `update`, `rollback`, `backup`, `restore`, `status`, `admin`, `version` and the
  switches `--install` and `--uninstall`. Every one but `version` prints "xdesign <command>: not
  built yet" (for example "xdesign --install: not built yet") on stderr and exits 2. `xdesign` alone
  prints the usage on stderr and exits 2; `help`, `-h`, `--help` print it on stdout and exit 0; an
  unknown command exits 2.
- `xdesign version` prints one line: `xdesign 0.0.0-dev+c17df9ef8b5e.dirty (commit c17df9ef8b5e
  (modified), built 2026-11-23T02:22:25Z, go1.27.4 linux/amd64)` (with `Node.js <version>` when the
  build has a payload).
- `xdesign version --json` keys, in order: `version`, `commit`, `built_at`, `modified`, `arch`,
  `node_version`, `payload_sha256`, `min_upgrade_from`, `schema_floor`, `go`, `os`. `modified`, `go`
  and `os` are kept from xWriter. Unstamped values: version `0.0.0-dev`, commit and built_at from
  the Go VCS data, arch from the CPU, node_version and payload_sha256 empty (no payload),
  min_upgrade_from and schema_floor `0.0.0` (no limit).
- Stamped variables of `github.com/Sir-MmD/xdesign/helper/internal/buildinfo`: `Version`, `Commit`,
  `BuiltAt`, `Arch`, `NodeVersion`, `PayloadSHA256`, `MinUpgradeFrom`, `SchemaFloor`
  (`buildinfo.StampNames()` lists them). `make helper` stamps the first four: `0.0.0-dev+<12-char
  commit>` with `.dirty` for uncommitted changes, the full commit, the commit time as `built_at`,
  and `go env GOARCH`; it builds with `CGO_ENABLED=0 -trimpath -ldflags "-w ..."`.
- `release.InspectBinary` reads a file without running it: ELF header (amd64 or arm64, 64-bit), Go
  build info (module `github.com/Sir-MmD/xdesign/helper`, package `cmd/xdesign`, GOOS linux,
  CGO_ENABLED 0, GOARCH equal to the ELF machine), then the stamped variables from the ELF symbol
  table; it refuses a stripped file, an arch that disagrees, or a version, min_upgrade_from or
  schema_floor that is not a version. `Binary` is `buildinfo.Info` plus `Dev` (the version has a
  pre-release).
- Signature: `release.CheckSignature(sums, sig)` returns `SignatureNone` ("not signed") or
  `SignatureValid` ("valid"), or an error wrapping `ErrBadSignature`; `trustedKeys()` returns no
  key, so every check says "not signed". Namespace `xdesign-release`.
- `release` keeps `Kind` and `DetectKind`/`ReadKind`, `ParseSums`, `MatchSum`, `ValidSHA256`,
  `SumsName`, `SigName`, and the constant `ManifestName`; xWriter's `folder.go` and the archive part
  of `archive.go` (ReadFolder, ParseManifest, VerifyFiles, WalkArchive, ScanArchive) are dropped.
  `buildinfo` drops xWriter's VERSION file (`release.go`), `Current`, `Behind`, the demo build and
  `ReleasePublicKey`, and keeps the constant `ReleaseFileName`.
- `unpack` without rar: a rar file is now refused like 7z and bzip2 ("rar files are not supported:
  pack the update as zip, tar.xz or tar.zst."). Texts say "xdesign file" and "xDesign" for "xwriter
  file" and "xWriter", and "release archive" is dropped from the sentences; release names match
  `xdesign-<version>-linux-<arch>(.tar.gz)`.
- `host` and `certs`: only "xwriter" and "xWriter" replaced by "xdesign" and "xDesign" (so certs'
  messages name `xdesign admin set-tls` and `/etc/xdesign/tls/`); each package comment says it is
  copied and that its other docs/plan references are xWriter's plan.
- `helper/.golangci.yml` keeps xWriter's linters and settings except the test linters (testifylint,
  tparallel, usetesting), the build tags and test exclusions, `rowserrcheck`'s pgx setting, the
  `time.Now` rule for domain and services, and every depguard rule for paths xDesign does not have.
  Kept depguard rules: rejected-modules (the general ones), archives-only-in-unpack,
  lego-only-in-ssl-acme (for GO-03), certs-imports-stdlib, release-imports-stdlib-buildinfo,
  unpack-imports, app-only-from-cmd. Prettier formats it (single quotes).
- Makefile: `export GOFLAGS := -mod=readonly -trimpath` and `export GOTMPDIR :=
  ~/.cache/xdesign/gotmp`; the default Go build cache (`~/.cache/go-build`) and golangci-lint cache
  are shared by all worktrees. `helper-check` itself is FND-01's (in a worktree only when something
  under helper/ changed; on main always).
- Go modules downloaded into the module cache (`~/go/pkg/mod`) for the later GO tasks; `GOPROXY=off
  go get` of all of them and `go list -deps` of the lego, go-toml, x/net, x/sys and sqlite packages
  work offline (checked). go.mod keeps only what the code imports: `github.com/klauspost/compress
  v1.19.2`, `github.com/ulikunitz/xz v0.5.17`.

| Module | Version | Module | Version |
|---|---|---|---|
| github.com/go-acme/lego/v5 | v5.5.2 | golang.org/x/crypto | v0.57.0 |
| github.com/klauspost/compress | v1.19.2 | golang.org/x/net | v0.59.0 |
| github.com/ulikunitz/xz | v0.5.17 | golang.org/x/sys | v0.48.0 |
| github.com/pelletier/go-toml/v2 | v2.4.3 | golang.org/x/text | v0.42.0 |
| modernc.org/sqlite | v1.59.0 | modernc.org/libc | v1.75.7 |
| modernc.org/mathutil | v1.7.1 | modernc.org/memory | v1.12.1 |
| github.com/go-jose/go-jose/v4 | v4.1.5 | github.com/miekg/dns | v1.1.73 |
| github.com/cenkalti/backoff/v5 | v5.0.3 | github.com/google/uuid | v1.6.0 |
| github.com/dustin/go-humanize | v1.0.1 | software.sslmate.com/src/go-pkcs12 | v0.7.3 |
| github.com/remyoudompheng/bigfft | v0.0.0-20230129092748-24d4a6f8daec | | |

These are the modules of the packages the later GO tasks import (lego acme, acme/api, certcrypto,
certificate, challenge, challenge/dns01, http01, tlsalpn01, lego, log, providers/dns/cloudflare,
registration; zstd; xz; go-toml/v2; x/net idna, netutil, publicsuffix; x/sys/unix; x/crypto/ocsp;
sqlite). The go.mod files of lego's whole module graph (its DNS providers' modules) are in the cache
too, which `go get` needs. Later tasks add them with `GOPROXY=off go get <module>@<version>` and
`GOPROXY=off go mod tidy`.

**GO-02** (68c06d5), the front.

(M12 replaced modes A and B: see As built (M12).)

Code: Config file: `helper/internal/config/doc.go`, `config.go`, `validate.go`;
`github.com/pelletier/go-toml/v2 v2.4.3` added to `helper/go.mod`; Child supervisor:
`helper/internal/front/child.go`; Reverse proxy and the starting page:
`helper/internal/front/proxy.go`; the server and the shutdown order: `front.go`; `doc.go`; Control
socket: `helper/internal/control/doc.go`, `server.go` (socket, server, JSON answers), `routes.go`
(the router), `status.go` (GET /status); The `serve` command: `helper/internal/app/cmd_serve.go`; in
`app.go` only the serve entry changed (`run: cmdServe`).

- `config.toml` keys: `listen` (one string, `"IP:port"` or `":port"`; host names refused; with
  `https_mode = "proxy"` a loopback IP only), `domain` (required: the domain, or the server's IP
  address; lowercased; no scheme or port), `https_mode` (required: `builtin`, `proxy` or `port`),
  `data_dir` (absolute, default `/var/lib/xdesign`), `log_level` (`debug`, `info`, `warn` or
  `error`, default `info`; the same word goes to the app's `XD_LOG_LEVEL`). Unknown keys and every
  bad value are reported at once as "invalid configuration in <file>: <problem>". Without the file:
  "the config file /etc/xdesign/config.toml does not exist: the installer writes it; on the desktop
  run `xdesign serve --dev`".
- `XD_PUBLIC_URL`: `https://<domain>` in mode B; in modes A and C `https://<domain>:<port>` unless
  the listen port is 443.
- `xdesign serve [--config FILE]` or `xdesign serve --dev` (the two exclude each other). `builtin`
  and `port` stop with `xdesign serve: https_mode "builtin" comes with GO-03; only proxy works in
  this build` (exit 1). A release folder without `runtime/node` or `app/server.mjs` stops with a
  message naming the folder.
- Start order: the TCP listener (so a taken port fails first), the control socket, then the app. On
  SIGTERM or SIGINT: the front stops taking requests and lets those in flight finish (5 seconds at
  most), then the app gets SIGTERM (SIGKILL after 10 seconds), then the control socket closes; exit
  0.
- The app runs as `<release>/runtime/node <release>/app/server.mjs` with the release folder as its
  working folder, in a process group of its own, with the helper's environment minus `XD_*`,
  `NOTIFY_SOCKET` and `LISTEN_*`, plus `XD_SOCKET`, `XD_DATA_DIR`, `XD_WEB_DIR`, `XD_PUBLIC_URL`,
  `XD_BASE_PATH` (config.toml's `base_path`, `/` for `--dev`), `XD_LOG_LEVEL`, `XD_CONTROL_SOCKET`. Its stdout and stderr are the helper's stderr itself (the
  journal stream), so its pino lines arrive unchanged.
- Ready means `<base path>api/health` answered 200 with `ok: true`, asked every 200 ms (2 seconds each) after
  the start; requests reach the app only then. Backoff 1 s doubling to 30 s, back to 1 s once the
  app was up 2 minutes; a start that fails (a missing file) counts as an exit.
- The helper's own lines are slog JSON on stderr with `part` (`front`, `app`, `proxy`, `control`):
  "xdesign serve", "control socket ready", "front started", "app started", "app is ready", "app
  exited", "restarting the app", "stopping the app", "app stopped", "front stopped".
- Proxy: `X-Forwarded-For` (one address), `X-Forwarded-Proto` and `X-Forwarded-Host` come from the
  connection; in mode B from the last entries of the web server's headers (the front listens on
  loopback only), so the app, which trusts one hop, sees the real client and https. The Host header
  is kept, bodies are not recompressed, `FlushInterval: -1`, and every answer carries
  `X-Xdesign-Front: <version>`.
- Starting page: 503 with `Retry-After: 3`, `Cache-Control: no-store`, its own CSP (`default-src
  'none'; style-src 'unsafe-inline'; frame-ancestors 'none'`), a meta refresh of 3 seconds, light
  and dark colors and the text "xDesign is starting...". It also answers a request the app failed to
  take (the app stopped meanwhile), logged as a warning when the app counted as ready.
- Front server: ReadHeaderTimeout 10 s, IdleTimeout 120 s, 64 KiB of headers, no read or write
  timeout (uploads, WebSockets, streams). HTTPS (dev) offers h2 and http/1.1 with
  `certs.ServerConfig`.
- Control socket: mode 0600 from its creation (umask 0177 around bind), its folder created with 0700
  when missing, a stale socket removed, a live one refused ("another xdesign serve listens on it").
  `GET /status` answers `{"version", "front_started_at", "app": {"state", "pid", "restarts",
  "last_exit"}, "mode", "address"}`: state is `starting`, `running`, `restarting`, `stopping` or
  `stopped`; pid is 0 when the app does not run; last_exit is null or `{"at", "code", "signal",
  "error"}` (code -1 for a signal or a failed start; signal and error only when set); mode is
  `builtin`, `proxy`, `port` or `dev`; address is `XD_PUBLIC_URL`. Unknown paths answer 404
  `{"error":"unknown endpoint: GET /x"}`. A new area adds `<area>.go` with `<area>Routes(opts)
  []route`, one line in `routes.go`, and what it needs in `control.Options`.
- `serve --dev` runs from the repository's root after `make build`: `node` from PATH, the
  certificate `.dev/tls/self-signed.crt` (kept across runs, renewed by `certs.EnsureSelfSigned`),
  listening on `127.0.0.1:8443` with the address `https://localhost:8443`, data in `.dev/data`,
  sockets `.dev/run/app.sock` and `.dev/run/control.sock` (socket paths over 107 bytes are refused).

**GO-03** (c5b8f89), HTTPS in the helper.

(M12 replaced modes A and B: see As built (M12).)

Code: Rules copied from xWriter's `internal/domain/ssl`: `helper/internal/ssl/domain/` (`doc.go`,
`ssl.go`, `names.go`, `problems.go`, `renewal.go`, `log.go`); Let's Encrypt engine copied from
xWriter's `internal/ssl/acme`: `helper/internal/ssl/acme/` (`doc.go`, `engine.go`, `cloudflare.go`,
`explain.go`, `keys.go`, `logging.go`) plus the small `redact.go`; xmtp panel's pasted-certificate
parsing and domain preflight: `helper/internal/ssl/upload.go`, `helper/internal/ssl/preflight.go`;
The HTTPS manager on the JSON state file: `helper/internal/ssl/manager.go`, `state.go`, `http01.go`,
`view.go`, `doc.go`; Certificate store with the getCertificate hook and the port-80 answerer:
`helper/internal/front/tlscert.go`, `helper/internal/front/port80.go`; `front/doc.go` updated;
Control socket endpoints: `helper/internal/control/https.go`; one line in `routes.go`, the `HTTPS`
option in `server.go`, `doc.go` lists the endpoints; `serve` modes `builtin` and `port` and the new
`--dev`: `helper/internal/app/cmd_serve.go`; certs messages: `helper/internal/certs/load.go`,
`info.go`, `selfsigned.go` (comment), `doc.go`; `helper/go.mod`, `go.sum`:
`github.com/go-acme/lego/v5 v5.5.2`, `github.com/miekg/dns v1.1.73`, `golang.org/x/net v0.59.0`
(offline, `go mod tidy`).

- State folder `<data_dir>/certs` (`/var/lib/xdesign/certs`, 0700): `state.json` (0600: method,
  names, Cloudflare token, file paths, status, expiry, renewal time and ARI, failures and next
  attempt, last problem, the log of the last issuance, the Let's Encrypt account key and
  registration), `cert.pem` (0644) and `key.pem` (0600) holding the certificate of the method (Let's
  Encrypt's, the pasted one, or the last good copy of the certificate files), and the built-in
  `self-signed.crt` and `self-signed.key`. `serve --dev` keeps the state in `.dev/certs` and the
  built-in certificate in `.dev/tls`.
- First start without a state file: `letsencrypt_http` for the config file's `domain` when it is a
  domain name (the issuance starts at once), else `builtin`.
- Methods and states are xWriter's (`builtin`, `letsencrypt_http`, `letsencrypt_cloudflare`, `file`,
  `uploaded`; `issuing`, `active`, `renewing`, `failed`, `expired`, `unreadable`). A new Let's
  Encrypt choice keeps serving the certificate in `cert.pem` (or the built-in one) until the new one
  is issued; a failed first issuance waits for "Try now" or another choice; a failed renewal keeps
  the certificate and retries after 5 minutes, 30 minutes, 2 hours, then every 6 hours (or Let's
  Encrypt's Retry-After). Choosing `builtin` removes `cert.pem` and `key.pem`; the Cloudflare token
  and the account stay in the state file.
- Renewal: checked at start and every 15 minutes; the time Let's Encrypt's renewal information (ARI,
  read every 12 hours or after its Retry-After) suggests, one random moment per window, else two
  thirds of the lifetime (day 60 of 90, 30 days before the expiry; half of it under 10 days); an
  expired certificate renews at once.
- Before each order, xmtp panel's preflight asks 1.1.1.1 and 8.8.8.8 for each name: a CAA record
  that forbids Let's Encrypt stops the order ("The domain's DNS (CAA record) does not allow Let's
  Encrypt."), and for HTTP-01 a name without an A or AAAA record when the resolvers answered
  ("<name> does not point to this server. ..."); everything else it finds goes to the log as
  "Preflight: ..." warnings. The Cloudflare edge ranges check is left out.
- HTTP-01: the manager keeps the answers in memory (10 minutes), wakes the port-80 answerer through
  a channel, and checks `http://<listen IP or 127.0.0.1>:80/.well-known/acme-challenge/<token>` with
  the domain as Host until it answers (20 seconds; another answer for 3 seconds means another
  program). A front listening on port 80 itself gets "xDesign itself uses port 80, ...".
- Port 80 opens on the listen IP only while an answer waits and closes 2 minutes after the last one;
  GET and HEAD of a waiting token get the key authorization, everything else (other paths, an
  unknown or expired token, other methods) gets the empty page of 16 section 4 (D-615). Runs in
  `port`, not in `--dev`.
- The front's certificate store asks the manager at start, every minute (the file method's files are
  read again when they changed) and whenever the manager reports a change; new handshakes get the
  new certificate, nothing restarts. If the manager cannot answer at start, a temporary in-memory
  self-signed certificate is served.
- Control socket, JSON both ways, unknown fields refused: - `GET /https`: `mode`, `method`, `names`
  (the Let's Encrypt names, else the served certificate's), `state`, `expires_at`, `renew_at`,
  `next_attempt_at`, `failures`, `renewal_explanation_url`, `last_problem`, `last_problem_at`,
  `cloudflare_token_set`, `cert_file`, `key_file`, `certificate` (`method`, `name`, `subject`,
  `issuer`, `names`, `not_before`, `not_after`, `fingerprint_sha256`, `self_signed`, `trusted`,
  `problem`), `log` (`at`, `level`, `text`). In mode B: `{"mode":"proxy","message":"HTTPS is handled
  by the web server in front of xDesign on this server."}`. - `PUT /https` body `{"method", "names",
  "cloudflare_token", "cert_file", "key_file"}` (16 KiB); an empty token keeps the saved one;
  `uploaded` is refused ("Paste the certificate and its key to use your own certificate."). - `POST
  /https/certificate` body `{"certificate", "private_key"}` (PEM text, 192 KiB); the answer adds
  `left_out` (`subject`, `reason`: root, unrelated, superseded). - `POST /https/issue`: Let's
  Encrypt issues or renews at once, ignoring the backoff; the file method reads its files again;
  `uploaded` and `builtin` answer 409. - Every refusal is `{"error": "<plain words>"}` with 400 (a
  wrong request) or 409 (Let's Encrypt is working on the certificate, the method does not allow it,
  or mode B); 500 only for a failure to write.
- The Cloudflare token is stored only in `state.json`; lego's records and every error text pass
  through `acme.Redact` (PEM keys, Authorization values, secret-looking key=value pairs, URL user
  info and queries) before the log.
- certs messages: "or paste the certificate and its key in Settings > HTTPS" in place of `xdesign
  admin set-tls` and `/etc/xdesign/tls/`; the example paths are certbot's
  (`/etc/letsencrypt/live/design.example.com/fullchain.pem`); "the panel" is "xDesign" in its
  messages.

**GO-04** (877b131, ae449e7), the release build.

Code: Release build: `build.sh` (from xmtp-panel's, the menu, the steps with progress, xWriter's
release checks), `make release` in the `Makefile`; Pins: `tools/release/node.env` (Node.js v26.13.1
and the SHA-256 of its linux-x64 and linux-arm64 tar.xz), `tools/release/compat.env`
(`MIN_UPGRADE_FROM`, `SCHEMA_FLOOR`); Payload: `helper/internal/payload/doc.go`, `payload.go`
(`Open`, `Extract`), `embedded.go` (tag `payload`), `none.go` (no tag); `.gitignore` ignores
`helper/internal/payload/payload.tar.zst`; Release files: `helper/internal/app/cmd_release_files.go`
and the `release-files` case in `helper/internal/app/app.go`; Lint: `helper/.golangci.yml`, rule
`payload-imports` (standard library and zstd only), `archives-only-in-unpack` exempts
`internal/payload`; App version: `apps/server/build.ts` stamps `XD_RELEASE_VERSION` into the bundles
(`src/version.ts` unchanged); Release notes: `docs/release-notes-template.md`.

- `./build.sh` checks the tools, refuses a working tree with uncommitted changes unless
  `ALLOW_DIRTY=1` (before any question), then asks "Version to build (for example 1.0.0):" and,
  since BUILD-01, the questions of docs/plan/18 section 10 (what to build, the systems, the CPUs).
  `--version`, `--servers`, `--desktops` and `--arches` (amd64, arm64, both, or a list) skip the
  questions; without a terminal `--version` is required and the rest defaults to the Linux server
  for both CPUs. `make release` runs `./build.sh --version "$VERSION" --servers "${SERVERS:-linux}"
  --desktops "${DESKTOPS:-none}" --arches "${ARCHES:-amd64 arm64}"` and stops with a hint when
  `VERSION` is missing. The version must be a semantic version (X.Y.Z, optionally `-pre` and
  `+build`).
- The build date is the commit time (`built_at`, and the tar times through `SOURCE_DATE_EPOCH`), so
  one commit gives the same tar.gz bytes. `version --json` says `"modified": true` for an
  `ALLOW_DIRTY=1` build (Go's VCS data), and the proof checks it.
- Steps: pnpm install (frozen lockfile, prefer offline); `make build` with
  `XD_RELEASE_VERSION=<version>`, which stamps the version into server.mjs and cli.mjs, so
  `/api/health` reports the release (dev builds keep 0.0.0-dev); third-party notices; then per CPU
  the payload, the file and its tar.gz; then SHA256SUMS, its signature, the notes and the proof.
- Node.js: `node-<version>-linux-<x64|arm64>.tar.xz` from nodejs.org, cached in `.dev/cache/node/`,
  checked against `tools/release/node.env`; only `bin/node` (as `runtime/node`, 0755) and its
  `LICENSE` (as `app/LICENSES/node.js/LICENSE`) are taken.
- Native modules: better-sqlite3 13.2.0 ships every prebuilt binary in its one npm package, so the
  payload takes its `package.json`, `LICENSE`, `lib/` and only `prebuilds/linux-<cpu>.node`.
  @node-rs/argon2 is copied whole with its CPU package `@node-rs/argon2-linux-<cpu>-gnu`: the one
  pnpm installed, or for the other CPU the npm registry's tarball, cached in `.dev/cache/npm/` and
  checked against the integrity (sha512) that `pnpm-lock.yaml` pins. No change to the workspace
  settings (no `supportedArchitectures`).
- `app/LICENSES/`: the license, copying and notice files of every production package of the server
  and the SPA (`pnpm licenses list --prod`, 374 packages), each in `<name>@<version>/`, the list in
  `THIRD-PARTY.txt` (name, version, license; "the package has no license file" where there is none),
  and Node.js's license in `node.js/`.
- Payload: `dist/build/payload-<arch>.tar.zst` (about 36 MiB), GNU tar sorted by name with owner 0/0
  and fixed times, modes 0755 for folders and executables and 0644 otherwise, zstd -19; source maps
  (`*.map`) are left out. The unpacked stage stays in `dist/build/payload-<arch>/`.
- Files: `dist/xdesign-<version>-linux-<arch>` (about 46 MiB), `go build -tags payload -trimpath`
  with `CGO_ENABLED=0 GOOS=linux GOAMD64=v1 GOARM64=v8.0` and `-ldflags "-w -X ..."` of the eight
  keys; `file` must report a static ELF of the CPU, "not stripped".
  `dist/xdesign-<version>-linux-<arch>.tar.gz` (about 40 MiB, the payload is already compressed):
  GNU tar, sorted, fixed time, owner 0/0, mode 0755, `gzip -9 -n`; it must list exactly the file and
  hold the same bytes.
- `SHA256SUMS` lists the tar.gz files, then the files (amd64 before arm64); the release notes are
  not in it. With `.dev/release-signing-key` (Ed25519, with its `.pub`) `ssh-keygen -Y sign -n
  xdesign-release` writes `SHA256SUMS.sig` and the build verifies it; a warning says so when the key
  is not yet in `trustedKeys()` of `internal/release/sshsig.go`. Without the key the step only says
  "not signed".
- `dist/release-notes-<version>.md` is the template below its `---` line with `{{version}}`,
  `{{built_at}}`, `{{files}}`, `{{signature_file}}`, `{{min_upgrade_from}}`, `{{schema_floor}}`,
  `{{commit}}`, `{{go_version}}`, `{{node_version}}`, `{{payload_sha256}}`, `{{signature}}` and
  `{{sha256sums}}` filled in; notes in angle brackets are the owner's. A changed earlier file of the
  same version is kept as `.md.bak`.
- Proof: `sha256sum --check SHA256SUMS`; each tar.gz holds its file byte for byte; on this
  computer's CPU only: `version --json` has every key (version, commit, built_at, modified, arch,
  node_version, payload_sha256, min_upgrade_from, schema_floor), and `release-files` into
  `dist/build/release-<arch>` writes `xdesign` equal to the file with 0755, `runtime/` and `app/`
  equal to the payload stage with the same execute bits, and `runtime/node --version` is the pinned
  version. Another CPU is "not run". Since BUILD-01 the proof of each file follows the build order
  (the file's run, then its tar.gz).
- Before each build, earlier `dist/xdesign-*-linux-*` files, `SHA256SUMS`, `SHA256SUMS.sig` and
  `dist/build/` are removed; `dist/release-notes-*.md` of other versions stay. The exit trap removes
  `helper/internal/payload/payload.tar.zst` and half-written files.
- `xdesign release-files <dir>`: not in the help. It checks the embedded payload against the stamped
  SHA-256 before it writes anything, creates `<dir>` (0755) or takes an empty one, unpacks
  `runtime/` and `app/` through `os.Root` (only folders and regular files, only names below runtime/
  and app/, no file written twice), copies `/proc/self/exe` to `<dir>/xdesign` (0755), prints the
  folder; on a failure it removes what it wrote. Texts: "this xdesign file carries no payload: it is
  a development build; build a release with ./build.sh or make release", "<dir> is not empty; remove
  it or name another folder", "the payload of this xdesign file is damaged: its SHA-256 is <x>, the
  build stamped <y>". Exit codes 0, 1 (failure) and 2 (usage).

**GO-05** (15e9729), the installer.

(M12 replaced modes A and B: see As built (M12).)

Code: Install engine: `helper/internal/install/` (5,982 lines): `engine.go`, `steps.go`,
`progress.go`, `output.go`, `report.go`, `pacman.go`, `log.go`, `tempdir.go`, `preflight.go`,
`questions.go`, `options.go`, `system.go`, `files.go`, `release.go`, `releases.go`, `service.go`,
`installer.go`, `state.go`, copied from xWriter's `internal/cli/install` by file and cut;
`distro.go` and `weights.go` cut from xWriter's too (the OS check and the step weights the progress
needs); `doc.go`; Command line: `helper/internal/cli/cli.go`, `osenv.go`, `cmd_install.go`,
`terminal_linux.go`, `terminal_other.go`; `helper/internal/app/cmd_install.go` and the `--install`
case of `helper/internal/app/app.go`; Embedded units: `helper/deploy/embed.go`,
`helper/deploy/systemd/xdesign.service` (from xWriter's `xwriter-web.service`),
`helper/deploy/sysusers/xdesign.conf` (from xWriter's `xwriter.conf`); Config: `config.Parse` and
`config.Render` in `helper/internal/config/config.go` (Load now calls Parse); App child:
`NODE_ENV=production` in `appEnv` of `helper/internal/front/child.go`; `helper/go.mod`:
`golang.org/x/sys v0.48.0` (the terminal check, as xWriter's).

- `sudo ./xdesign --install [--yes] [--json] [--dry-run] [--domain NAME] [--https-port N]
  [--owner-email ADDRESS --owner-name NAME] [--no-color] [--log FILE]`; `-h` prints the flags.
  `--json` needs `--yes`; `--yes` on a site without an owner needs both owner flags; without
  `--domain` it takes this server's IP address.
- Output sections: ":: Checking this server...", ":: Installing xDesign <version>...", ":: Setting
  up the website...", ":: Starting xDesign...", ":: Finishing...". Steps: 1 Preflight checks, 2
  System user, 3 Folders, 4 Program files, 5 SELinux labels, 6 Settings, 7 systemd unit, 8 Enable at
  boot, 9 Database migrations, 10 Owner account, 11 Start and health check, 12 Finish. Every check,
  act and verify of xWriter's engine, its bar with the percent of the whole run, its dry run and its
  failure block are kept.
- Preflight: root; this file carries a payload (a development build is refused: "this xdesign file
  carries no payload: it is a development build; build a release with ./build.sh or make release");
  os-release (other systems are refused: "xDesign installs on Ubuntu 24.04 and 26.04, Debian 12 and
  13, and Fedora 43 or newer; this system is <name>, which is not supported"); not an image-based
  system; systemd running and 252 or newer; amd64 or arm64, and the CPU of this file; /opt (not
  noexec) and /var/lib each with 1 GB free; a warning when the clock is not synchronized; the
  SELinux mode; ports 443 and 80 probed when no config.toml exists; the earlier installation.
- Modes, from `/etc/xdesign/install.json` (xWriter's state file cut to `status`, `current_version`,
  `history` with the steps' times, `os`, `selinux`, `last_step`): fresh; resume ("An earlier
  installation did not finish. Continue it? [Y/n]", or "stopped at ..."); existing data ("xDesign's
  data from an earlier installation is here. Install with it? [Y/n]"); repair (same version:
  "warning: xdesign <v> is up to date -- repairing", ":: Proceed with repair? [Y/n]", the start step
  restarts); older: "error: xdesign <old> is installed, older than this <new>", " -> update it  sudo
  xdesign update <this file's path>", ":: Nothing was changed."; newer, or the unfinished
  installation or data of a newer one: refused the same way. The installed version is the target of
  `/opt/xdesign/current` (`releases/<version>`).
- Questions: ":: Do you have an xDesign backup to restore? [y/N]" (fresh installs only; a yes prints
  "error: restoring a backup while installing is not built yet: answer n to install a new site" and
  asks again); ":: Domain for xDesign (for example design.example.com), or leave empty to use this
  server's IP address:" (with a domain, a note that it points to this server or a warning that it
  does not; empty takes the first public IPv4 address of the network interfaces, else a public IPv6
  one, else a private one with a warning); HTTPS: `builtin` on `:443` when ports 443 and 80 are
  free, else `port` on a random free port from 20000 to 60999 with ":: HTTPS port [<n>]:"; ":: Owner
  email:" and ":: Owner name:" with the app's rules and messages ("Enter a valid email address.",
  "Enter a name.", "Use at most 100 characters."); the summary (program, settings when kept,
  address, HTTPS in plain words, owner); ":: Proceed with installation? [Y/n]". A kept config.toml
  skips the domain and HTTPS questions; a site that has its owner (`list-users`) skips the owner
  questions.
- Folders: `/opt/xdesign` and `/opt/xdesign/releases` root 0755, `/etc/xdesign` root:xdesign 0750,
  `/var/lib/xdesign` xdesign:xdesign 0750. The user comes from `/etc/sysusers.d/xdesign.conf` and
  `systemd-sysusers`.
- Program files: `/proc/self/exe release-files /opt/xdesign/releases/.staging-<8 random>`, then the
  folder is renamed to `releases/<version>`; a folder counts as this release when its `xdesign` has
  the running file's SHA-256 and `runtime/node`, `app/server.mjs` and `app/cli.mjs` exist. `current
  -> releases/<version>` and `/usr/local/bin/xdesign -> /opt/xdesign/current/xdesign`, each switched
  with a rename. Staging folders an interrupted run left are removed.
- SELinux (Fedora, enforcing or permissive): `restorecon -R -F` on /opt/xdesign, /etc/xdesign and
  /var/lib/xdesign, then `chcon -t bin_t` on the xdesign file when the policy did not give it
  `bin_t` (a warning, and `chcon_fallback` in install.json).
- `/etc/xdesign/config.toml`, root:xdesign 0640: `listen`, `domain`, `https_mode`, `data_dir =
  "/var/lib/xdesign"`, `log_level = "info"` under a two-line comment ("# xDesign's settings, written
  by the installer (sudo ./xdesign --install)." and "# xdesign serve reads them at its start:
  systemctl restart xdesign after a change."). An existing file is checked with `config.Parse` and
  never overwritten ("<file> exists but is not valid: ... Fix it, or move it away so the installer
  writes a new one, then run the installer again").
- `/etc/systemd/system/xdesign.service`: `Type=exec`, `User`/`Group` xdesign,
  `ExecStart=/opt/xdesign/current/xdesign serve --config /etc/xdesign/config.toml`,
  `Restart=on-failure` (5 s), `TimeoutStopSec=30`, `KillMode=mixed`, `StateDirectory` and
  `RuntimeDirectory` xdesign 0750, `UMask=0027`, `ProtectSystem=strict`,
  `ReadWritePaths=/var/lib/xdesign`, `PrivateTmp`, `NoNewPrivileges` and the rest of xWriter's
  hardening without `MemoryDenyWriteExecute`, `LimitNOFILE=65536`, `WantedBy=multi-user.target`.
  When the site listens on a port of 1024 or above, the installer leaves
  `AmbientCapabilities=CAP_NET_BIND_SERVICE` out and writes `CapabilityBoundingSet=` empty. Then
  `systemctl daemon-reload` and `systemctl enable xdesign.service`.
- App commands: `runuser -u xdesign -- env -C /opt/xdesign/current XD_DATA_DIR=/var/lib/xdesign
  NODE_ENV=production /opt/xdesign/current/runtime/node /opt/xdesign/current/app/cli.mjs <command>`:
  `migrate`; `list-users` (the owner check, each row read from its end); `init-owner --email <email>
  --name <name>`, whose output the log hides; the password is taken from "It is shown only now:
  <password>." and masked in the log.
- Start: `systemctl reset-failed xdesign.service` (its failure ignored), `systemctl start`
  (`restart` in a repair or when it runs), then every second `systemctl is-active` and `GET
  https://127.0.0.1:<port>/api/health` (http in mode proxy) with the site's name as Host and TLS
  server name, no certificate check, until 200 with `"ok": true`, up to 45 seconds. A failed unit
  stops at once: "xdesign.service failed to start; its journal says why: journalctl -u xdesign -n 50
  --no-pager"; a timeout says "the website did not answer within 45 s (last: ...)". The fact " ->
  health  the website answered after <n> s".
- End: the block of section 3 step 8 (":: xDesign <v> is running.", "   Open:     <address>", "
  Email:    <email>", "   Password: <password>   (shown only now; change it under Account)", "
  Service:  systemctl status xdesign     Logs: journalctl -u xdesign -f"); a repair says ":: xDesign
  <v> was repaired and is running." and "   Password: unchanged (sudo xdesign admin reset-password
  <email> makes a new one)". Then "warning: if this server or your hosting provider has a firewall,
  allow TCP ports 443 and 80 there" (or the port of mode C).
- Log `/var/log/xdesign-install.log` (root 0600, every command and its output, secrets masked).
  `--json`: xWriter's "step" and "progress" lines with "percent" on standard error, one object on
  standard output: `status` (installed, repaired, planned, failed), `version`, `url`, `email`,
  `password` (only when made in this run), `failed_step`, `log`, `error`.
- serve's app child gets `NODE_ENV=production`, replacing any NODE_ENV of the helper's environment.

**GO-06** (2650457), installer HTTPS modes and firewall.

(M12 replaced modes A and B: see As built (M12).)

Code: Port detection, the proposal, the choice and step 13 "HTTPS method":
`helper/internal/install/https.go` (`ss -ltnpH` through host, `checkHTTPSPorts` moved here from
preflight.go, `chooseHTTPS` moved here from questions.go); Mode B site configs:
`helper/internal/install/proxy.go` and the templates `helper/deploy/proxy/nginx.conf`,
`xdesign.caddy`, `apache.conf`; certbot: `helper/internal/install/certbot.go` (from xWriter's
`internal/cli/certbot.go`) and `helper/deploy/hooks/certbot-deploy-xdesign.sh` (from xWriter's
`certbot-deploy-xwriter.sh`); `helper/deploy/embed.go` embeds `proxy` and `hooks` (`deploy.Proxy`,
`deploy.CertbotHook`); Firewall: `helper/internal/install/fwdetect.go` and `firewall.go` (from
xWriter's `fwdetect.go`, `firewall.go` and `fwcommand.go`, cut to ufw and firewalld); Fedora SELinux
boolean and port label: `helper/internal/install/selinux.go`; install.json records: `StateHTTPS`,
`StateFirewall` and the new `StateSELinux` fields in `helper/internal/install/state.go`; The HTTPS
manager's first state file: `ssl.FirstState` in `helper/internal/ssl/state.go`; Wiring: `steps.go`,
`weights.go`, `output.go` (sections, end warnings), `questions.go` (summary), `installer.go`
(`askSystem` in the --yes path), `service.go` (`lowPorts` replaces `bindsLowPort`, step numbers).

- Steps (after GO-07's): 1 Preflight checks, 2 System user, 3 Folders, 4 Program files, 5 SELinux
  labels, 6 Settings, 7 systemd units, 8 Enable at boot, 9 Restore the backup, 10 Database
  migrations, 11 Owner account, 12 SELinux network, 13 HTTPS method, 14 Start and health check, 15
  Web server, 16 Firewall, 17 Finish. Sections: 12, 13, 14 and 15 under ":: Starting xDesign...", 16
  under ":: Finishing...". GO-07's step numbers 1 to 11 are unchanged.
- Preflight (no config.toml yet): ports 443 and 80 probed as before and named with `ss -ltnpH` (" ->
  ports  443 (nginx) and 80 (nginx) in use"); nginx, caddy, httpd or apache2 on either port is the
  web server of mode B. Every run: " -> firewall  ufw is active" (or "firewalld is active", "none
  active"), firewalld checked first.
- The proposal (" -> HTTPS  ..."): "Ports 80 and 443 are free: xDesign will serve HTTPS itself."
  (mode A); "nginx runs on this server: xDesign will run behind it on its own domain." (also
  "Caddy", "Apache"; mode B, only with a domain name); "Another program (<name>) uses port 443:
  xDesign will use port <n>." (mode C; port 80 when only port 80 is held, then mode C uses 443;
  "Another program uses port 443" when ss names none). Then ":: Use this HTTPS mode? [Y/n]"; n lists
  "1  xDesign serves HTTPS itself on ports 443 and 80", "2  behind nginx on this server, on its own
  domain", "3  xDesign serves HTTPS itself on another port, which the address includes" and asks "::
  HTTPS mode [<n>]:" (a mode the server cannot use is refused with its reason); mode C then asks "::
  HTTPS port [<n>]:". `--https-port N` still picks mode C on N ("xDesign will use port N.").
- Mode C's port: 443 when only port 80 is held, else 8443 when free, else a random free port from
  20000 to 60999 (xWriter's). Port 80 free in mode C: xDesign answers Let's Encrypt on it and the
  unit keeps `CAP_NET_BIND_SERVICE`; port 80 held: the built-in certificate, with the note "Another
  program (<name>) uses port 80, so Let's Encrypt cannot check this server over it: xDesign starts
  with its built-in certificate. For a certificate browsers trust, choose "Let's Encrypt through
  Cloudflare DNS" in Settings > HTTPS."
- Mode B listens on `127.0.0.1:<random free port from 20000 to 60999>`.
- Step 13 HTTPS method (modes A and C, after the restore of step 9, so a restored state.json of the
  same domain is kept): `/var/lib/xdesign/certs` (xdesign 0700) and `state.json` (xdesign 0600) with
  `letsencrypt_http` for the domain (status issuing) when the site has a domain name and xDesign
  answers on port 80, else `builtin`; an existing state.json is kept.
- Questions after the HTTPS mode, in this order (also in a reinstall that keeps config.toml; never
  in a repair): Caddy ":: Add the line "import /etc/caddy/xdesign.caddy" to /etc/caddy/Caddyfile?
  [Y/n]"; nginx and Apache without `/etc/letsencrypt/live/<domain>/fullchain.pem` and without
  certbot or its plugin (`certbot plugins` lists "* nginx" or "* apache"): ":: Install certbot from
  the system packages? [Y/n]" (certbot and python3-certbot-nginx or python3-certbot-apache, plus
  mod_ssl for Apache on Fedora without `00-ssl.conf`; "Install mod_ssl from the system packages?
  [Y/n]" when only that is missing); ":: Open port <n> in the firewall? [Y/n]" for each port the
  site needs (443 and 80 in modes A and B, mode C's port and 80 when xDesign answers on it) that the
  active ufw or firewalld does not allow; SELinux enforcing: mode B ":: Let nginx connect to xDesign
  under SELinux (setsebool -P httpd_can_network_connect 1)? [Y/n]" when the boolean is off, modes A
  and C ":: Label port <n> for HTTPS under SELinux (semanage port -a -t http_port_t -p tcp <n>)?
  [Y/n]" (`-m` when another type holds the port) when the port is not http_port_t. `--yes` and dry
  runs answer yes. The summary adds " -> web server  writes <file> and reloads nginx" and " ->
  firewall  opens TCP ports 443 and 80 in ufw".
- Step 12 SELinux network: `setsebool -P httpd_can_network_connect 1`, `semanage port -a|-m -t
  http_port_t -p tcp <n>`, both in the install log.
- Step 15 Web server (mode B, after the health check): nginx `/etc/nginx/conf.d/xdesign.conf` on
  Fedora and when nginx.conf includes `conf.d/*.conf`, else
  `/etc/nginx/sites-available/xdesign.conf` and the link `sites-enabled/xdesign.conf`; Caddy
  `/etc/caddy/xdesign.caddy` and the import line appended to the Caddyfile under "# Added by the
  xDesign installer."; Apache `/etc/httpd/conf.d/xdesign.conf` on Fedora,
  `/etc/apache2/sites-available/xdesign.conf` with its link and `a2enmod -q` for the modules not
  enabled yet on Debian and Ubuntu. Files root:root 0644. nginx and Apache without the certificate:
  apt-get update and install (or dnf install) of the packages allowed, the site config with only its
  port 80 part (marked "# Waiting for the certificate: ..."), config test, reload, `certbot certonly
  --nginx|--apache -d <domain> --cert-name <domain> --non-interactive --agree-tos
  --register-unsafely-without-email --keep-until-expiring`, then the whole site config with
  `/etc/letsencrypt/live/<domain>/fullchain.pem` and `privkey.pem`, config test, reload, and the
  deploy hook `/etc/letsencrypt/renewal-hooks/deploy/50-xdesign.sh` (root 0755, reloads the web
  server's unit for that lineage; a file there that xDesign did not install is left alone with a
  warning). Tests: `nginx -t`, `caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile`,
  `apachectl configtest`; reload `systemctl reload nginx.service`, `caddy.service`,
  `apache2.service` or `httpd.service`. A site config in place (without the waiting mark) is kept.
- Failure in step 15 (packages, modules, a test, a reload, certbot) or a declined question: the link
  and the site config are removed, the Caddyfile is written back as it was, the modules enabled in
  this run are disabled, the web server reloads; a warning says why and lists what to do by hand
  (the certbot command when the certificate is missing, the path, the link, a2enmod, the import
  line, the test and the reload) and a note prints the whole site config. The step and the
  installation go on; the end adds "warning: nginx does not pass the site to xDesign yet: add the
  site config that the step "Web server" showed", and install.json says `"manual": true`. Installed
  packages stay.
- The site configs: nginx has port 80 redirect to https (in `location /`, so certbot's challenge
  location wins), 443 with `client_max_body_size 2048m`, HTTP/1.1, Host, X-Forwarded-For,
  X-Forwarded-Proto and X-Forwarded-Host, Upgrade and Connection from a map named
  `$xdesign_connection` at server level, and `/live` and `/mcp` without buffering with 1 h timeouts.
  Caddy: `<domain> { reverse_proxy 127.0.0.1:<port> { flush_interval -1 } }`. Apache: port 80
  `RedirectMatch` to https except `/.well-known/acme-challenge/`, 443 with `SSLEngine`,
  `LimitRequestBody 2147483647`, `ProxyPreserveHost On`, `RequestHeader set X-Forwarded-Proto
  "https"`, `ProxyTimeout 3600`, `ProxyPass /live ws://...`, `ProxyPass /mcp http://...
  upgrade=websocket flushpackets=on`, `ProxyPass /` and `ProxyPassReverse /`.
- Step 16 Firewall (after step 15): `ufw allow <n>/tcp comment xDesign` or `firewall-cmd --permanent
  --add-port=<n>/tcp` and `firewall-cmd --reload` for the ports allowed; a repair leaves the
  firewall alone. The end's warning names the site's ports: "if your hosting provider has a
  firewall, allow TCP ports 443 and 80 there too" with an active firewall, else GO-05's sentence.
- install.json gets `https` (`mode`, `port_80`, `state_file`, `web_server`, `files`, `links`,
  `imported`, `modules`, `packages`, `certificate`, `manual`), `firewall` (`tool`, `ports`) and in
  `selinux` `httpd_can_network_connect`, `http_ports_added`, `http_ports_modified`, each written as
  the step changes the system.

**GO-07** (aa585ad), backups and restore.

Code: Backups: `helper/internal/backup/` (`doc.go`, `meta.go` the metadata and its checks, `make.go`
Make with VACUUM INTO, `read.go` the strict reader Read, Open, Check and the unpacking, `list.go`
List, Find, Delete and the retention, `restore.go` Restore and PutBack); `modernc.org/sqlite
v1.59.0` added to `helper/go.mod`; Commands: `helper/internal/cli/cmd_backup.go` (RunBackup,
RunRestore), `helper/internal/app/cmd_backup.go`, the backup and restore entries of
`helper/internal/app/app.go`; Units: `helper/deploy/systemd/xdesign-backup.service` and
`xdesign-backup.timer` (from xWriter's `xwriter-backup.*`), embedded by `helper/deploy/embed.go`;
Installer: `helper/internal/install/restore.go` (the restore question, step 9 "Restore the backup",
`BackupOptions`, `Service`, the backup units); edits in `questions.go` (old askRestore removed,
owner questions skipped, summary), `steps.go`, `weights.go`, `output.go`, `installer.go` (one
field), `service.go` (steps 7 and 8 with the backup units, steps renumbered 10 to 13,
`checkHealth`); Control socket: `helper/internal/control/backups.go`, one line in `routes.go`,
`Backups` in `control.Options` (`server.go`), the endpoint list in `doc.go`; `backupOptions` and
`configPath` in `helper/internal/app/cmd_serve.go`; Lint: `internal/backup` added to the exceptions
of `archives-only-in-unpack` in `helper/.golangci.yml` (zstd).

- A backup is `<data_dir>/backups/xdesign-<YYYYMMDDTHHMMSSZ>.tar.zst` (daily and manual) or
  `pre-update-<version, + written _>-<time>.tar.zst`, each with `<name>.json`; `-2`, `-3` and so on
  when the name is taken. Partial files are `.<file>.partial`; the retention removes those older
  than a day. `.lock` in the folder lets one backup or restore run at a time; when root takes it, it gives the file to the data folder's owner, so the `xdesign` user's daily backup can open it.
- The archive's members, in order: `backup.json` (`format` 1, `name`, `version`, `created_at`,
  `kind` daily, manual or pre-update, `parts` database, config, media and certs each with `size` and
  `files`, `files` each with `path`, `size` and `sha256`), `xdesign.db` (VACUUM INTO on a `mode=rw`
  connection with a 30 s busy timeout), `config.toml`, `media/...` (without `media/tmp`),
  `certs/...` (the HTTPS manager's folder); regular files only, mode 0600. The `.json` next to it is
  the same metadata with `archive` (its size and SHA-256), so a downloaded `.tar.zst` restores
  alone.
- Limits of the reader: metadata 64 MiB, `xdesign.db` 64 GiB, `config.toml` and each file of
  `certs/` 1 MiB, a media file 8 GiB, 512 GiB together, 200,000 files, names of 1,024 bytes at most,
  a zstd window of 64 MiB, 64 KiB after the archive. A member that is not a regular file, is sparse,
  is not listed, comes twice, has another size or SHA-256, or a listed member that is missing, is
  refused; names are exactly `xdesign.db` and `config.toml` or clean relative paths below `media/`
  (not `media/tmp/`) and `certs/`.
- Retention after every backup: the newest 14 daily and manual backups together and the newest 3
  pre-update backups; the newest backup always stays. The backup a restore makes first runs no
  retention.
- Root's backups (and restored files) get the owner of the data folder; root's restored
  `config.toml` is root:xdesign 0640.
- `xdesign backup [--daily] [--json] [--config FILE]`, as root or the xdesign user (others: "xdesign
  backup: run it as root (sudo xdesign backup) or as the xdesign user"): ":: Backing up xDesign...",
  " -> backup   <path> (<size>)", " -> deleted  <name> (the newest 14 daily and manual and 3
  pre-update backups are kept)"; `--json` prints `{"backup": {...}, "path", "deleted"}`.
- `sudo xdesign restore FILE [--yes]` (root only): it reads the metadata, refuses a newer xDesign
  ("This backup is from xDesign <v>. Update to <v> or later first."), shows " -> backup   <name>
  (<kind>, xDesign <v>, <size>, made <time> UTC)" and what is replaced, asks ":: Restore this
  backup? [y/N]", then prints ":: Checking the backup...", ":: Making a backup of the site
  first...", ":: Unpacking the backup...", ":: Stopping xDesign...", ":: Putting the backup in
  place...", ":: Running the database migrations...", ":: Starting xDesign...", ":: xDesign was
  restored from <file>." and " -> before   <pre-update archive> (the site as it was before the
  restore)". A failure after the stop prints ":: The restore failed: ...", ":: Putting the site back
  as it was before the restore..." and the same phases with the pre-update backup (also when the
  restore was interrupted); before the stop nothing is changed.
- Before anything, the whole file is checked, its `config.toml` must pass `config.Parse`, and the
  data folder must have the unpacked size plus 64 MB free. The backup is unpacked into
  `<data_dir>/.restore-<time>/new` (0700), the replaced files go to `.../old`, and the folder is
  removed at the end. `xdesign.db` is replaced with its `-wal` and `-shm` moved away; `media` and
  `certs` are replaced as whole folders; `config.toml` is written through `config.toml.restore` and
  a rename. The start is `systemctl reset-failed`, `systemctl start xdesign.service`, then
  `systemctl is-active` and `/api/health` every second as the installer's, up to 45 s.
- Installer: ":: Do you have an xDesign backup to restore? [y/N]"; yes asks ":: Path to the backup
  file (a .tar.zst from Maintenance > Backups or xdesign backup):", checks the whole file at once
  (an error and the question again) and prints " -> backup  <description>". The domain and HTTPS
  questions are still asked; the owner questions are skipped. The summary shows " -> restore
  <file>: the database, the media[ and the certificates], and its owner and accounts" and " -> owner
  the backup's site owner". Step 9 "Restore the backup" (skipped with "no backup to restore") puts
  the database, the media and, when the backup's `config.toml` names the same domain, the
  certificates in place; the settings stay the installer's. The migrations then bring an older
  database up to date, the owner step finds the backup's owner, and the end shows its email with
  "Password: unchanged (...)".
- Installer steps: 7 "systemd units" (`xdesign.service`, `xdesign-backup.service`,
  `xdesign-backup.timer`), 8 "Enable at boot" (also `systemctl enable --now xdesign-backup.timer`;
  its fact "xDesign starts at boot, and backs up daily at 03:30"), 9 "Restore the backup", 10
  "Database migrations", 11 "Owner account", 12 "Start and health check", 13 "Finish".
- `xdesign-backup.service`: oneshot, User and Group xdesign, `ExecStart=/opt/xdesign/current/xdesign
  backup --daily --config /etc/xdesign/config.toml`, `Nice=10`, `IOSchedulingClass=idle`,
  `TimeoutStartSec=6h`, `UMask=0077`, the hardening of `xdesign.service` without its capability,
  plus `PrivateNetwork=yes`, `RestrictAddressFamilies=AF_UNIX` and `MemoryDenyWriteExecute=yes`.
  `xdesign-backup.timer`: `OnCalendar=*-*-* 03:30:00`, `AccuracySec=1min`, `Persistent=true`, no
  random delay.
- Control socket: `GET /backups` answers `{"backups": [{"name", "file", "kind", "version",
  "created_at", "size", "parts"}], "space_used", "running"}` (newest first; `space_used` counts
  every file of the folder); `POST /backups` makes a manual backup and answers 201 with its entry,
  409 "A backup is being made or restored now: try again when it is done." or 500 "The backup
  failed: ..."; `GET /backups/<name>` streams the `.tar.zst` (`application/zstd`, attachment,
  ranges); `DELETE /backups/<name>` deletes the `.json` then the archive and answers `{"deleted":
  "<name>"}`, or 404 "There is no backup named <name>.". `serve --dev` keeps them in
  `.dev/data/backups` with the certificates of `.dev/certs` and no settings file.

**GO-08** (e7cc006, 79c476e), updates and going back.

Code: Request files: `helper/internal/maintreq/maintreq.go` (from xWriter's `internal/cli/maintreq`,
cut to `update`, `rollback` and `restore`); serve's side: `helper/internal/maintenance/`
(`helper.go` state, status, Submit; `upload.go` BeginUpload, AddFile; `check.go` CheckUpload with
unpack, checksum, signature, build information, version rules, space; `updates.go` releases,
StartUpdate, StartRollback, GoBack, prune, discard), from xWriter's `services/maintenance`
`helper.go`, `update_upload.go`, `update.go`, `update_check.go`, `update_unpack.go`; Control socket:
`helper/internal/control/maintenance.go`, one line in `routes.go`, `Maintenance` in
`control.Options` (`server.go`), the endpoint list in `doc.go`; Root helper:
`helper/internal/cli/cmd_maintenance.go` (from xWriter's `cmd_maintenance.go` and
`maintenance_kinds.go`), `helper/internal/cli/owned_linux.go` and `owned_other.go` (xWriter's
ownedDir from `panel_restore_linux.go`, cut); Units:
`helper/deploy/systemd/xdesign-maintenance.path` and `.service` (from xWriter's
`xwriter-maintenance.*`, without PostgreSQL), embedded by `helper/deploy/embed.go`; Update and going
back: `helper/internal/install/update.go` (stage 1, the installer's hand-over), `update_stage2.go`
(stage 2 and the automatic going back), `rollback.go`, `goback.go` (kept releases, prune, stop,
failure log), `maintenance.go` (the maintenance units), from xWriter's `update.go`,
`update_stage2.go`, `rollback.go`, `goback.go`, `releases.go`, `maintenance.go`; Start-count guard:
`helper/internal/guard/guard.go` (from xmtp-panel's `internal/panel/selfupdate/guard.go`); Commands:
`helper/internal/cli/cmd_update.go` (RunUpdate, RunRollback), `helper/internal/app/cmd_update.go`
(update, rollback, admin maintenance), the entries of `helper/internal/app/app.go`; `Upgrade` (the
WebSocket check) in `helper/internal/cli/cli.go` and `osenv.go`; StartGuard, Confirm and the
maintenance options in `helper/internal/app/cmd_serve.go`; Files of `helper/internal/install/` that
GO-06 may also touch: `installer.go` (the `Upgrade` field and the `ModeUpdate` hand-over, 5 lines),
`preflight.go` (the `ModeUpdate` case: a note instead of the refusal), `service.go` (stepUnits
installs the two maintenance units; stepEnable enables the path unit), `doc.go` and `releases.go`
(comments only). New files only otherwise; `weights.go` and `steps.go` are not touched (the update's
and the rollback's step lists are in `update.go` and `rollback.go`).

- `sudo xdesign update FILE [--dry-run] [--sha256 SUM] [--yes] [--json] [--no-color] [--log FILE]`
  (FILE before or after the flags; the default log is `/var/log/xdesign-install.log`). Sections "::
  Checking the update...", ":: Installing xDesign <new>...", ":: Starting xDesign <new>...", "::
  Finishing...", and after a failure ":: Going back to xDesign <old>...". Steps: 1 Installed
  version, 2 Checksum and signature, 3 Build information, 4 Version rules, 5 Disk space (stage 1);
  the question ":: Update xDesign <old> to <new>? [Y/n]"; 6 Program files, 7 Backup before the
  update, 8 Stop xDesign <old>, 9 Database migrations, 10 systemd units, 11 Switch to <new>, 12
  Start and health check, 13 Finish (stage 2); R1 to R4 going back. The end: ":: xDesign <new> runs
  now." with " -> from", " -> backup", " -> go back  sudo xdesign rollback --to <old>". `--json`
  prints xWriter's step and progress lines and one object (`status` updated, rolled_back, failed or
  planned, `from`, `to`, `rolled_back`, `backup`, `failed_step`, `log`, `failure_log`, `error`).
- Stage 1 runs in the file that was started. It copies FILE into a private folder where programs may
  run (`MakeExecDir`: `/var/tmp/xdesign-update-*`, else `/opt/xdesign/releases/.staging-scratch-*`),
  opening a tar.gz, zip, tar.xz or tar.zst with internal/unpack on the way; checks it against
  `SHA256SUMS` next to FILE (or inside the packed file) and `--sha256` (of the file or of the packed
  file), a file without either passing with a warning ("Checksum: not given"); checks
  `SHA256SUMS.sig` with `release.CheckSignature` (a valid signature must cover the file); reads the
  build information from the symbol table; refuses another CPU, the same version, an older one ("Go
  back with sudo xdesign rollback --to <v>"), a development build over a release, a running version
  below `min_upgrade_from`, and a file without a payload; needs four times the file plus 100 MB free
  under /opt and the database and media plus 64 MB free in the data folder. Then it runs the copy:
  `<copy> update --stage 2 --from <old> --checksum <text> --signature <text> [--json --yes] [--log]
  <copy>`, with the first stage's step times in `XD_UPDATE_STEPS`.
- Stage 2 runs in the new file's own code and ignores SIGINT, SIGHUP, SIGTERM and SIGPIPE. Program
  files: `/proc/self/exe release-files /opt/xdesign/releases/.staging-<8>` renamed to
  `releases/<new>` (a complete earlier copy is kept, a damaged one replaced), with `restorecon -R
  -F` and `chcon -t bin_t` when install.json says SELinux is on. The backup is
  `backup.Make(pre-update)` of the old version. The migrations run `runuser -u xdesign -- env -C
  /opt/xdesign/releases/<new> XD_DATA_DIR=/var/lib/xdesign NODE_ENV=production .../runtime/node
  .../app/cli.mjs migrate`. The units are xdesign.service (fitted to the site's port), the backup
  units and the maintenance units, written where they differ, then `daemon-reload` and `systemctl
  enable --now xdesign-maintenance.path` unless masked. The switch writes the guard's marker, then
  `current -> releases/<new>` and `/usr/local/bin/xdesign`. The health check (up to 120 s, every
  second): the unit active, `GET /api/health` 200 with `"ok": true` and `"version": "<new>"`, and a
  WebSocket upgrade of `/live` with the site's Origin answered 101 or 401. Finish: install.json
  `current_version` and an `update` history entry with the step times; the releases other than the
  new one, the old one and the newest others up to 3 are removed, and staging folders too.
- Going back by itself (a step after the stop failed): the journal (`journalctl -u 'xdesign*' -n
  200`) with a header saved to `/var/lib/xdesign/update-failures/<YYYYMMDDTHHMMSSZ>.log` (root 0700
  folder, 0600 file), xdesign.service stopped, the marker removed, `current` back, the database and
  the media of the pre-update backup put back (backup.PutBack, then the old app's migrate) only when
  the migrations ran and the new build's schema floor is above the old version, the old release
  started with the same health check. The result says "The update went back by itself. xDesign <old>
  runs. The log is in <file>" and install.json gets `rolled_back`. A failure before the stop records
  `failed` and says "Nothing was changed: xDesign <old> runs as before.". When going back fails too,
  xDesign stays stopped and the end names `sudo xdesign rollback --to <old> [--restore-db]`.
- `sudo xdesign rollback [--to VERSION] [--restore-db] [--yes] [--json] [--no-color] [--log FILE]`:
  sections ":: Checking the rollback...", ":: Going back to xDesign <v>...", ":: Finishing...";
  steps 1 Release to go back to (default: the newest older version of install.json's history that is
  kept, else the newest older kept release; refused when newer, the same, not kept, damaged or of
  another CPU), 2 Database (below the running release's schema floor it needs `--restore-db`), the
  question ":: Go back from xDesign <cur> to <v>? [Y/n]", 3 Backup of the site now (with
  `--restore-db`), 4 Stop, 5 Switch (the marker removed), 6 Restore the data (the database and the
  media of the newest pre-update backup of <v>, then migrate), 7 Start and health check, 8 Finish
  (`rollback` history entry). A failure after the stop starts the release that ran again, with the
  safety backup's data when it was replaced.
- `sudo ./xdesign --install` over an older installation now notes " -> xdesign <old> is installed,
  older than this <new>: it is updated as sudo xdesign update <file> does" in its preflight and
  hands the run to the update with its own file and its --yes, --json, --dry-run, --log and
  --no-color.
- The installer's step 7 installs `xdesign-maintenance.service` and `.path` too, and step 8 runs
  `systemctl enable --now xdesign-maintenance.path` (unless masked).
- The root helper `xdesign admin maintenance --request /var/lib/xdesign/maintenance/request.json`
  (root only; the data folder from `/etc/xdesign/config.toml`) keeps xWriter's rules: the folder and
  files opened once without following links and checked as the xdesign user's, the request claimed
  (deleted) at once, at most an hour old and of this file's version. An update copies the upload
  into `/var/tmp/xdesign-maintenance-*` (the unit's private /var/tmp), checks its SHA-256 against
  the request, and runs `update --yes --json --sha256 <sum> <copy>` in its own process with unlinked
  output files; a rollback runs `rollback --to <v> --yes --json [--restore-db]`. progress.json
  follows the step events (at once) and the percent and detail (every 2 s at most); result.json ends
  it: "xDesign was updated from <a> to <b>. xDesign <b> runs now.", the going-back text with
  `rolled_back`, "xDesign went back from <a> to <b>. xDesign <b> runs now.", "The update to <b> did
  not start, so it went back by itself. xDesign <a> runs." for the guard, "The update failed: ..."
  or "The request was refused: ... Nothing was changed.". `restore` requests are refused ("not built
  yet: restore on the server with sudo xdesign restore FILE").
- `xdesign-maintenance.path`: `PathExists=/var/lib/xdesign/maintenance/request.json`,
  `WantedBy=multi-user.target`. `xdesign-maintenance.service`: oneshot, root,
  `ExecStart=/opt/xdesign/current/xdesign admin maintenance --request
  /var/lib/xdesign/maintenance/request.json`, `TimeoutStartSec=12h`, `UMask=0077`, `PrivateTmp=yes`,
  `ProtectHome=yes`, `LimitCORE=0`.
- Maintenance folder (`/var/lib/xdesign/maintenance`, xdesign 0700): `uploads/<32 hex>/` with the
  xdesign file under its name made safe, `SHA256SUMS`, `SHA256SUMS.sig` and `.check.json`;
  `request.json` (written as `.request.json.partial` then renamed), `progress.json`, `result.json`.
  Request: `id`, `kind`, `requested_at`, `panel_version` (serve's version), `from_build` (`version`,
  `commit`, `built_at`, `started_at`), `update` (`upload`, `file`, `sha256`, `sums`, `sig`) or
  `rollback` (`to`, `restore_db`, `guard`); strict decoding. Uploads: at most 512 MiB plus two files
  of 64 KiB, two arriving at once, 1 GiB left free; a checked upload waits 30 minutes, one that was
  sent 70 minutes; they are pruned at each upload and each GET /maintenance.
- Control socket: `GET /maintenance` (`helper` state ready, off, missing or development with its
  message, `pending`, `progress`, `last`, `running`); `GET /maintenance/releases` (`keep_releases`,
  `running`, `schema_floor`, `previous` with `version`, `installed_at`, `rollback` allowed,
  needs_restore or missing, `backup`, `note`); `POST /maintenance/uploads` (multipart `files` and
  `sha256`; answers the check: `upload_id`, `expires_at`, `file`, `size_bytes`, `sha256`,
  `packed_as`, `inside`, `outer_sha256`, `version`, `from_version`, `commit`, `built_at`, `arch`,
  `development_build`, `min_upgrade_from`, `schema_floor`, `checksum` matches, not given or does not
  match, `checksum_source`, `signature` valid, not signed or invalid, `rows`, `warnings`,
  `refusal`); `GET` and `DELETE /maintenance/uploads/<id>`; `POST /maintenance/update`
  `{"upload_id"}` and `POST /maintenance/rollback` `{"to", "restore_data"}` (202 with the request).
  Refusals are 400, 409 or 413 with `{"error"}`. The rows are "<old> to <new>", "System: <Linux or Windows>", "CPU: <arch>",
  "Checksum: <result>", "Signature: <result>", "Disk space: enough", "Can update from <old>: yes".
- The guard's marker is `/var/lib/xdesign/update-guard.json` (xdesign 0600): `from`, `to`, `sha256`,
  `old_sha256`, `deadline` (10 minutes after the switch, or after the first start), `watched_until`
  (the switch plus 120 s and 5 minutes), `restore_db`, `starts`, `asked`. serve calls StartGuard
  right after its first log line (not with --dev), Watch at once, and Confirm once the app answers
  its health check through the front.

**GO-09** (f954453), status, admin, uninstall, domain, restore.

(M12 replaced modes A and B: see As built (M12).)

Code: `xdesign status`: `helper/internal/cli/cmd_status.go`; the measurements in the new package
`helper/internal/status/status.go` (storage, backups, HTTPS); GET /status extended in
`helper/internal/control/status.go`; `control.SocketPath` and `Options.Mode` in `server.go`;
`install.CheckHealth` in `install/service.go`; `cmdStatus` in `helper/internal/app/cmd_update.go`
and its entry in `app.go`; `xdesign admin reset-password <email>` and `admin list-users`:
`helper/internal/cli/cmd_admin.go` (RunAppCommand), `install.AppCommand` in `install/service.go`,
`cmdAdmin` in `app/cmd_update.go`; `xdesign --uninstall`: `helper/internal/install/uninstall.go`
(from xWriter's `install/uninstall.go`, `cmd_uninstall.go` and `deploy/uninstall.sh`, cut),
`helper/internal/cli/cmd_uninstall.go`, `cmdUninstall` in `app/cmd_update.go` and the `--uninstall`
case of `app.go` (`notBuilt` removed); The domain change: `helper/internal/install/domain.go`
(`Updater.ChangeDomain`, reusing proxy.go's planProxy, configureProxy and undoProxy),
`config.CheckDomain` and `config.IsIP` in `helper/internal/config/validate.go`, `StartDomain` in
`helper/internal/maintenance/requests.go`, `Domain` and `HTTPSMode` in `maintenance.Config`, `PUT
/https/domain` in `control/https.go`, the `domain` kind in `maintreq` and the root helper's `domain`
in `cli/cmd_maintenance.go`; The restore through the root helper: the `restore` kind with its part
in `helper/internal/maintreq/maintreq.go`, the root helper's `restore` and `stageBackup` in
`cli/cmd_maintenance.go`, `StartRestore` in `maintenance/requests.go`, `POST
/backups/{name}/restore` in `control/backups.go`; Mode B's Settings > HTTPS: `install.ProxySite` in
`install/https.go`, `status.ProxyHTTPS`, GET /https's mode B answer in `control/https.go`.

- `xdesign status [--json] [--config FILE]`, as root or the xdesign user (others: "xdesign status:
  run it as root (sudo xdesign status) or as the xdesign user"). It asks GET /status on
  `/run/xdesign/control.sock` (5 s), `systemctl is-active xdesign.service`, and `/api/health`
  through the front as the installer's health check does. Lines: ":: xDesign <version>", " -> mode"
  ("builtin: xDesign serves HTTPS itself on ports 443 and 80", "port: xDesign serves HTTPS itself on
  port <n>", "proxy: behind nginx on this server"), " -> address", " -> front" ("running for 2 days
  3 h (since <time> UTC); xdesign.service is active", or "not running: xdesign.service is inactive
  (journalctl -u xdesign -n 50 --no-pager says why)"), " -> app" (state, process, restarts, last
  exit), " -> health" ("the website answers /api/health" or "the website does not answer: ..."), "
  -> database", " -> media" ("<size> in <n> files"), " -> disk" ("<size> free in /var/lib/xdesign"),
  " -> backups" (count and space, then the newest 3 with kind, time and size, or "none yet (sudo
  xdesign backup makes one)"), " -> https" (the method in the plan's words, its state and "the
  certificate expires <date> UTC (in <n> days ...)" with the last problem; mode B: "HTTPS is handled
  by nginx on this server. Its site config: <file>"). While serve does not answer, the version is
  the installed release's and the sizes, backups and mode B's HTTPS come from the files; the HTTPS
  of modes A and C says "not known while xDesign does not run". `--json` prints GET /status with
  `running`, `service` and `health`.
- GET /status adds `uptime_seconds`, `storage` (`data_dir`, `database_bytes` with -wal and -shm,
  `media_bytes`, `media_files`, `free_bytes`, `problem`), `backups` (`count`, `space_used`, `last`
  the newest 3 entries, `running`, `problem`) and `https` (`method`, `state`, `names`, `expires_at`,
  `last_problem`; mode B `web_server`, `config_file`, `message`), measured at each request.
- `sudo xdesign admin reset-password <email>` and `sudo xdesign admin list-users`, as root or the
  xdesign user: `runuser -u xdesign -- env -C /opt/xdesign/current XD_DATA_DIR=/var/lib/xdesign
  NODE_ENV=production /opt/xdesign/current/runtime/node /opt/xdesign/current/app/cli.mjs <command>`
  (the xdesign user runs it without runuser); the app's output streams through and its exit status
  is the command's.
- `sudo xdesign --uninstall [--keep-data | --remove-everything] [--backup | --no-backup]
  [--undo-selinux] [--yes] [--json] [--dry-run] [--no-color] [--log FILE]`; `--yes` needs one of the
  first two and makes a backup unless `--no-backup`; `--json` needs `--yes`. Questions: "   1  Keep
  the data: ..." and "   2  Remove everything: ..." with ":: Keep the data or remove everything?
  [1]:"; ":: Make a backup first (it stays in /var/lib/xdesign/backups)? [Y/n]" (with Remove
  everything: "it is saved in /root/xdesign-final-<time>/, outside the data that is deleted"; asked
  only when a database exists); ":: Undo the SELinux settings xDesign made (setsebool -P
  httpd_can_network_connect 0; semanage port -d -t http_port_t -p tcp <n>)? Other programs may need
  them. [y/N]" (only when install.json records any); ":: Uninstall xDesign and keep its data? [Y/n]"
  or ":: Remove xDesign and all its data for good? [y/N]".
- Uninstall steps (sections "Checking what is installed...", "Uninstalling xDesign...",
  "Finishing..."): 1 What is installed, 2 Backup first (a manual backup; with Remove everything
  copied root 0600 into `/root/xdesign-final-<UTC time>/` 0700 with its .json), 3 Stop and disable
  the services (the path and timer units first), 4 Remove the unit files
  (`/etc/systemd/system/xdesign*.service|.timer|.path`, daemon-reload, reset-failed), 5 Web server
  (install.json's links, the site config files, the Caddyfile's import line with its "# Added by the
  xDesign installer." mark, `a2dismod -q -f` of the recorded modules, then the config test and the
  reload; when the test fails with the modules off they are enabled again with a warning, and a test
  that still fails is a warning with what to do, not a failure), 6 Certbot hook (only with "#
  Installed by xDesign."), 7 Firewall rules (`Firewall.Close` for each recorded port when the same
  tool is active; another tool is a manual note), 8 SELinux settings (only when asked: `setsebool -P
  httpd_can_network_connect 0`, `semanage port -d` of the added ports), then Keep the data: 9 Record
  the uninstall (install.json "uninstalled" with a history entry), Remove everything: 9 Delete the
  data and the settings (`/var/lib/xdesign`, `/etc/xdesign`), 10 Delete the xdesign system user
  (userdel, groupdel, the sysusers file); last Remove the program (`/usr/local/bin/xdesign` when it
  is the installer's link, `/opt/xdesign`). Each step is skipped when there is nothing of it, so a
  run that stopped runs again. The end: ":: xDesign was uninstalled. Its data was kept." or "::
  xDesign and its data were removed from this server.", " -> backup", ":: What remains:" (the kept
  folders and user, the final backup with scp, certbot's certificate with `certbot delete
  --cert-name <domain>`, the packages with `apt-get purge` or `dnf remove`, SELinux settings not
  undone, ports moved with `semanage port -m`, manual notes, the log), and the reinstall line.
  `--json`: `status` uninstalled, removed, planned or failed, `mode` keep or remove, `backup`,
  `remains`, `failed_step`, `log`, `error`.
- The domain change: `PUT /https/domain` `{"domain"}` in every mode answers 202 with the request, or
  400 ("Enter the site's domain, ...", "<x> is not a domain or an IP address: ...", and in mode B
  "Behind the web server of this server the site needs a domain name, for example
  design.example.com.") or 409 ("xDesign already uses <domain>.", a request waiting or running, the
  helper off). The root helper runs the domain change in its process with `--json`: 1 New domain
  (install.json installed, config.toml, the check again), 2 Web server (mode B with a site config
  the installer wrote: planProxy and configureProxy for the new domain: certbot's certificate for
  nginx and Apache with the port 80 part first, the whole site config, the test, the reload, the
  deploy hook for the new lineage; a failure puts the old site config and hook back and reloads;
  without a recorded site config a warning says to change it by hand), 3 Settings (config.toml
  root:xdesign 0640 with the new domain, install.json), 4 Stop xDesign, 5 Start and health check
  (the update's: active unit, `/api/health` with the version, the `/live` upgrade, 120 s). A failure
  after a change runs B1 Settings from before, B2 Site config from before, B3 Start xDesign with
  <old domain>. Results: "The domain is <d> now. xDesign opens at <address>." with `address`; "The
  domain change failed, so xDesign went back to <old>: ..."; "The domain change failed: ...". GET
  /maintenance follows it (kind `domain`, "domain change" in the busy messages).
- The restore: `POST /backups/<name>/restore` answers 202 with the request, 400 "There is no backup
  named <name>.", 409 for a newer backup ("This backup is from xDesign <v>. Update to <v> or later
  first.") or a busy helper. The root helper opens the backups' folder and the archive once through
  ownedDir (the xdesign user's, no link), checks the free space next to its private folder
  (`/var/tmp/xdesign-maintenance-*`, the archive plus 64 MiB), copies the archive there as root 0600
  and runs `backup.Restore` on the copy with `install.Service`. progress.json steps: copy, check 5
  %, backup 15 %, unpack 40 %, stop 55 %, swap 60 %, migrations 70 %, start 85 %, failed, back.
  Results: "xDesign was restored from <name>. The backup made before the restore is <file>." with
  `backup`, or "The restore did not finish: <reason>." (Restore's reason says whether nothing was
  changed or the site runs as before).
- maintreq: kinds update, rollback, restore, domain, address; parts `restore` `{"backup"}`
  (backup.ValidName), `domain` `{"domain"}` (config.CheckDomain, already normalized) and `address`
  `{"port", "base_path"}` (1 to 65535 and not 80, config.CheckBasePath); `from_build` is left out
  for the three; result fields `backup` and `address`.
- GET /https in mode B: `{"mode": "proxy", "message": "HTTPS is handled by nginx on this server.",
  "web_server": "nginx", "config_file": "/etc/nginx/conf.d/xdesign.conf"}` from install.json
  (`https.web_server` and the first of `https.files` that is not the certbot hook); the PUT and POST
  refusals of mode B say the same message. Without a recorded web server the message stays "HTTPS is
  handled by the web server in front of xDesign on this server.".

**WEB-03** (aac6e51, 219a140), Settings > HTTPS and Maintenance.

(M12 replaced modes A and B: see As built (M12).)

Code: Control socket client: `apps/server/src/helper/control.ts` (`control` for JSON,
`controlStream` for a download, `fromHelper` for camelCase names and times in milliseconds);
`XD_CONTROL_SOCKET` in `apps/server/src/config.ts`; the error code `no_helper` (503) in
`packages/api/src/common.ts` and `apps/server/src/errors.ts`; Contract:
`packages/api/src/routes/https.ts` (https, chooseHttps, pasteCertificate, issueHttps, changeDomain),
`packages/api/src/routes/maintenance.ts` (serverStatus, maintenance, backups, makeBackup,
backupFile, deleteBackup, restoreBackup, uploadUpdate, updateCheck, discardUpdate, installUpdate,
releases, rollback), both in `packages/api/src/index.ts`; Server routes:
`apps/server/src/routes/https.ts`, `apps/server/src/routes/maintenance.ts`, registered in
`src/main.ts`; eight audit actions in `src/audit.ts`; "Confirm it's you":
`apps/web/src/components/ConfirmItsYouDialog.tsx` (xWriter's, password only, with optional children)
and `apps/web/src/components/useConfirmItsYou.tsx` (`useConfirmItsYou().ask`, `confirmPassword`,
`forgetConfirmation`); Reload banner: `apps/web/src/app/serverVersion.ts` (`noteServerVersion`,
`useNewServerVersion`) and `apps/web/src/app/ReloadBanner.tsx`, in `src/routes/__root.tsx`; Settings
> HTTPS: `apps/web/src/settings/HttpsCard.tsx` in `src/routes/_app/settings.tsx` (the placeholder is
gone); Maintenance: `src/routes/_app/maintenance.tsx` with `src/maintenance/StatusCard.tsx`,
`BackupsCard.tsx`, `UpdateCard.tsx`, `GoBackCard.tsx`, `UninstallCard.tsx` (M17), `download.ts` (a
backup's "Download", also the uninstall's "Download a backup"), `Tracker.tsx` (xWriter's tracker and a
progress bar), `follow.ts` (`useFollow`, `adoptRun`, `helperRetry`), `upload.ts` (the multipart
upload with progress), `parts.tsx`; `src/lib/format.ts` (xWriter's `formatBytes`, `formatDuration`);
Activity words for the new actions in `src/settings/activityText.ts`.
`src/components/ComingPage.tsx` removed (no page used it any more).

- The app reaches the helper on `XD_CONTROL_SOCKET` (HTTP with JSON on the Unix socket). Without it
  (`make dev`) every helper route answers 503 `no_helper` "The server helper is not running
  (development)."; a socket that does not answer gives `no_helper` "The server helper did not
  answer. Try again in a moment." The helper's refusals keep their words with 400 `bad_request`, 404
  `not_found`, 409 `conflict`, 413 `too_large` or 500 `server_error`. The helper's answers reach the
  browser with camelCase names and times in UTC milliseconds (the keys that end in _at, the bare at, not_before
  and not_after; Go's zero time as null), cut to the fields the pages use.
- Routes (site owner): `GET /api/https` (the site's address with the helper's view, or mode B's
  message, web server and site config), `PUT /api/https`, `POST /api/https/certificate`, `POST
  /api/https/issue`, `PUT /api/https/domain`, `PUT /api/address`; `GET /api/maintenance/status` (the app's version and
  the helper's GET /status, or the no-helper words), `GET /api/maintenance` (helper state, waiting
  request, progress, last result, running build), `GET /api/backups`, `POST /api/backups`, `GET
  /api/backups/:name` (the .tar.zst streamed), `DELETE /api/backups/:name`, `POST
  /api/backups/:name/restore`, `POST /api/maintenance/uploads` (the browser's multipart form piped
  to the helper as it comes), `GET` and `DELETE /api/maintenance/uploads/:uploadId`, `POST
  /api/maintenance/update`, `GET /api/maintenance/releases`, `POST /api/maintenance/rollback`.
  "Confirm it's you" (`confirm: true`): the HTTPS method, the pasted certificate, the domain, the site address, a
  backup's download, delete and restore, the upload, the install and the rollback.
- Activity: "Changed HTTPS to <method>", "Asked to change the domain to <domain>", "Asked to move the site
  to port <port> and the path <path>", "Made the backup <name>", "Downloaded the backup <name>", "Deleted the backup <name>", "Asked to restore the backup
  <name>", "Asked to update xDesign from <a> to <b>", "Asked to go back to xDesign <v>" (" with the
  data from before the update").
- "Confirm it's you": the dialog asks for "Current password" and calls `POST /api/auth/confirm`,
  then runs the action; its failure shows in the dialog. The tab remembers the 5-minute window (30
  seconds less): a download, an upload and an HTTPS change run at once while it holds (and ask when
  the server says `confirm_needed`); delete, restore, install, rollback and the domain change ask
  every time.
- Reload banner: every page asks `/api/health` when it opens, every 60 seconds and when the tab gets
  the focus back; the first version a tab sees is its own, and another one shows "xDesign was
  updated. Reload to use the new version." with "Reload" at the bottom of the screen.
  `noteServerVersion(version)` takes the live connection's `serverVersion` too.
- Settings > HTTPS, modes A and C: the method in use with its pill (Active, Issuing, Renewing,
  Renewal failing, Failed, Expired, Files unreadable), the names, "Issued by", "Valid until",
  "Renews from", the file method's paths, the last problem with "xDesign tries again at <time>.",
  the certificate's own problem, the log of the issuance while it runs or after a problem (read
  every 2 seconds while issuing or renewing), "Try now" (Let's Encrypt after a problem, and the file
  method), "Renew now" for a working Let's Encrypt certificate (it asks first: "Renew the
  certificate now?"), and "Change the method" with "Method" (the five methods in the plan's words and xWriter's
  help lines), "Domain names", "Cloudflare API token" (an empty field keeps the saved one), the two
  file paths, or the pasted "Certificate (full chain)" and "Private key". When the site's domain
  (from XD_PUBLIC_URL) is a domain name the served certificate does not cover, the card says "The
  certificate is not for <domain>" with "Get a certificate for <domain>", which opens the form with
  Let's Encrypt (port 80) and the domain. Mode B shows the helper's "HTTPS is handled by nginx on
  this server." and "Its site config:" with the path and "Copy".
- Settings > HTTPS, "Domain" in every mode: "xDesign opens at <address>. Changing the domain
  restarts xDesign.", "New domain" and "Change the domain"; the page then follows the request
  ("Waiting for the server to take the change...", the helper's steps, "xDesign is restarting with
  <domain>...") and shows the result's words with "Open <address>"; in modes A and C also "Open the
  new address, then get a certificate for <domain> here: browsers warn until it has one."
- Maintenance, "This server": version, "Running for", address, HTTPS (mode, method, expiry, or mode
  B's message), database, media, free disk, the HTTPS manager's last problem, and the last failed or
  rolled-back request of the past day that this tab does not follow (with the failure log's path).
- Maintenance, "Backups": "A backup is made every day at 03:30; the last 14 are kept. <size> used.",
  "Make a backup now" (waits for the helper), each backup with its time, kind ("Daily", "Made by
  hand", "Before an update"), size, version and name, "Download", "Restore" and "Delete". A restore
  follows the request ("Restoring <name>: ...") and ends with the helper's words.
- Maintenance, "Update": the drop zone (the xdesign file or a tar.gz, zip, tar.xz or tar.zst holding
  it, with SHA256SUMS and SHA256SUMS.sig), the chosen files, "Upload and check", then xWriter's
  tracker "Upload the file" (percent, sizes, "Stop the upload"), "Check it", "Install and restart",
  "Back on the new build", the check's rows with check marks, its warnings, "Release notes" when the
  answer has them, the refusal ("This file cannot be installed"), "Install and restart" (a fresh
  "Confirm it's you"), the helper's steps with a bar, "xDesign is restarting...", "xDesign <v> runs
  now." and the result: the helper's words, or "The update went back by itself" with its words and
  the failure log's path; "Done" returns to the drop zone. The helper's state other than ready shows
  its message and turns "Install and restart" off.
- Maintenance, "Go back": "xDesign keeps the last <n> versions. Going back keeps your data.", each
  kept release with "Installed <time>", its note, and "Roll back to <v>" or "Not kept"; the dialog
  has "Also restore the data from before the update" when the release has a pre-update backup
  (checked and fixed when the release is below the schema floor). The rollback's tracker has "Go
  back and restart" and "Back on <v>".
- The page follows one request at a time: the one it started, or the one the server works on when
  the page opens (after a reload or from another tab). A request still waiting after 2 minutes shows
  "The server has not taken the request yet" with `systemctl status xdesign-maintenance.path`.
