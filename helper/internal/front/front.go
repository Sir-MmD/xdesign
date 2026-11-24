package front

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/http"
	"time"
)

// Server limits. Uploads, WebSockets and streamed answers last as long as they need, so
// only the request headers and idle connections have a time limit.
const (
	readHeaderTimeout = 10 * time.Second
	idleTimeout       = 120 * time.Second
	maxHeaderBytes    = 64 << 10
	// shutdownTimeout is how long requests in flight may finish before the app is stopped.
	shutdownTimeout = 5 * time.Second
)

// Options are what Serve needs.
type Options struct {
	// Listener is where the front answers.
	Listener net.Listener
	// TLS is the HTTPS configuration.
	TLS *tls.Config
	// Child is the app the front starts, watches and passes requests to.
	Child *Child
	// Version is the front's version, sent in the X-Xdesign-Front header.
	Version string
}

// Serve runs the front until ctx ends: it starts the app, answers on the listener (the app
// under its web base path, the empty page outside it), and at the end lets the requests in
// flight finish (5 seconds at most), stops the app and returns. An error means the listener
// failed.
func Serve(ctx context.Context, opts Options, log *slog.Logger) error {
	handler := newGate(opts.Child.opts.BasePath, newProxy(opts.Child.opts.Socket, opts.Child.currentTarget, opts.Version, opts.Child.Ready, log))
	log = log.With("part", "front")
	srv := &http.Server{
		Handler:           handler,
		TLSConfig:         opts.TLS,
		ReadHeaderTimeout: readHeaderTimeout, // also bounds the TLS handshake
		IdleTimeout:       idleTimeout,
		MaxHeaderBytes:    maxHeaderBytes,
		// Connection errors, mostly scanners and TLS handshake noise, are debug noise.
		ErrorLog: slog.NewLogLogger(log.Handler(), slog.LevelDebug),
		// Requests keep running while the server drains; the shutdown timeout ends them.
		BaseContext: func(net.Listener) context.Context { return context.WithoutCancel(ctx) },
	}

	// The app stops after the front stopped taking requests, not with ctx.
	childCtx, stopChild := context.WithCancel(context.WithoutCancel(ctx))
	defer stopChild()
	childDone := make(chan struct{})
	go func() {
		defer close(childDone)
		opts.Child.Run(childCtx)
	}()

	served := make(chan error, 1)
	go func() {
		served <- srv.ServeTLS(opts.Listener, "", "")
	}()
	log.Info("front started", "address", opts.Listener.Addr().String())

	var err error
	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
		if serr := srv.Shutdown(shutdownCtx); serr != nil {
			// Requests still running after the timeout are cut.
			log.Warn("requests cut at shutdown", "error", serr.Error())
			_ = srv.Close() // the listener is closed already; this ends the connections
		}
		cancel()
		<-served // http.ErrServerClosed
	case serr := <-served:
		err = fmt.Errorf("serve on %s: %w", opts.Listener.Addr(), serr)
		_ = srv.Close() // the listener failed; this ends the connections left
	}
	stopChild()
	<-childDone
	if errors.Is(err, http.ErrServerClosed) {
		err = nil
	}
	log.Info("front stopped")
	return err
}
