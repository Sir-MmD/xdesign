package control

import (
	"errors"
	"net/http"
	"os"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
)

// backupsAnswer is the answer of GET /backups: Maintenance > Backups.
type backupsAnswer struct {
	backup.Listing
	// Running reports that a backup or a restore runs now.
	Running bool `json:"running"`
}

// backupsRoutes are Maintenance > Backups (docs/plan/07-server-install-update.md section
// 5.3): the list with the space used, "Make a backup now", "Download", "Delete" and
// "Restore", which asks the root helper to put the backup back with backup.Restore
// (section 5.4); GET /maintenance follows it.
func backupsRoutes(opts Options) []route {
	return []route{
		{pattern: "GET /backups", handler: func(w http.ResponseWriter, _ *http.Request) {
			if opts.Backups == nil {
				writeError(w, http.StatusNotFound, noBackupsText)
				return
			}
			l, err := backup.List(opts.Backups.Dir())
			if err != nil {
				writeError(w, http.StatusInternalServerError, "The backups could not be listed: "+err.Error())
				return
			}
			writeJSON(w, http.StatusOK, backupsAnswer{Listing: l, Running: backup.Running(opts.Backups.Dir())})
		}},
		{pattern: "POST /backups", handler: func(w http.ResponseWriter, r *http.Request) {
			if opts.Backups == nil {
				writeError(w, http.StatusNotFound, noBackupsText)
				return
			}
			res, err := backup.Make(r.Context(), *opts.Backups, backup.KindManual)
			switch {
			case errors.Is(err, backup.ErrBusy):
				writeError(w, http.StatusConflict, "A backup is being made or restored now: try again when it is done.")
			case err != nil && res.Path == "":
				writeError(w, http.StatusInternalServerError, "The backup failed: "+err.Error())
			default: // a failure of the retention leaves the new backup made
				writeJSON(w, http.StatusCreated, res.Backup)
			}
		}},
		{pattern: "GET /backups/{name}", handler: func(w http.ResponseWriter, r *http.Request) {
			if opts.Backups == nil {
				writeError(w, http.StatusNotFound, noBackupsText)
				return
			}
			e, path, err := backup.Find(opts.Backups.Dir(), r.PathValue("name"))
			if err != nil {
				writeError(w, http.StatusNotFound, "There is no backup named "+r.PathValue("name")+".")
				return
			}
			f, err := os.Open(path) //nolint:gosec // G304: a listed backup's archive
			if err != nil {
				writeError(w, http.StatusInternalServerError, "The backup could not be read: "+err.Error())
				return
			}
			defer func() { _ = f.Close() }() // read only
			w.Header().Set("Content-Type", "application/zstd")
			w.Header().Set("Content-Disposition", `attachment; filename="`+e.File+`"`)
			w.Header().Set("Cache-Control", "no-store")
			http.ServeContent(w, r, e.File, e.CreatedAt, f)
		}},
		{pattern: "DELETE /backups/{name}", handler: func(w http.ResponseWriter, r *http.Request) {
			if opts.Backups == nil {
				writeError(w, http.StatusNotFound, noBackupsText)
				return
			}
			name := r.PathValue("name")
			err := backup.Delete(opts.Backups.Dir(), name)
			switch {
			case errors.Is(err, backup.ErrNotFound):
				writeError(w, http.StatusNotFound, "There is no backup named "+name+".")
			case err != nil:
				writeError(w, http.StatusInternalServerError, "The backup could not be deleted: "+err.Error())
			default:
				writeJSON(w, http.StatusOK, map[string]string{"deleted": name})
			}
		}},
		{pattern: "POST /backups/{name}/restore", handler: func(w http.ResponseWriter, r *http.Request) {
			if opts.Maintenance == nil {
				writeError(w, http.StatusNotFound, noMaintenanceText)
				return
			}
			req, err := opts.Maintenance.StartRestore(r.Context(), r.PathValue("name"))
			if err != nil {
				writeMaintenanceError(w, err)
				return
			}
			writeJSON(w, http.StatusAccepted, req)
		}},
	}
}

// noBackupsText answers the backup endpoints of a helper that has no data folder.
const noBackupsText = "This xdesign serve keeps no backups."
