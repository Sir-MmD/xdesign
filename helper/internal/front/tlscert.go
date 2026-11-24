package front

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/certs"
	"github.com/Sir-MmD/xdesign/helper/internal/ssl"
	sslcfg "github.com/Sir-MmD/xdesign/helper/internal/ssl/domain"
)

// Timing of the certificate checks.
const (
	// certCheckInterval is how often the served certificate is checked: the files of the
	// file method, an expiry, a renewal of the built-in certificate.
	certCheckInterval = time.Minute
	// sourceTimeout bounds one read of the certificate to serve.
	sourceTimeout = 30 * time.Second
)

// errNoCertificate ends a handshake before the first certificate is known; it never
// happens after NewCertificates.
var errNoCertificate = errors.New("no certificate to serve")

// CertificateSource chooses the certificate the front serves: the certificate of the
// method of Settings > HTTPS, and the built-in one in its place when it cannot be used.
// The HTTPS manager (internal/ssl) implements it.
type CertificateSource interface {
	// ServedCertificate returns the certificate to serve now. force reads the files of
	// the file method even when they look unchanged. An error means not even the built-in
	// certificate can be made.
	ServedCertificate(ctx context.Context, force bool) (ssl.Served, error)
}

// certSnapshot is what the front serves at one moment.
type certSnapshot struct {
	cert    *tls.Certificate
	info    certs.Info
	method  sslcfg.Method
	name    string
	problem string
}

func snapshotOfServed(s ssl.Served) *certSnapshot {
	return &certSnapshot{cert: s.Pair.Certificate, info: s.Pair.Info, method: s.Method, name: s.Name, problem: s.Problem}
}

// Certificates serves the certificate of the front's listener (07
// section 4). It sits in an atomic pointer, so a check swaps it without a lock on the
// handshake path: new handshakes get the new certificate, existing connections keep
// theirs, and nothing restarts.
//
// It serves what its source chooses, asked at start, every minute, and when the source
// says the certificate changed (Reload). When the source cannot be read, it keeps what it
// serves; at start it serves a temporary self-signed certificate instead, so nobody is
// locked out. Copied from xWriter's certManager (internal/web/tlscert.go) without the
// public and agents' addresses, the database and the network-change listener.
type Certificates struct {
	log *slog.Logger
	src CertificateSource
	// hosts are the names of the temporary self-signed certificate.
	hosts []string

	current atomic.Pointer[certSnapshot]
	reload  chan struct{}

	mu sync.Mutex // serializes checks
	// failure is the last logged failure of a check, so a broken source is logged once
	// instead of every minute. Guarded by mu.
	failure string
}

// NewCertificates loads the certificate to serve. hosts are the names of the temporary
// self-signed certificate of a start whose source fails; failing to make that one is an
// error.
func NewCertificates(ctx context.Context, src CertificateSource, hosts []string, log *slog.Logger) (*Certificates, error) {
	c := &Certificates{log: log.With("part", "front"), src: src, hosts: hosts, reload: make(chan struct{}, 1)}
	c.mu.Lock()
	defer c.mu.Unlock()
	err := c.checkSource(ctx, true)
	if err == nil {
		return c, nil
	}
	pair, terr := c.temporary()
	if terr != nil {
		return nil, errors.Join(fmt.Errorf("read the certificate to serve: %w", err), terr)
	}
	c.failure = err.Error()
	snap := &certSnapshot{cert: pair.Certificate, info: pair.Info, method: sslcfg.MethodBuiltin, name: "a temporary certificate",
		problem: "The certificate to serve could not be read: " + err.Error() +
			". xDesign serves a temporary self-signed certificate until it can."}
	c.current.Store(snap)
	c.log.Error("the certificate to serve cannot be read: serving a temporary self-signed certificate", "error", err)
	c.log.Info("tls certificate", c.servedAttrs()...)
	return c, nil
}

// TLSConfig returns the TLS configuration of the front: xWriter's policy
// (certs.ServerConfig) with the certificate served now.
func (c *Certificates) TLSConfig() *tls.Config {
	return certs.ServerConfig(c.getCertificate)
}

