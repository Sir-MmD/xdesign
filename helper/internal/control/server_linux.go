package control

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"net"
	"os"
	"path/filepath"
	"syscall"
	"time"
)

// The control socket's file.
const (
	staleCheckTimeout = time.Second
	// socketUmask creates the socket with mode 0600 at once, so nobody else can connect
	// between its creation and a chmod.
	socketUmask = 0o177
	dirMode     = 0o700
)

// listen creates the socket file with mode 0600, and its folder when it is missing. The
// app finds it in XD_CONTROL_SOCKET.
func listen(ctx context.Context, path string) (*Endpoint, error) {
	if !filepath.IsAbs(path) {
		return nil, fmt.Errorf("control socket %s: the path must be absolute", path)
	}
	if err := os.MkdirAll(filepath.Dir(path), dirMode); err != nil {
		return nil, fmt.Errorf("control socket folder: %w", err)
	}
	if err := removeStale(ctx, path); err != nil {
		return nil, err
	}
	var lc net.ListenConfig
	// The umask is the process's: nothing else creates files while the front starts.
	old := syscall.Umask(socketUmask)
	ln, err := lc.Listen(ctx, "unix", path)
	syscall.Umask(old)
	if err != nil {
		return nil, fmt.Errorf("control socket: %w", err)
	}
	return &Endpoint{ln: ln, env: []string{"XD_CONTROL_SOCKET=" + path}, about: []any{"path", path}}, nil
}

// removeStale removes a socket file that no process listens on any more.
func removeStale(ctx context.Context, path string) error {
	info, err := os.Lstat(path)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("control socket: %w", err)
	}
	if info.Mode().Type() != fs.ModeSocket {
		return fmt.Errorf("control socket %s exists and is not a socket", path)
	}
	dialCtx, cancel := context.WithTimeout(ctx, staleCheckTimeout)
	defer cancel()
	var d net.Dialer
	conn, err := d.DialContext(dialCtx, "unix", path)
	if err == nil {
		_ = conn.Close() // only probed
		return fmt.Errorf("control socket %s: another xdesign serve listens on it", path)
	}
	if err := os.Remove(path); err != nil {
		return fmt.Errorf("control socket: remove the stale socket: %w", err)
	}
	return nil
}
