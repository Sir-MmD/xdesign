package control

import (
	"net/http"
	"slices"
)

// route is one endpoint of the control socket: a http.ServeMux pattern with its method
// ("GET /status") and its handler.
type route struct {
	pattern string
	handler http.HandlerFunc
}

// routes lists the endpoints of every area. Each area has its own file with a function
// returning its routes (statusRoutes in status.go), added here.
func routes(opts Options) []route {
	return slices.Concat(
		statusRoutes(opts),
		httpsRoutes(opts),
		addressRoutes(opts),
		backupsRoutes(opts),
		maintenanceRoutes(opts),
	)
}
