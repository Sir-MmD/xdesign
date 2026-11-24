package control

import (
	"net/http"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/front"
	"github.com/Sir-MmD/xdesign/helper/internal/status"
)

// Status is the answer of GET /status: the front and the app, and what `xdesign status` and
// Maintenance show besides them (docs/plan/07-server-install-update.md section 8): the
// uptime, the database and media sizes, the free disk, the last backups and the HTTPS.
type Status struct {
	// Version is the helper's version.
	Version        string          `json:"version"`
	FrontStartedAt time.Time       `json:"front_started_at"`
	App            front.AppStatus `json:"app"`
	// Mode is port (xDesign serves HTTPS itself on the port of the config file), or dev
	// for `xdesign serve --dev`.
	Mode string `json:"mode"`
	// Address is the site's full address with its port and web base path, the one people
	// open.
	Address string `json:"address"`
	// UptimeSeconds is how long the front runs.
	UptimeSeconds int64 `json:"uptime_seconds"`
	// Storage, Backups and HTTPS are measured for each request; Storage and Backups are
	// left out without a data folder.
	Storage *status.Storage `json:"storage,omitempty"`
	Backups *status.Backups `json:"backups,omitempty"`
	HTTPS   status.HTTPS    `json:"https"`
}

func statusRoutes(opts Options) []route {
	return []route{
		{pattern: "GET /status", handler: func(w http.ResponseWriter, _ *http.Request) {
			writeJSON(w, http.StatusOK, fullStatus(opts))
		}},
	}
}

// fullStatus is the answer of GET /status: opts.Status with the measurements.
func fullStatus(opts Options) Status {
	st := opts.Status()
	st.UptimeSeconds = int64(time.Since(st.FrontStartedAt).Seconds())
	if opts.Backups != nil {
		storage, backups := status.StorageOf(opts.Backups.DataDir), status.BackupsOf(opts.Backups.Dir())
		st.Storage, st.Backups = &storage, &backups
	}
	st.HTTPS = status.HTTPSOf(opts.HTTPS.View())
	return st
}
