// Package backup makes, lists, prunes, reads and restores the site's backups
// (docs/plan/07-server-install-update.md section 5, D-32). It is new code on SQLite's
// VACUUM INTO (modernc.org/sqlite, pure Go, as xmtp-panel's) with the patterns of xWriter's
// internal/cli/backup and internal/xwbackup, which are built on PostgreSQL and not copied:
// the partial name then the rename, 0600 files in a 0700 folder, the metadata written
// last, the retention and the strict reader.
//
// # A backup
//
// A backup is two files in <data_dir>/backups sharing one name: xdesign-<UTC time> for the
// daily and manual ones (xdesign-20261123T033000Z), pre-update-<version>-<UTC time> for the
// one made before an update or a restore:
//
//   - <name>.tar.zst: a tar archive compressed with zstd whose first member, backup.json,
//     is the [Meta] (the version, the time, the kind, the size and file count of each part,
//     and every later member with its size and SHA-256), followed by xdesign.db (a
//     consistent copy made with VACUUM INTO), config.toml (/etc/xdesign/config.toml),
//     media/... (the media folder without its tmp folder) and certs/... (the HTTPS
//     manager's folder). The archive is everything a restore needs: it can be downloaded
//     and restored on another server.
//   - <name>.json: the same Meta with the archive's size and SHA-256, written last, so an
//     archive without it is not listed. List reads only these.
//
// Both are written under a partial name (.<name>.tar.zst.partial) and renamed when
// complete, 0600 in the folder 0700; when root makes a backup, the files get the owner of
// the data folder (xdesign), so the service lists, downloads and deletes them. One backup
// runs at a time (a lock file in the folder). Retention after every backup but the one a
// restore makes (which could delete the backup being restored): the newest 14 daily and
// manual backups together, the newest 3 pre-update backups.
//
// # Reading
//
// [Read] checks everything before it trusts anything: the first member must be backup.json
// within its size limit and valid; every later member must be a regular file (no links,
// folders or sparse files) that the metadata lists, at most once, with the size it gives and
// within the limits; names are exact (xdesign.db, config.toml) or clean relative paths under
// media/ and certs/, so absolute paths and ".." never pass; the content must match its
// SHA-256, no listed member may be missing and nothing may follow the archive.
//
// # Restoring
//
// [Restore] refuses a backup of a newer xDesign, makes a pre-update backup of the site,
// unpacks the backup next to the data, stops the site, swaps in the database (removing the
// -wal and -shm files), the media, the settings and the certificates, runs the app's
// migrations and starts the site with its health check; on a failure it puts the pre-update
// backup back the same way and starts again. The site's service is a [Site]: the command
// line and the root helper give the systemd service (internal/install), and the installer
// puts a backup in place with [PutBack] before its own migrations and start.
//
// # Windows
//
// The same archives (docs/plan/18-third-owner-list-2026-11-23.md section 8.5), in
// C:\ProgramData\xDesign\backups beside the data folder. Nothing is given an owner: the
// files take the permissions of their folder, and the archive's owners and modes are never
// used on either system. The metadata records "system": "windows" (nothing on Linux); a
// restore on Windows, and a restore on Linux of a backup made on Windows, keeps this
// server's config.toml and puts back the database, the media and the certificates. The
// lock, the free space and the flush of the unpacked files use Windows calls
// (internal/platform); a symbolic link or a junction where Linux refuses a link is refused,
// and a member whose name Windows would read as something else (a device, a stream) is not
// a backup.
package backup
