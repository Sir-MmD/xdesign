package front

import (
	"net/http"
	"strconv"
	"strings"
)

// emptyPage is the body of the empty page (docs/plan/16-owner-list-2026-11-23.md section 4,
// D-611, D-615): every address outside the web base path but the OAuth metadata addresses
// (gate.isMetadata), and on port 80 everything but a waiting Let's Encrypt check, gets it. A
// tiny blank HTML document, because an empty 404 body makes Chrome show its own error page;
// the app answers the same (apps/server/src/basePath.ts).
const emptyPage = "<!doctype html><title></title>"

// The well-known names of the OAuth metadata documents: the protected resource's (RFC 9728)
// and the authorization server's (RFC 8414).
const (
	wellKnownProtectedResource   = "/.well-known/oauth-protected-resource"
	wellKnownAuthorizationServer = "/.well-known/oauth-authorization-server"
)

// gate passes the requests under the web base path to next unchanged: the app takes the base
// path off itself (apps/server/src/basePath.ts), so the front never strips it. The base path
// without its last slash redirects to the base path, and the two OAuth metadata addresses
// that carry the base path (isMetadata) go to next unchanged too; everything else gets the
// empty page from the front itself and never reaches the app. Copied in spirit from
// xWriter's internal/web/gate.go.
type gate struct {
	// base is the web base path ("/k3v9x2m1q8wz7r4t/"), bare the same without its last
	// slash.
	base, bare string
	// resourceMeta and serverMeta are the metadata addresses of isMetadata.
	resourceMeta, serverMeta string
	next                     http.Handler
}

// newGate returns the handler that serves next under the web base path base; with base "/"
// that is next itself, which then answers everything, the metadata addresses included.
func newGate(base string, next http.Handler) http.Handler {
	if base == "/" {
		return next
	}
	bare := strings.TrimSuffix(base, "/")
	return &gate{base: base, bare: bare, next: next,
		resourceMeta: wellKnownProtectedResource + bare + "/mcp", serverMeta: wellKnownAuthorizationServer + bare}
}

// ServeHTTP answers r as described on gate. RawPath, when set, must carry the base path too,
// so an encoded spelling of it ("/%6B3v9x2m1q8wz7r4t/") is outside, as in the app.
func (g *gate) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path, raw := r.URL.Path, r.URL.RawPath
	switch {
	case path == g.bare && (raw == "" || raw == g.bare):
		// Whoever asks knows the base path already.
		target := g.base
		if r.URL.RawQuery != "" {
			target += "?" + r.URL.RawQuery
		}
		h := w.Header()
		h.Set("Location", target)
		h.Set("Content-Length", "0")
		w.WriteHeader(http.StatusPermanentRedirect)
	case strings.HasPrefix(path, g.base) && (raw == "" || strings.HasPrefix(raw, g.base)), g.isMetadata(path, raw):
		g.next.ServeHTTP(w, r)
	default:
		answerEmpty(w, r)
	}
}

// isMetadata reports whether path is one of the addresses of the OAuth metadata documents of
// the site's MCP address (docs/plan/17-second-owner-list-2026-11-23.md section 13.5): the
// base path inserted after the well-known name, as RFC 9728 section 3.1 and RFC 8414 section
// 3 build them from an address with a path, so
// /.well-known/oauth-protected-resource/k3v9x2m1q8wz7r4t/mcp and
// /.well-known/oauth-authorization-server/k3v9x2m1q8wz7r4t exactly. They lie outside the base
// path, but only whoever knows it can name them; the app answers them. An encoded spelling
// is not one, as for the base path.
func (g *gate) isMetadata(path, raw string) bool {
	return (path == g.resourceMeta || path == g.serverMeta) && (raw == "" || raw == path)
}

// answerEmpty writes the empty page: status 404, text/html, the body emptyPage and no
// header that names xDesign. HEAD gets it without the body.
func answerEmpty(w http.ResponseWriter, r *http.Request) {
	h := w.Header()
	h.Set("Content-Type", "text/html; charset=utf-8")
	h.Set("Content-Length", strconv.Itoa(len(emptyPage)))
	w.WriteHeader(http.StatusNotFound)
	if r.Method != http.MethodHead {
		_, _ = w.Write([]byte(emptyPage)) // the client went away; nothing to do
	}
}
