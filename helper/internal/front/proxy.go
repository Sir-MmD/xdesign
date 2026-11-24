package front

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"
)

// frontHeader carries the front's version on every answer (07 section 8).
const frontHeader = "X-Xdesign-Front"

// proxyHeader carries the proxy secret of the app's start on every request passed to it on
// loopback TCP (Windows, docs/plan/18-third-owner-list-2026-11-23.md section 8.2): the app
// refuses a request without it.
const proxyHeader = "X-Xdesign-Proxy"

// Connections to the app's socket.
const (
	maxIdleAppConns    = 64
	idleAppConnTimeout = 90 * time.Second
)

// startingPage answers while the app starts or restarts: self-contained, and it loads the
// address again every 3 seconds, as Retry-After says.
const startingPage = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="3">
<title>xDesign is starting...</title>
<style>
:root { color-scheme: light dark; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center;
  font: 16px/1.5 system-ui, sans-serif; background: #f7f7f8; color: #1f2328; }
@media (prefers-color-scheme: dark) { body { background: #17181a; color: #e6e7e9; } }
</style>
</head>
<body>
<p>xDesign is starting...</p>
</body>
</html>
`

// proxy answers every request of the front under the web base path and the OAuth metadata
// addresses (the gate answers the others): the app answers it over its Unix socket (on
// Windows its port of 127.0.0.1) once it is ready, the starting page before.
type proxy struct {
	rp      *httputil.ReverseProxy
	target  func() appTarget
	ready   func() bool
	version string
	log     *slog.Logger
}

func newProxy(socket string, target func() appTarget, version string, ready func() bool, log *slog.Logger) *proxy {
	p := &proxy{
		target:  target,
		ready:   ready,
		version: version,
		log:     log.With("part", "proxy"),
	}
	p.rp = &httputil.ReverseProxy{
		Rewrite: p.rewrite,
		Transport: &http.Transport{
			DialContext:         appDialer(socket),
			MaxIdleConnsPerHost: maxIdleAppConns,
			IdleConnTimeout:     idleAppConnTimeout,
			// Bodies pass as the app sends them, compressed or not.
			DisableCompression: true,
		},
		// Streamed answers (server-sent events, long downloads) are passed on at once.
		FlushInterval: -1,
		ModifyResponse: func(resp *http.Response) error {
			resp.Header.Set(frontHeader, p.version)
			return nil
		},
		ErrorHandler: p.fail,
		ErrorLog:     slog.NewLogLogger(p.log.Handler(), slog.LevelDebug),
	}
	return p
}

func (p *proxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !p.ready() {
		p.starting(w, r)
		return
	}
	// WebSocket upgrades (<base path>live, <base path>mcp) pass through: ReverseProxy
	// switches protocols and copies both ways. The path goes to the app as it came, base
	// path included: the app takes it off itself.
	p.rp.ServeHTTP(w, r)
}

// rewrite sends the request to the app's current start with the client's address, scheme
// and host in the X-Forwarded headers, which the app trusts on its socket (exactly one hop),
// or on loopback TCP with the proxy secret of that start. ReverseProxy has removed the
// X-Forwarded headers the client sent; a proxy header it sent is removed here.
func (p *proxy) rewrite(pr *httputil.ProxyRequest) {
	t := p.target()
	pr.SetURL(&url.URL{Scheme: "http", Host: t.host})
	pr.Out.Host = pr.In.Host
	client, proto, host := p.forwarded(pr.In)
	pr.Out.Header.Set("X-Forwarded-For", client)
	pr.Out.Header.Set("X-Forwarded-Proto", proto)
	pr.Out.Header.Set("X-Forwarded-Host", host)
	pr.Out.Header.Del(proxyHeader)
	if t.secret != "" {
		pr.Out.Header.Set(proxyHeader, t.secret)
	}
}

// forwarded returns the client's address, the scheme and the host the client asked for:
// those of the connection.
func (p *proxy) forwarded(in *http.Request) (client, proto, host string) {
	client, _, err := net.SplitHostPort(in.RemoteAddr)
	if err != nil {
		client = in.RemoteAddr
	}
	proto, host = "http", in.Host
	if in.TLS != nil {
		proto = "https"
	}
	return client, proto, host
}

// fail answers a request the app could not take: the starting page, as when the app is
// not ready, since a failure to reach it means it is stopping or restarting. Requests the
// client gave up on are not logged.
func (p *proxy) fail(w http.ResponseWriter, r *http.Request, err error) {
	if !errors.Is(err, context.Canceled) && p.ready() {
		p.log.Warn("the app did not answer", "method", r.Method, "path", r.URL.Path, "error", err.Error())
	}
	p.starting(w, r)
}

// starting answers with the starting page: 503 with Retry-After: 3.
func (p *proxy) starting(w http.ResponseWriter, r *http.Request) {
	h := w.Header()
	h.Set(frontHeader, p.version)
	h.Set("Content-Type", "text/html; charset=utf-8")
	h.Set("Cache-Control", "no-store")
	h.Set("Retry-After", "3")
	h.Set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'")
	h.Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusServiceUnavailable)
	if r.Method != http.MethodHead {
		_, _ = w.Write([]byte(startingPage)) // the client went away; nothing to do
	}
}

// appDialer connects to the app: to its Unix socket at path whatever address is asked
// for, or without a socket (Windows) to the address asked for, the port of 127.0.0.1 of the
// app's start.
func appDialer(path string) func(ctx context.Context, network, addr string) (net.Conn, error) {
	if path == "" {
		var d net.Dialer
		return d.DialContext
	}
	return func(ctx context.Context, _, _ string) (net.Conn, error) {
		var d net.Dialer
		conn, err := d.DialContext(ctx, "unix", path)
		if err != nil {
			return nil, err //nolint:wrapcheck // net.OpError already names the socket
		}
		return conn, nil
	}
}
