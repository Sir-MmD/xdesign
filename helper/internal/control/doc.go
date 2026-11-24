// Package control serves the helper's control socket, /run/xdesign/control.sock
// (docs/plan/07-server-install-update.md section 1, D-33): HTTP with JSON on a Unix socket
// of mode 0600, so only the service user, which the app runs as, can connect. The website
// checks the person before it calls; the helper trusts only its own socket. On Windows it
// listens on a free port of 127.0.0.1 instead and refuses (401) every request without
// Authorization: Bearer <the secret of this start> (docs/plan/18-third-owner-list-2026-11-23.md
// section 8.2); the port and the secret go to the app's environment and to a file
// (internal/controlclient).
//
// Endpoints, one file per area (routes lists them):
//
//	GET /status               the front's version, start time and uptime, the app's
//	                          state, the mode (port or dev) and the site's address, the
//	                          database and media sizes, the free disk, the last backups
//	                          and the HTTPS method with its certificate's expiry
//	GET /https                Settings > HTTPS: the mode, the method, the names, the
//	                          state, the expiry, the last problem and the certificate
//	                          served (ssl.View)
//	PUT /https                choose the method with its fields (ssl.Choice)
//	POST /https/certificate   put a pasted certificate and its key in use
//	POST /https/issue         "Try now": issue or renew at once, or read the files again
//	PUT /https/domain         the site's domain {"domain"}: the request for the root
//	                          helper (config.toml and a restart)
//	PUT /address              Settings > Site address: the site's port and web base path
//	                          {"port", "base_path"}, the request for the root helper
//	                          (set-port and set-path)
//	GET /backups              Maintenance > Backups: the backups, newest first, with their
//	                          kind, version, time, size and parts, the space used and
//	                          whether one is being made
//	POST /backups             "Make a backup now": a manual backup, answered when made
//	GET /backups/<name>       "Download": the backup's .tar.zst
//	DELETE /backups/<name>    "Delete"
//	POST /backups/<name>/restore "Restore": the request for the root helper
//	GET /maintenance          Maintenance > Update: the maintenance helper's state, the
//	                          request that waits, the progress, the last result and the
//	                          build that runs
//	GET /maintenance/releases "Go back": the kept releases and whether each can be gone
//	                          back to, with or without the data from before the update
//	POST /maintenance/uploads "Upload and check": the multipart upload (files, sha256)
//	                          and its check, with the rows of section 6.2 step 2
//	GET /maintenance/uploads/<id>    the check of an upload again
//	DELETE /maintenance/uploads/<id> discard a checked upload
//	POST /maintenance/update  "Install and restart": {"upload_id"}, the request for the
//	                          root helper
//	POST /maintenance/rollback "Roll back to <version>": {"to", "restore_data"}
//	POST /maintenance/uninstall "Uninstall xDesign": {"keepData"}, true for Keep the
//	                          data and false for Remove everything, the request for the
//	                          root helper (docs/plan/19-uninstall-2026-11-24.md section 5)
//
// The HTTPS endpoints answer a refused request with 400 (a wrong request) or 409 (one
// that cannot run now) and {"error": "<plain words>"}; the requests for the root helper
// answer 202 with the request.
//
// Copied in part from xWriter's internal/control (the socket's creation, the stale socket
// check, the JSON answers) and adapted.
package control
