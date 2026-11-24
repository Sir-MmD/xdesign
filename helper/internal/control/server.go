package control

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
	"github.com/Sir-MmD/xdesign/helper/internal/maintenance"
	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// Server limits. Later areas (update uploads, backups) set their own deadlines per
// request, so only the request headers and idle connections have a time limit here.
const (
	readHeaderTimeout = 5 * time.Second
	idleTimeout       = 30 * time.Second
	maxHeaderBytes    = 16 << 10
)

// SocketPath is the control socket of the service; systemd creates its folder
// (RuntimeDirectory).
const SocketPath = platform.RunDir + "/control.sock"

// Options are what the endpoints answer from. Each area adds its own.
type Options struct {
	// Status returns the front's part of the answer of GET /status.
	Status func() Status
	// Mode is port (xDesign serves HTTPS itself on the port of the config file), or dev.
	Mode string
	// HTTPS is the HTTPS manager of GET, PUT /https and POST /https/...
	HTTPS HTTPS
	// Backups are the site's backups of GET, POST /backups and GET, DELETE
	// /backups/<name>; nil answers them 404.
	Backups *backup.Options
	// Maintenance is Maintenance > Update of GET /maintenance and the routes below it;
	// nil answers them 404.
	Maintenance *maintenance.Updates
}

// Server serves the control socket.
type Server struct {
	srv    *http.Server
	ep     *Endpoint
	served chan error

	closeOnce sync.Once
	closeErr  error
}

// Endpoint is where the control server listens, opened before it serves so that the app's
// variables can name it.
type Endpoint struct {
	ln net.Listener
	// secret is what every request must carry as Authorization: Bearer <secret>; empty on
	// the Unix socket, which only the service's user can open.
	secret string
	// env holds the app's variables that name the endpoint, about its log attributes.
	env   []string
	about []any
	// remove removes what the endpoint left on disk once it is closed; nil when closing the
	// listener does.
	remove func() error
}

// Listen opens the control server's endpoint at path: on Linux the Unix socket (a socket
// file left by a dead process is replaced; one with a live process behind it is an error);
// on Windows a free loopback port with a new secret, both written to the file at path
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.2).
func Listen(ctx context.Context, path string) (*Endpoint, error) {
	return listen(ctx, path)
}

// AppEnv returns the app's variables that name the endpoint: XD_CONTROL_SOCKET on Linux,
// XD_CONTROL_URL and XD_CONTROL_SECRET on Windows.
func (e *Endpoint) AppEnv() []string {
	return slices.Clone(e.env)
}

func (e *Endpoint) cleanUp() error {
	if e.remove == nil {
		return nil
	}
	return e.remove()
}

// Start serves the endpoints on ep until Close.
func Start(ctx context.Context, ep *Endpoint, opts Options, log *slog.Logger) *Server {
	log = log.With("part", "control")
	s := &Server{
		srv: &http.Server{
			Handler:           handler(opts, ep.secret, log),
			ReadHeaderTimeout: readHeaderTimeout,
			IdleTimeout:       idleTimeout,
			MaxHeaderBytes:    maxHeaderBytes,
			ErrorLog:          slog.NewLogLogger(log.Handler(), slog.LevelDebug),
			BaseContext:       func(net.Listener) context.Context { return context.WithoutCancel(ctx) },
		},
		ep:     ep,
		served: make(chan error, 1),
	}
	go func() { s.served <- s.srv.Serve(ep.ln) }()
	log.Info("control socket ready", ep.about...)
	return s
}

// Close stops accepting connections, waits for the requests in flight until ctx ends and
// removes the socket file (closing a Unix listener does) or the control file. Later calls
// return the result of the first.
func (s *Server) Close(ctx context.Context) error {
	s.closeOnce.Do(func() {
		err := s.srv.Shutdown(ctx)
		if err != nil {
			err = errors.Join(fmt.Errorf("stop the control socket: %w", err), s.srv.Close())
		}
		if serr := <-s.served; !errors.Is(serr, http.ErrServerClosed) {
			err = errors.Join(err, fmt.Errorf("serve the control socket: %w", serr))
		}
		s.closeErr = errors.Join(err, s.ep.cleanUp())
	})
	return s.closeErr
}

// handler routes the endpoints of every area; anything else gets a JSON 404. With a secret
// (Windows), a request without it gets a JSON 401.
func handler(opts Options, secret string, log *slog.Logger) http.Handler {
	mux := http.NewServeMux()
	for _, r := range routes(opts) {
		mux.HandleFunc(r.pattern, r.handler)
	}
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "unknown endpoint: "+r.Method+" "+r.URL.Path)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Debug("control request", "method", r.Method, "path", r.URL.Path)
		if secret != "" && !authorized(r, secret) {
			writeError(w, http.StatusUnauthorized, "the control secret is missing or wrong")
			return
		}
		mux.ServeHTTP(w, r)
	})
}

// authorized reports whether r carries Authorization: Bearer <secret>, compared in constant
// time.
func authorized(r *http.Request, secret string) bool {
	token, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	return ok && subtle.ConstantTimeCompare([]byte(token), []byte(secret)) == 1
}

type errorBody struct {
	Error string `json:"error"`
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	body, err := json.Marshal(v)
	if err != nil {
		status = http.StatusInternalServerError
		body = []byte(`{"error":"encode the answer"}`)
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_, _ = w.Write(append(body, '\n')) // the client went away; nothing to do
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, errorBody{Error: message})
}
