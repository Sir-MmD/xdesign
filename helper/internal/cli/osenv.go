package cli

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"os"
	"strings"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// OSEnv returns the Env of the real operating system: the standard streams of the
// process, the DNS and the health check of the website on this server.
func OSEnv(stdin *os.File, stdout, stderr io.Writer) *Env {
	return &Env{
		Stdin:      stdin,
		Stdout:     stdout,
		Stderr:     stderr,
		Terminal:   isTerminalWriter(stdout),
		System:     host.OS(),
		Rand:       rand.Reader,
		Build:      buildinfo.Get(),
		Executable: os.Executable,
		Getenv:     os.Getenv,
		LookupIP: func(ctx context.Context, name string) ([]netip.Addr, error) {
			addrs, err := net.DefaultResolver.LookupNetIP(ctx, "ip", name)
			if err != nil {
				return nil, fmt.Errorf("look up %s: %w", name, err)
			}
			return addrs, nil
		},
		Get:     localGet(),
		Upgrade: localUpgrade(),
	}
}

// isTerminalWriter reports whether w is a terminal that shows the colors and the redrawn
// lines (terminalOutput, which turns them on in a Windows console).
func isTerminalWriter(w io.Writer) bool {
	f, ok := w.(*os.File)
	return ok && terminalOutput(f)
}

// maxHealthBody bounds what the health check reads of an answer.
const maxHealthBody = 64 << 10

// localGet returns a get that asks the website's own front on this server, without
// following redirects or any proxy from the environment (xmtp-panel's installHTTPGet).
// The front is asked at 127.0.0.1 with the site's name as the Host header and the TLS
// server name.
func localGet() func(ctx context.Context, url, host string) (int, []byte, error) {
	return func(ctx context.Context, url, host string) (int, []byte, error) {
		req, err := localRequest(ctx, url, host)
		if err != nil {
			return 0, nil, err
		}
		resp, err := localClient(host).Do(req)
		if err != nil {
			return 0, nil, fmt.Errorf("ask %s: %w", url, err)
		}
		defer func() { _ = resp.Body.Close() }() // read-only: closing cannot lose data
		body, err := io.ReadAll(io.LimitReader(resp.Body, maxHealthBody))
		if err != nil {
			return 0, nil, fmt.Errorf("read the answer of %s: %w", url, err)
		}
		return resp.StatusCode, body, nil
	}
}

// localClient is the client of the health checks: no proxy from the environment, no
// redirects, no kept connections.
func localClient(host string) *http.Client {
	return &http.Client{
		Timeout: 5 * time.Second,
		Transport: &http.Transport{
			Proxy:             nil,
			DisableKeepAlives: true,
			// The website's own front on this server, sent nothing secret: its certificate
			// is the built-in one until another is issued, and it is issued for the site's
			// name rather than for 127.0.0.1.
			TLSClientConfig: &tls.Config{ServerName: host, InsecureSkipVerify: true}, //nolint:gosec // G402: see above
		},
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
}

// localRequest is a GET of url with the site's name host as the Host header.
func localRequest(ctx context.Context, url, host string) (*http.Request, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("ask %s: %w", url, err)
	}
	req.Host = host
	if strings.Contains(host, ":") {
		req.Host = "[" + host + "]" // an IPv6 address
	}
	return req, nil
}

// localUpgrade returns an upgrade that asks the website's own front on this server for a
// WebSocket upgrade of url from the page origin, and returns the status of the answer: 101
// when the live server took it, 401 when it refused a request without a session (the
// update's health check, docs/plan/07-server-install-update.md section 6.3 step 6).
func localUpgrade() func(ctx context.Context, url, host, origin string) (int, error) {
	return func(ctx context.Context, url, host, origin string) (int, error) {
		req, err := localRequest(ctx, url, host)
		if err != nil {
			return 0, err
		}
		key := make([]byte, 16)
		_, _ = rand.Read(key) // crypto/rand never fails since Go 1.24
		req.Header.Set("Connection", "Upgrade")
		req.Header.Set("Upgrade", "websocket")
		req.Header.Set("Sec-WebSocket-Version", "13")
		req.Header.Set("Sec-WebSocket-Key", base64.StdEncoding.EncodeToString(key))
		req.Header.Set("Origin", origin)
		resp, err := localClient(host).Do(req)
		if err != nil {
			return 0, fmt.Errorf("ask %s: %w", url, err)
		}
		_ = resp.Body.Close() // only the status counts; closing ends the upgraded connection
		return resp.StatusCode, nil
	}
}
