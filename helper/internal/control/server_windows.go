package control

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io/fs"
	"net"
	"os"

	"github.com/Sir-MmD/xdesign/helper/internal/controlclient"
)

// secretBytes is the size of the control secret, before it is written in hex.
const secretBytes = 32

// listen listens on a free port of 127.0.0.1 with a new secret that every request must
// carry, and writes both to the file at path for the installer and `xdesign status`
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.2): Windows has no Unix sockets
// that both Go and Node use. The app finds them in XD_CONTROL_URL and XD_CONTROL_SECRET.
// Neither the port nor the file outlives the server: Close removes the file.
func listen(ctx context.Context, path string) (*Endpoint, error) {
	var lc net.ListenConfig
	ln, err := lc.Listen(ctx, "tcp", "127.0.0.1:0")
	if err != nil {
		return nil, fmt.Errorf("control socket: %w", err)
	}
	b := make([]byte, secretBytes)
	_, _ = rand.Read(b) // never fails (crypto/rand)
	secret := hex.EncodeToString(b)
	url := "http://" + ln.Addr().String()
	if err := controlclient.Write(path, controlclient.Access{URL: url, Secret: secret}); err != nil {
		_ = ln.Close() // not served yet
		return nil, err
	}
	return &Endpoint{
		ln:     ln,
		secret: secret,
		env:    []string{"XD_CONTROL_URL=" + url, "XD_CONTROL_SECRET=" + secret},
		about:  []any{"address", ln.Addr().String(), "file", path},
		remove: func() error {
			if err := os.Remove(path); err != nil && !errors.Is(err, fs.ErrNotExist) {
				return fmt.Errorf("remove the control file: %w", err)
			}
			return nil
		},
	}, nil
}
