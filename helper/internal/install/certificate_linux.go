package install

import (
	"context"
	"net"
	"net/http"
)

// controlSocket is the helper's control socket, control.SocketPath (the control package
// imports this one, so the path is written here too).
const controlSocket = "/run/xdesign/control.sock"

// controlName names the control channel in the plan of a dry run.
const controlName = controlSocket

// controlClient is the client of the control socket (xdesign status's askStatus): every
// request dials the socket, and no connection is kept.
func controlClient() (*http.Client, error) {
	return &http.Client{Transport: &http.Transport{
		DisableKeepAlives: true,
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, "unix", controlSocket)
		},
	}}, nil
}
