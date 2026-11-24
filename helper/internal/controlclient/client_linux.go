package controlclient

import (
	"context"
	"net"
	"net/http"
)

// New returns the client of the control socket at path (control.SocketPath, or --dev's):
// every request dials the socket whatever its address names ("http://xdesign/status"), and
// no connection is kept.
func New(path string) (*http.Client, error) {
	return &http.Client{Transport: &http.Transport{
		DisableKeepAlives: true,
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, "unix", path)
		},
	}}, nil
}
