package control

import "net/http"

// maxAddressBody bounds PUT /address.
const maxAddressBody = 1 << 10

// addressRoutes are Settings > Site address (docs/plan/17-second-owner-list-2026-11-23.md
// section 6): the root helper moves the site to another port or web base path, or both,
// with set-port and set-path, and restarts xDesign; GET /maintenance follows it.
func addressRoutes(opts Options) []route {
	return []route{
		{pattern: "PUT /address", handler: func(w http.ResponseWriter, r *http.Request) {
			if opts.Maintenance == nil {
				writeError(w, http.StatusNotFound, noMaintenanceText)
				return
			}
			var body struct {
				Port     int    `json:"port"`
				BasePath string `json:"base_path"`
			}
			if !readJSON(w, r, maxAddressBody, &body) {
				return
			}
			req, err := opts.Maintenance.StartAddress(r.Context(), body.Port, body.BasePath)
			if err != nil {
				writeMaintenanceError(w, err)
				return
			}
			writeJSON(w, http.StatusAccepted, req)
		}},
	}
}