// getCertificate is the listener's tls.Config.GetCertificate: the certificate the front
// serves now, for every server name.
func (c *Certificates) getCertificate(*tls.ClientHelloInfo) (*tls.Certificate, error) {
	cur := c.current.Load()
	if cur == nil || cur.cert == nil {
		return nil, errNoCertificate
	}
	return cur.cert, nil
}

// Reload asks Run to read the certificate again now, its files too: the source calls it
// when the certificate changed. It never blocks.
func (c *Certificates) Reload() {
	select {
	case c.reload <- struct{}{}:
	default: // a reload waits already
	}
}

// Run checks the certificate every minute and at every Reload, until ctx ends.
func (c *Certificates) Run(ctx context.Context) {
	ticker := time.NewTicker(certCheckInterval)
	defer ticker.Stop()
	for {
		force := false
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		case <-c.reload:
			force = true
		}
		c.check(ctx, force)
	}
}

// Problem returns why the certificate of the method is not served as it is, or "".
func (c *Certificates) Problem() string {
	return c.current.Load().problem
}

// check asks the source again. It never stops serving: a failure leaves the current
// certificate in place.
func (c *Certificates) check(ctx context.Context, force bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if err := c.checkSource(ctx, force); err != nil {
		if msg := err.Error(); msg != c.failure {
			c.failure = msg
			c.log.Warn("cannot read the certificate to serve: keeping the current certificate", "error", err)
		}
	}
}

// checkSource serves what the source chooses now. The caller holds c.mu.
func (c *Certificates) checkSource(ctx context.Context, force bool) error {
	ctx, cancel := context.WithTimeout(ctx, sourceTimeout)
	defer cancel()
	served, err := c.src.ServedCertificate(ctx, force)
	if err != nil {
		return err
	}
	if served.Pair == nil {
		return errors.New("the https manager chose no certificate")
	}
	cur := c.current.Load()
	next := snapshotOfServed(served)
	c.current.Store(next)
	c.failure = ""
	switch {
	case cur == nil || cur.cert == nil:
		c.log.Info("tls certificate", c.servedAttrs()...)
	case !sameChain(cur.cert, next.cert):
		c.log.Info("serving a new tls certificate", c.servedAttrs()...)
	}
	switch {
	case next.problem != "" && (cur == nil || next.problem != cur.problem):
		c.log.Error("the certificate of the method cannot be served as it is", "problem", next.problem)
	case next.problem == "" && cur != nil && cur.problem != "":
		c.log.Info("the certificate of the method is served again")
	}
	return nil
}

// temporary makes a self-signed certificate in memory for a start whose source failed.
func (c *Certificates) temporary() (*certs.Pair, error) {
	now := time.Now()
	opts, err := certs.LocalSelfSignedOptions(c.hosts...)
	if err != nil {
		c.log.Warn("cannot read the host name and addresses for the self-signed certificate", "error", err)
		opts = certs.SelfSignedOptions{Hosts: c.hosts}
	}
	certPEM, keyPEM, err := certs.GenerateSelfSigned(opts, now)
	if err != nil {
		return nil, fmt.Errorf("make a temporary self-signed certificate: %w", err)
	}
	defer clear(keyPEM)
	pair, err := certs.Parse(certPEM, keyPEM, "the temporary certificate", "its key", certs.LoadOptions{Now: now})
	if err != nil {
		return nil, fmt.Errorf("make a temporary self-signed certificate: %w", err)
	}
	return pair, nil
}

// servedAttrs are the log attributes of the served certificate.
func (c *Certificates) servedAttrs() []any {
	cur := c.current.Load()
	return []any{"method", string(cur.method), "name", cur.name, "subject", cur.info.Subject, "not_after", cur.info.NotAfter,
		"trusted", cur.info.Trusted, "fingerprint_sha256", cur.info.Fingerprint}
}

func sameChain(a, b *tls.Certificate) bool {
	return slices.EqualFunc(a.Certificate, b.Certificate, bytes.Equal)
}
