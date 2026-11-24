package controlclient

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
)

// The file's limits.
const (
	fileMode    = 0o600
	dirMode     = 0o700
	maxFileSize = 4 << 10
)

// Access is what the control server's file holds: where it listens and the secret every
// request carries.
type Access struct {
	// URL is the server's address, http://127.0.0.1:<port>.
	URL string `json:"url"`
	// Secret is 64 hex characters, sent as Authorization: Bearer <secret>.
	Secret string `json:"secret"`
}

// Write writes a to the file at path, in place of the file a previous start left, and
// creates its folder when it is missing (--dev's .dev\run). The file takes the permissions
// of its folder.
func Write(path string, a Access) error {
	data, err := json.Marshal(a) //nolint:gosec // G117: the file exists to hand the secret to the installer and status
	if err != nil {
		return fmt.Errorf("the control file: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(path), dirMode); err != nil {
		return fmt.Errorf("the control file's folder: %w", err)
	}
	if err := os.WriteFile(path, append(data, '\n'), fileMode); err != nil {
		return fmt.Errorf("the control file: %w", err)
	}
	return nil
}

// Read reads the file at path.
func Read(path string) (Access, error) {
	f, err := os.Open(path) //nolint:gosec // G304: the control file of serve (platform.ControlFile or --dev's)
	if err != nil {
		return Access{}, fmt.Errorf("the control file: %w", err)
	}
	defer func() { _ = f.Close() }() // read-only
	var a Access
	if err := json.NewDecoder(io.LimitReader(f, maxFileSize)).Decode(&a); err != nil {
		return Access{}, fmt.Errorf("the control file %s: %w", path, err)
	}
	if u, err := url.Parse(a.URL); err != nil || u.Scheme != "http" || u.Host == "" || a.Secret == "" {
		return Access{}, fmt.Errorf("the control file %s has no address or no secret", path)
	}
	return a, nil
}

// New returns the client of the control server whose file is at path
// (platform.ControlFile, or --dev's): every request goes to the file's address whatever its
// own address names ("http://xdesign/status"), with the secret, and no connection is kept.
// The file is read once, here.
func New(path string) (*http.Client, error) {
	a, err := Read(path)
	if err != nil {
		return nil, err
	}
	u, err := url.Parse(a.URL)
	if err != nil {
		return nil, fmt.Errorf("the control file %s: %w", path, err)
	}
	host := u.Host
	return &http.Client{Transport: &bearer{secret: a.Secret, next: &http.Transport{
		DisableKeepAlives: true,
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			var d net.Dialer
			return d.DialContext(ctx, "tcp", host)
		},
	}}}, nil
}

// bearer adds the secret to every request.
type bearer struct {
	secret string
	next   http.RoundTripper
}

func (b *bearer) RoundTrip(r *http.Request) (*http.Response, error) {
	r = r.Clone(r.Context())
	r.Header.Set("Authorization", "Bearer "+b.secret)
	return b.next.RoundTrip(r) //nolint:wrapcheck // the transport's error, as http.Client wraps it
}
