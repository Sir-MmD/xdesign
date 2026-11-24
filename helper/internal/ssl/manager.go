package ssl

import (
	"context"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"log/slog"
	"math/rand/v2"
	"net/http"
	"os"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/certs"
	"github.com/Sir-MmD/xdesign/helper/internal/ssl/acme"
	sslcfg "github.com/Sir-MmD/xdesign/helper/internal/ssl/domain"
)

// Limits of an issuance.
const (
	// issueTimeout bounds one issuance or renewal: the preflight, the port-80 check, the
	// DNS-01 wait of up to 3 minutes and Let's Encrypt's checks.
	issueTimeout = 10 * time.Minute
	// httpTimeout bounds one call to Let's Encrypt or Cloudflare.
	httpTimeout = time.Minute
	// preflightTimeout bounds the DNS checks before an order.
	preflightTimeout = 30 * time.Second
	// maxTokenLen bounds a Cloudflare API token (they are 40 characters today).
	maxTokenLen = 200
)

// builtinName is what the texts call the built-in certificate.
const builtinName = "the built-in certificate"

// letsEncryptCAA is the CAA issuer identity that authorizes Let's Encrypt (RFC 8659).
const letsEncryptCAA = "letsencrypt.org"

// Options configure the manager.
type Options struct {
	// Dir is the state folder, /var/lib/xdesign/certs: the state file and the
	// certificate files. It is created with mode 0700 when missing.
	Dir string
	// SelfSignedDir is the folder of the built-in self-signed certificate; empty means
	// Dir. `serve --dev` keeps it in .dev/tls.
	SelfSignedDir string
	// Hosts are the names the built-in certificate covers besides this host's name and
	// addresses: the config file's domain.
	Hosts []string
	// DefaultNames are the names of a first start without a state file: Let's Encrypt
	// over port 80 for them when they are domain names, else the built-in certificate
	// (07 section 4.1: the built-in one is the default only without a domain).
	DefaultNames []string
	// Directory is the ACME directory: acme.DirectoryLetsEncrypt, the staging one for
	// `serve --dev`.
	Directory string
	// UserAgent is sent with the ACME and Cloudflare calls, for example "xDesign/1.4.0".
	UserAgent string
	// ListenIP and ListenPort are the front's listen address: the port-80 check asks the
	// IP, and a front on port 80 itself cannot answer HTTP-01.
	ListenIP   string
	ListenPort int
	// Changed is called after the certificate to serve changed (a new certificate, a
	// method chosen), without the manager's lock held: the front reads it again.
	Changed func()
	// Now returns the time; nil means time.Now.
	Now func() time.Time
}

// Manager keeps the certificate of the front: the state file, the certificate files,
// the built-in certificate and the Let's Encrypt issuances, one at a time. It is safe
// for concurrent use; Run must run for issuances and renewals to happen.
type Manager struct {
	opts   Options
	log    *slog.Logger
	engine *acme.Engine
	now    func() time.Time

	// kick wakes Run: an issuance waits.
	kick chan struct{}
	// port80Wake wakes the port-80 answerer: an answer came or went.
	port80Wake chan struct{}

	mu sync.Mutex
	st state
	// pair is the certificate of CertFile, loaded at start and after each change; nil
	// while HasCert is false or it cannot be loaded.
	pair *certs.Pair
	// filePair is the pair last read from the files of the file method; nil while they
	// cannot be used.
	filePair *certs.Pair
	// builtin is the built-in self-signed certificate.
	builtin *certs.Pair
	// run is the issuance that runs; nil between issuances.
	run *issueRun
	// challenges are the HTTP-01 answers by token.
	challenges map[string]challenge
}

// Served is what the front serves now.
type Served struct {
	// Pair is the certificate with its key; never nil.
	Pair *certs.Pair
	// Method is how it was obtained: MethodBuiltin for the built-in one.
	Method sslcfg.Method
	// Name is what Settings > HTTPS calls it: its first name, or "the built-in
	// certificate".
	Name string
	// Problem says why the certificate of the method is not served as it is: its files
	// cannot be read and their last good copy is served, or it cannot be used at all and
	// the built-in certificate is served instead. Empty otherwise.
	Problem string
}

// RequestError is a request of Settings > HTTPS that the manager refuses, in plain words.
type RequestError struct {
	// Conflict marks a request that is right but cannot run now (Let's Encrypt works on
	// the certificate) or does not fit the method; otherwise the request itself is wrong.
	Conflict bool
	Message  string
}

// Error returns the message.
func (e *RequestError) Error() string { return e.Message }

func invalid(msg string) error  { return &RequestError{Message: msg} }
func conflict(msg string) error { return &RequestError{Conflict: true, Message: msg} }

// Open reads the state folder, or starts it with the default method, and prepares the
// built-in certificate. The process has one Manager: it installs lego's process-wide
// logger and DNS client (acme.New).
func Open(opts Options, log *slog.Logger) (*Manager, error) {
	if opts.SelfSignedDir == "" {
		opts.SelfSignedDir = opts.Dir
	}
	m := &Manager{opts: opts, log: log.With("part", "https"), now: opts.Now, kick: make(chan struct{}, 1),
		port80Wake: make(chan struct{}, 1), challenges: map[string]challenge{}}
	if m.now == nil {
		m.now = time.Now
	}
	m.engine = acme.New(acme.Options{UserAgent: opts.UserAgent, Logger: m.log, Now: m.now})
	if err := os.MkdirAll(opts.Dir, dirMode); err != nil {
		return nil, fmt.Errorf("create the certificate folder %s: %w", opts.Dir, err)
	}
	st, found, err := readState(opts.Dir)
	if err != nil {
		return nil, err
	}
	if !found {
		st = m.defaultState()
		if err := writeState(opts.Dir, &st); err != nil {
			return nil, err
		}
	}
	m.st = st
	now := m.now()
	if _, err := m.ensureBuiltin(now); err != nil {
		return nil, err
	}
	if st.HasCert {
		certPath, keyPath := pairPaths(opts.Dir)
		if m.pair, err = certs.Load(certPath, keyPath, certs.LoadOptions{Now: now}); err != nil {
			// ServedCertificate tells why and serves the built-in certificate meanwhile.
			m.log.Warn("the saved certificate cannot be loaded", "error", err)
		}
	}
	m.log.Info("https manager", "method", string(st.Method), "status", string(st.Status), "names",
		strings.Join(st.Names, ","), "dir", opts.Dir)
	return m, nil
}

// defaultState is the state of a first start: Let's Encrypt over port 80 for the default
// names when they are domain names, the built-in certificate otherwise.
func (m *Manager) defaultState() state {
	if names, err := sslcfg.ValidateNames(sslcfg.MethodLetsEncryptHTTP, m.opts.DefaultNames); err == nil {
		return state{Method: sslcfg.MethodLetsEncryptHTTP, Names: names, Status: sslcfg.StatusIssuing}
	}
	return state{Method: sslcfg.MethodBuiltin, Status: sslcfg.StatusActive}
}

// Run issues the Let's Encrypt certificate that waits and renews it when due: at once,
// every 15 minutes and when a request asks for it. It returns when ctx ends, after the
// issuance that runs stopped; that one is resumed at the next start.
func (m *Manager) Run(ctx context.Context) {
	var issuances sync.WaitGroup
	defer issuances.Wait()
	ticker := time.NewTicker(sslcfg.RenewCheckInterval)
	defer ticker.Stop()
	for {
		m.check(ctx, &issuances)
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		case <-m.kick:
		}
	}
}

// wakeRun asks Run to look at the certificate now.
func (m *Manager) wakeRun() {
	select {
	case m.kick <- struct{}{}:
	default: // a wake-up waits already
	}
}

// changed tells the front that the certificate to serve changed. The caller does not
// hold m.mu.
func (m *Manager) changed() {
	if m.opts.Changed != nil {
		m.opts.Changed()
	}
}

// save writes the state file; a failure is logged, and the state in memory stays, so the
// next save writes it. The caller holds m.mu.
func (m *Manager) save() {
	if err := writeState(m.opts.Dir, &m.st); err != nil {
		m.log.Error("write the https state file", "error", err)
	}
}

// ServedCertificate returns the certificate to serve now. force reads the certificate
// files again even when they look unchanged. An error means not even the built-in
// certificate can be made.
func (m *Manager) ServedCertificate(_ context.Context, force bool) (Served, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.servedLocked(m.now(), force)
}

// servedLocked chooses the certificate to serve at now. The caller holds m.mu.
func (m *Manager) servedLocked(now time.Time, force bool) (Served, error) {
	switch m.st.Method {
	case sslcfg.MethodBuiltin:
		return m.builtinServed(now, "")
	case sslcfg.MethodFile:
		return m.servedFile(now, force)
	case sslcfg.MethodLetsEncryptHTTP, sslcfg.MethodLetsEncryptCloudflare, sslcfg.MethodUploaded:
	}
	if !m.st.HasCert {
		// A first Let's Encrypt certificate waits: Settings > HTTPS shows its state.
		return m.builtinServed(now, "")
	}
	if m.pair == nil || force {
		certPath, keyPath := pairPaths(m.opts.Dir)
		pair, err := certs.Load(certPath, keyPath, certs.LoadOptions{Now: now})
		if err != nil {
			m.pair = nil
			m.markExpired(now)
			return m.builtinServed(now, unusableText(m.certName(), m.st.NotAfter, err)+fallbackText(m.st.Method))
		}
		m.pair = pair
	}
	if !now.Before(m.pair.Info.NotAfter) {
		m.markExpired(now)
		return m.builtinServed(now, "The certificate "+m.certName()+" expired on "+sslcfg.FormatDate(m.pair.Info.NotAfter)+
			"."+fallbackText(m.st.Method))
	}
	return Served{Pair: m.pair, Method: m.st.Method, Name: m.certName()}, nil
}

// markExpired records that the certificate of CertFile expired: a Let's Encrypt one
// renews at once (Run). The caller holds m.mu.
func (m *Manager) markExpired(now time.Time) {
	if m.st.Status != sslcfg.StatusActive || m.st.NotAfter.IsZero() || now.Before(m.st.NotAfter) {
		return
	}
	m.st.Status = sslcfg.StatusExpired
	m.save()
	m.log.Warn("the certificate expired", "method", string(m.st.Method), "not_after", m.st.NotAfter)
	if m.st.Method.LetsEncrypt() {
		m.wakeRun()
	}
}

// certName returns the name of the certificate of CertFile.
func (m *Manager) certName() string {
	if m.pair != nil {
		if name := sslcfg.DisplayName(m.pair.Info.SANs()); name != "" {
			return name
		}
	}
	if name := sslcfg.DisplayName(m.st.Names); name != "" {
		return name
	}
	return "in use"
}

// builtinServed returns the built-in certificate with problem, renewing it when due.
func (m *Manager) builtinServed(now time.Time, problem string) (Served, error) {
	pair, err := m.ensureBuiltin(now)
	if err != nil {
		return Served{}, err
	}
	return Served{Pair: pair, Method: sslcfg.MethodBuiltin, Name: builtinName, Problem: problem}, nil
}

// ensureBuiltin returns the built-in self-signed certificate, made, renewed or loaded
// from SelfSignedDir when needed. While a renewal fails, the current one stays.
func (m *Manager) ensureBuiltin(now time.Time) (*certs.Pair, error) {
	if m.builtin != nil && !certs.NeedsRenewal(m.builtin.Info.NotAfter, now) {
		return m.builtin, nil
	}
	opts, err := certs.LocalSelfSignedOptions(m.opts.Hosts...)
	if err != nil {
		m.log.Warn("cannot read the host name and addresses for the self-signed certificate", "error", err)
		opts = certs.SelfSignedOptions{Hosts: m.opts.Hosts}
	}
	res, err := certs.EnsureSelfSigned(m.opts.SelfSignedDir, opts, now)
	if err != nil {
		err = fmt.Errorf("prepare the self-signed certificate in %s: %w", m.opts.SelfSignedDir, err)
		if m.builtin != nil {
			m.log.Warn("the self-signed certificate cannot be renewed: keeping the current one", "error", err)
			return m.builtin, nil
		}
		return nil, err
	}
	attrs := []any{"dir", m.opts.SelfSignedDir, "not_after", res.Pair.Info.NotAfter, "fingerprint_sha256",
		res.Pair.Info.Fingerprint}
	switch res.Action {
	case certs.SelfSignedKept:
	case certs.SelfSignedCreated:
		if res.Replaced != nil {
			m.log.Warn("replaced the self-signed certificate that could not be used", append(attrs, "reason", res.Replaced.Error())...)
		} else {
			m.log.Info("created the self-signed certificate", attrs...)
		}
	case certs.SelfSignedRenewed:
		m.log.Info("renewed the self-signed certificate", attrs...)
	}
	m.builtin = res.Pair
	return res.Pair, nil
}

// servedFile returns the certificate of the file method. Its files are read again when
// they changed since they were last read, or always with force or while they could not
// be used; a good new pair becomes the copy in CertFile. Files that cannot be used mark
// the certificate unreadable (or expired) and leave the copy served while it is valid,
// then the built-in certificate. The caller holds m.mu.
func (m *Manager) servedFile(now time.Time, force bool) (Served, error) {
	if !force && m.filePair != nil && now.Before(m.filePair.Info.NotAfter) &&
		filesUnchanged(m.filePair, m.st.CertPath, m.st.KeyPath) {
		return Served{Pair: m.filePair, Method: sslcfg.MethodFile, Name: m.certName()}, nil
	}
	pair, loadErr := certs.Load(m.st.CertPath, m.st.KeyPath, certs.LoadOptions{Now: now})
	if loadErr == nil {
		m.useFilePair(pair)
		return Served{Pair: pair, Method: sslcfg.MethodFile, Name: m.certName()}, nil
	}
	m.filePair = nil
	problem := certsText(loadErr)
	status := sslcfg.StatusUnreadable
	if verr, ok := errors.AsType[*certs.ValidationError](loadErr); ok && verr.Code == certs.CodeCertExpired {
		status = sslcfg.StatusExpired
	}
	if m.st.Status != status || m.st.LastProblem != problem {
		m.st.Status, m.st.LastProblem, m.st.LastProblemAt = status, problem, now.UTC()
		m.save()
		m.log.Warn("the certificate files cannot be used", "cert_path", m.st.CertPath, "problem", problem)
	}
	if m.pair != nil && now.Before(m.pair.Info.NotAfter) {
		return Served{Pair: m.pair, Method: sslcfg.MethodFile, Name: m.certName(), Problem: problem +
			" xDesign serves the last good copy of the files until it expires on " + sslcfg.FormatDate(m.pair.Info.NotAfter) + "."}, nil
	}
	return m.builtinServed(now, problem+fallbackText(sslcfg.MethodFile))
}

// useFilePair records pair, just read from the files of the file method: a new
// certificate becomes the copy in CertFile. The caller holds m.mu.
func (m *Manager) useFilePair(pair *certs.Pair) {
	m.filePair = pair
	if m.st.HasCert && m.st.Fingerprint == pair.Info.Fingerprint && m.st.Status == sslcfg.StatusActive &&
		m.st.LastProblem == "" {
		return
	}
	if m.st.Fingerprint != pair.Info.Fingerprint || !m.st.HasCert {
		if err := m.storePair(pair); err != nil {
			// The files are good: serve them; the copy is written at the next change.
			m.log.Warn("save the copy of the certificate files", "error", err)
		} else {
			m.log.Info("saved the new certificate of the certificate files", "cert_path", m.st.CertPath, "not_after",
				pair.Info.NotAfter, "fingerprint_sha256", pair.Info.Fingerprint)
		}
	} else {
		m.log.Info("the certificate files can be used again", "cert_path", m.st.CertPath)
	}
	m.st.Status, m.st.LastProblem, m.st.LastProblemAt = sslcfg.StatusActive, "", time.Time{}
	m.save()
}

// storePair writes pair as CertFile and KeyFile and records it in the state, unsaved.
// The caller holds m.mu.
func (m *Manager) storePair(pair *certs.Pair) error {
	chain, key, err := pair.PEM()
	if err != nil {
		return err
	}
	defer clear(key)
	if err := writePair(m.opts.Dir, chain, key); err != nil {
		return err
	}
	m.pair = pair
	m.st.HasCert = true
	m.st.NotBefore, m.st.NotAfter = pair.Info.NotBefore.UTC(), pair.Info.NotAfter.UTC()
	m.st.Fingerprint = pair.Info.Fingerprint
	return nil
}

// filesUnchanged reports whether the files at certPath and keyPath are still the
// versions pair was read from.
func filesUnchanged(pair *certs.Pair, certPath, keyPath string) bool {
	c, err := certs.StatFile(certPath)
	if err != nil {
		return false
	}
	k, err := certs.StatFile(keyPath)
	if err != nil {
		return false
	}
	return c.Equal(pair.CertFile) && k.Equal(pair.KeyFile)
}

// unusableText says in plain words why the certificate called name cannot be served.
func unusableText(name string, notAfter time.Time, err error) string {
	if verr, ok := errors.AsType[*certs.ValidationError](err); ok {
		switch verr.Code {
		case certs.CodeCertExpired:
			return "The certificate " + name + " expired on " + sslcfg.FormatDate(notAfter) + "."
		case certs.CodeCertNotYetValid:
			return "The certificate " + name + " is not valid yet: check the date and time of this server."
		}
	}
	return "The certificate " + name + " cannot be used: " + strings.TrimSuffix(acme.ErrorText(err), ".") + "."
}

// certsText returns the plain-words message of a certificate check of internal/certs,
// as one line.
func certsText(err error) string {
	return strings.Join(strings.Fields(err.Error()), " ")
}

// fallbackText ends the problem of a certificate of method m that cannot be used: the
// built-in certificate is served until when.
func fallbackText(m sslcfg.Method) string {
	switch m {
	case sslcfg.MethodLetsEncryptHTTP, sslcfg.MethodLetsEncryptCloudflare:
		return " xDesign serves its built-in certificate until it is renewed or another certificate is in use."
	case sslcfg.MethodUploaded:
		return " xDesign serves its built-in certificate until you replace it or use another certificate."
	case sslcfg.MethodFile:
		return " xDesign serves its built-in certificate until the files hold a valid certificate."
	case sslcfg.MethodBuiltin:
	}
	return " xDesign serves its built-in certificate until another certificate is in use."
}

// Choice is the body of PUT /https: the method with its fields.
type Choice struct {
	Method sslcfg.Method `json:"method"`
	// Names are the domain names of a Let's Encrypt certificate.
	Names []string `json:"names,omitempty"`
	// CloudflareToken is the API token of letsencrypt_cloudflare; empty keeps the saved
	// one.
	CloudflareToken string `json:"cloudflare_token,omitempty"`
	// CertFile and KeyFile are the paths of the file method.
	CertFile string `json:"cert_file,omitempty"`
	KeyFile  string `json:"key_file,omitempty"`
}

// Choose puts the method of c in use. A Let's Encrypt method starts an issuance unless
// the same names are issued or issuing already; the file method reads the files first
// and refuses files that cannot be used. The error is a *RequestError.
func (m *Manager) Choose(c Choice) (View, error) {
	m.mu.Lock()
	if err := m.idleLocked(); err != nil {
		m.mu.Unlock()
		return View{}, err
	}
	var err error
	switch c.Method {
	case sslcfg.MethodBuiltin:
		err = m.chooseBuiltin()
	case sslcfg.MethodLetsEncryptHTTP, sslcfg.MethodLetsEncryptCloudflare:
		err = m.chooseLetsEncrypt(c)
	case sslcfg.MethodFile:
		err = m.chooseFile(c)
	case sslcfg.MethodUploaded:
		err = invalid("Paste the certificate and its key to use your own certificate.")
	default:
		err = invalid("Choose one of the methods: builtin, letsencrypt_http, letsencrypt_cloudflare, file or uploaded.")
	}
	if err != nil {
		m.mu.Unlock()
		return View{}, err
	}
	m.log.Info("https method chosen", "method", string(m.st.Method), "names", strings.Join(m.st.Names, ","))
	v := m.viewLocked()
	m.mu.Unlock()
	m.changed()
	return v, nil
}

// idleLocked refuses a change while Let's Encrypt works on the certificate. The caller
// holds m.mu.
func (m *Manager) idleLocked() error {
	if m.run != nil {
		return conflict("Let's Encrypt is already working on this certificate. Wait until it finishes.")
	}
	return nil
}

// chooseBuiltin puts the built-in certificate in use and removes the certificate files.
// The caller holds m.mu.
func (m *Manager) chooseBuiltin() error {
	if err := removePair(m.opts.Dir); err != nil {
		return err
	}
	token := m.st.CloudflareToken
	m.st = state{Method: sslcfg.MethodBuiltin, Status: sslcfg.StatusActive, CloudflareToken: token, Account: m.st.Account}
	m.pair, m.filePair = nil, nil
	m.save()
	return nil
}

// chooseLetsEncrypt puts a Let's Encrypt method in use for the names of c and queues its
// issuance; the certificate served now stays until the new one is issued. The caller
// holds m.mu.
func (m *Manager) chooseLetsEncrypt(c Choice) error {
	names, err := sslcfg.ValidateNames(c.Method, c.Names)
	if err != nil {
		return invalid(err.Error())
	}
	token := strings.TrimSpace(c.CloudflareToken)
	if c.Method == sslcfg.MethodLetsEncryptCloudflare {
		switch {
		case token == "" && m.st.CloudflareToken == "":
			return invalid("Give the Cloudflare API token: it needs Zone Read and DNS Edit for " + zoneHint(names) + ".")
		case !ValidToken(token):
			return invalid("The Cloudflare API token is not valid: copy it again from Cloudflare (My Profile > API Tokens).")
		}
	}
	tokenChanged := token != "" && token != m.st.CloudflareToken
	if token != "" {
		m.st.CloudflareToken = token
	}
	same := m.st.Method == c.Method && sslcfg.SameNames(m.st.Names, names) && m.st.Status != sslcfg.StatusFailed
	if same && !tokenChanged {
		return nil
	}
	if same && m.st.FromLetsEncrypt {
		// Only the token changed: the certificate stays and the next renewal uses it.
		m.save()
		return nil
	}
	m.st.Method, m.st.Names = c.Method, names
	m.st.CertPath, m.st.KeyPath = "", ""
	m.st.Status, m.st.FromLetsEncrypt, m.st.ARI, m.st.RenewAt = sslcfg.StatusIssuing, false, nil, time.Time{}
	m.st.Failures, m.st.NextAttemptAt, m.st.LastProblem, m.st.LastProblemAt = 0, time.Time{}, "", time.Time{}
	m.st.Log = []sslcfg.LogEntry{sslcfg.NewLogEntry(m.now(), sslcfg.LogInfo, "Waiting to ask Let's Encrypt for "+
		strings.Join(names, ", "))}
	m.filePair = nil
	m.save()
	m.wakeRun()
	return nil
}

// ValidToken reports whether token has the form of a Cloudflare API token: at most
// maxTokenLen printable ASCII characters without spaces. Settings > HTTPS and the
// installer's question check it so; an empty token passes, for the caller to judge.
func ValidToken(token string) bool {
	return len(token) <= maxTokenLen && !strings.ContainsFunc(token, func(r rune) bool { return r <= ' ' || r > '~' })
}

// zoneHint names the zone a Cloudflare token must reach for names.
func zoneHint(names []string) string {
	if len(names) == 0 {
		return "the domain"
	}
	return acme.ZoneOf(names[0])
}

// chooseFile puts the certificate files of c in use once they pass the checks of
// internal/certs; a copy goes to CertFile. The caller holds m.mu.
func (m *Manager) chooseFile(c Choice) error {
	certPath, keyPath := strings.TrimSpace(c.CertFile), strings.TrimSpace(c.KeyFile)
	if certPath == "" || keyPath == "" {
		return invalid("Give the paths of the certificate file and of its key file, for example " + certs.ExampleDir +
			"fullchain.pem and privkey.pem beside it.")
	}
	now := m.now()
	pair, err := certs.Load(certPath, keyPath, certs.LoadOptions{Now: now})
	if err != nil {
		return invalid(certsText(err))
	}
	if err := m.storePair(pair); err != nil {
		return err
	}
	token := m.st.CloudflareToken
	m.st = state{Method: sslcfg.MethodFile, Status: sslcfg.StatusActive, CertPath: certPath, KeyPath: keyPath,
		CloudflareToken: token, Account: m.st.Account, HasCert: true, NotBefore: m.st.NotBefore, NotAfter: m.st.NotAfter,
		Fingerprint: m.st.Fingerprint}
	m.filePair = pair
	m.save()
	return nil
}

// Upload puts a pasted certificate and its key in use: xmtp panel's checks
// (parseUpload), then those of internal/certs. The answer lists what was left out of the
// bundle. The error is a *RequestError.
func (m *Manager) Upload(certPEM, keyPEM []byte) (View, error) {
	now := m.now()
	p, err := parseUpload(certPEM, keyPEM, now)
	if err != nil {
		var uerr *UploadError
		if errors.As(err, &uerr) {
			return View{}, invalid(uerr.Message)
		}
		return View{}, err
	}
	defer clear(p.keyPEM)
	pair, err := certs.Parse(p.chainPEM, p.keyPEM, "the certificate", "the key", certs.LoadOptions{Now: now})
	if err != nil {
		return View{}, invalid(certsText(err))
	}
	m.mu.Lock()
	if err := m.idleLocked(); err != nil {
		m.mu.Unlock()
		return View{}, err
	}
	if err := m.storePair(pair); err != nil {
		m.mu.Unlock()
		return View{}, err
	}
	token := m.st.CloudflareToken
	m.st = state{Method: sslcfg.MethodUploaded, Status: sslcfg.StatusActive, CloudflareToken: token,
		Account: m.st.Account, HasCert: true, NotBefore: m.st.NotBefore, NotAfter: m.st.NotAfter, Fingerprint: m.st.Fingerprint}
	m.filePair = nil
	m.save()
	m.log.Info("pasted certificate in use", "names", strings.Join(p.names, ","), "not_after", pair.Info.NotAfter,
		"fingerprint_sha256", pair.Info.Fingerprint)
	v := m.viewLocked()
	v.LeftOut = p.dropped
	m.mu.Unlock()
	m.changed()
	return v, nil
}

// IssueNow is "Try now": a Let's Encrypt certificate is issued or renewed at once,
// whatever the backoff; the files of the file method are read again. The error is a
// *RequestError.
func (m *Manager) IssueNow() (View, error) {
	m.mu.Lock()
	switch m.st.Method {
	case sslcfg.MethodLetsEncryptHTTP, sslcfg.MethodLetsEncryptCloudflare:
		if err := m.idleLocked(); err != nil {
			m.mu.Unlock()
			return View{}, err
		}
		if m.st.Status != sslcfg.StatusIssuing && m.st.Status != sslcfg.StatusRenewing {
			m.st.Status = sslcfg.StatusIssuing
			if m.renewable() {
				m.st.Status = sslcfg.StatusRenewing
			}
		}
		m.st.NextAttemptAt = time.Time{}
		m.save()
		m.wakeRun()
	case sslcfg.MethodFile:
		_, _ = m.servedFile(m.now(), true) // a problem is in the state; the built-in one never fails here
	case sslcfg.MethodUploaded:
		m.mu.Unlock()
		return View{}, conflict("Only Let's Encrypt certificates renew here. Replace your own certificate instead.")
	case sslcfg.MethodBuiltin:
		m.mu.Unlock()
		return View{}, conflict("The built-in certificate renews itself. Choose Let's Encrypt to get a certificate browsers trust.")
	}
	v := m.viewLocked()
	m.mu.Unlock()
	m.changed()
	return v, nil
}

// renewable reports whether CertFile holds the Let's Encrypt certificate of the names in
// use, which a renewal replaces. The caller holds m.mu.
func (m *Manager) renewable() bool {
	return m.st.HasCert && m.st.FromLetsEncrypt
}

// check starts the issuance that waits, or the renewal that is due, unless one runs. The
// caller of Run passes its wait group.
func (m *Manager) check(ctx context.Context, issuances *sync.WaitGroup) {
	m.mu.Lock()
	if m.run != nil || !m.st.Method.LetsEncrypt() || ctx.Err() != nil {
		m.mu.Unlock()
		return
	}
	now := m.now()
	switch m.st.Status {
	case sslcfg.StatusIssuing:
		m.startLocked(ctx, issuances, false)
		m.mu.Unlock()
		return
	case sslcfg.StatusRenewing:
		if !m.renewable() {
			m.st.Status = sslcfg.StatusIssuing // nothing to renew: a first issuance
		}
		m.startLocked(ctx, issuances, m.st.Status == sslcfg.StatusRenewing)
		m.mu.Unlock()
		return
	case sslcfg.StatusFailed:
		// A first issuance that failed waits for "Try now" or another choice.
		m.mu.Unlock()
		return
	case sslcfg.StatusActive, sslcfg.StatusExpired, sslcfg.StatusUnreadable:
	}
	if !m.renewable() {
		m.mu.Unlock()
		return
	}
	m.markExpired(now)
	expired := !now.Before(m.st.NotAfter)
	var due, readARI bool
	switch {
	case !m.st.NextAttemptAt.IsZero():
		// After failed renewals the backoff decides; the next attempt clears it.
		due = !now.Before(m.st.NextAttemptAt)
	case expired:
		// Renew at once, and never ask for the renewal information of an expired
		// certificate (RFC 9773 section 4.3).
		due = true
	case m.st.ARI.Due(now):
		readARI = true
	default:
		due = !now.Before(m.renewAtLocked())
	}
	leaf, fingerprint, prev := m.leafLocked(), m.st.Fingerprint, m.st.ARI
	if readARI && leaf == nil {
		readARI, due = false, !now.Before(m.renewAtLocked())
	}
	fallback := sslcfg.RenewAt(m.st.NotBefore, m.st.NotAfter)
	directory := m.directoryLocked()
	m.mu.Unlock()

	if readARI {
		ari, at := m.readARI(ctx, directory, leaf, prev, fallback, now)
		m.mu.Lock()
		defer m.mu.Unlock()
		if m.run != nil || m.st.Fingerprint != fingerprint || !m.st.Method.LetsEncrypt() {
			return // changed meanwhile
		}
		m.st.ARI, m.st.RenewAt = ari, at
		m.save()
		if !now.Before(at) && m.st.Status != sslcfg.StatusRenewing {
			m.st.Status = sslcfg.StatusRenewing
			m.startLocked(ctx, issuances, true)
		}
		return
	}
	if due {
		m.mu.Lock()
		defer m.mu.Unlock()
		if m.run == nil && m.st.Fingerprint == fingerprint && m.st.Method.LetsEncrypt() {
			m.st.Status = sslcfg.StatusRenewing
			m.startLocked(ctx, issuances, true)
		}
	}
}

// leafLocked returns the leaf of CertFile, also of one that expired or cannot be served;
// nil when it cannot be read. The caller holds m.mu.
func (m *Manager) leafLocked() *x509.Certificate {
	if m.pair != nil {
		return m.pair.Certificate.Leaf
	}
	certPath, _ := pairPaths(m.opts.Dir)
	data, err := readSmall(certPath, maxStateSize)
	if err != nil {
		return nil
	}
	block, _ := pem.Decode(data)
	if block == nil || block.Type != "CERTIFICATE" {
		return nil
	}
	leaf, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil
	}
	return leaf
}

// renewAtLocked returns when the certificate renews: the time chosen in the CA's window,
// or two thirds of its lifetime. The caller holds m.mu.
func (m *Manager) renewAtLocked() time.Time {
	if !m.st.RenewAt.IsZero() {
		return m.st.RenewAt
	}
	return sslcfg.RenewAt(m.st.NotBefore, m.st.NotAfter)
}

// directoryLocked returns the ACME directory of the account, else of the options. The
// caller holds m.mu.
func (m *Manager) directoryLocked() string {
	if m.st.Account != nil && m.st.Account.Directory != "" {
		return m.st.Account.Directory
	}
	return m.opts.Directory
}

// readARI reads the renewal window of leaf (RFC 9773) and returns the renewal
// information to keep and the renewal time: a new random time for a new window, the time
// chosen before for the same window, fallback without renewal information.
func (m *Manager) readARI(ctx context.Context, directory string, leaf *x509.Certificate, prev *sslcfg.ARI,
	fallback, now time.Time,
) (*sslcfg.ARI, time.Time) {
	keep := func(reason string) (*sslcfg.ARI, time.Time) {
		out := &sslcfg.ARI{CheckedAt: now, NextCheckAt: now.Add(sslcfg.ARIRetryAfterError), Error: reason}
		at := fallback
		if prev != nil && !prev.Chosen.IsZero() {
			out.WindowStart, out.WindowEnd, out.Chosen, out.ExplanationURL = prev.WindowStart, prev.WindowEnd, prev.Chosen,
				prev.ExplanationURL
			at = prev.Chosen
		}
		return out, at
	}
	r, err := m.engine.RenewalInfo(ctx, m.httpClient(), directory, leaf)
	switch {
	case errors.Is(err, acme.ErrNoRenewalInfo):
		return &sslcfg.ARI{CheckedAt: now, NextCheckAt: now.Add(sslcfg.ARICheckInterval), Unsupported: true}, fallback
	case err != nil:
		m.log.Warn("read the renewal information of the certificate", "error", acme.ErrorText(err))
		return keep(acme.ErrorText(err))
	}
	ari := &sslcfg.ARI{WindowStart: r.Start, WindowEnd: r.End, ExplanationURL: r.ExplanationURL, CheckedAt: now,
		NextCheckAt: sslcfg.NextARICheck(now, r.RetryAfter)}
	if prev.SameWindow(r.Start, r.End) && !prev.Chosen.IsZero() {
		ari.Chosen = prev.Chosen // once per window, so renewals spread out
	} else {
		ari.Chosen = sslcfg.ChooseInWindow(r.Start, r.End, randomTimes{})
	}
	return ari, ari.Chosen
}

// randomTimes draws the renewal time inside a window: nothing secret, so math/rand/v2's
// generator is enough.
type randomTimes struct{}

// Int64N returns a uniform random number in [0, n).
func (randomTimes) Int64N(n int64) int64 {
	return rand.Int64N(n) //nolint:gosec // G404: a renewal time, not a secret
}

// httpClient returns the client of the calls to Let's Encrypt and Cloudflare.
func (m *Manager) httpClient() *http.Client {
	return &http.Client{Timeout: httpTimeout}
}

// issueJob is what an issuance needs of the state, copied when it starts.
type issueJob struct {
	method   sslcfg.Method
	names    []string
	token    string
	renew    bool
	replaces *x509.Certificate
}

// startLocked starts the issuance (or renewal) the state waits for, in its own goroutine
// that issuances waits for. The caller holds m.mu and has set the status.
func (m *Manager) startLocked(ctx context.Context, issuances *sync.WaitGroup, renew bool) {
	job := issueJob{method: m.st.Method, names: slices.Clone(m.st.Names), token: m.st.CloudflareToken, renew: renew}
	if renew {
		job.replaces = m.leafLocked() // nil when it cannot be read: the renewal does not name it
	}
	run := &issueRun{now: m.now}
	names := strings.Join(job.names, ", ")
	if renew {
		run.add(sslcfg.LogInfo, "Asking Let's Encrypt to renew the certificate for "+names)
	} else {
		run.add(sslcfg.LogInfo, "Asking Let's Encrypt for "+names)
	}
	m.run = run
	m.save()
	m.log.Info("let's encrypt issuance started", "method", string(job.method), "domains", names, "renew", renew)
	issuances.Go(func() { m.issue(ctx, run, job) })
}

// issue runs one issuance and records its result. When ctx ends first (the helper
// stops), the state keeps waiting for it, and the next start runs it again.
func (m *Manager) issue(ctx context.Context, run *issueRun, job issueJob) {
	orderCtx, cancel := context.WithTimeout(ctx, issueTimeout)
	defer cancel()
	certPEM, keyPEM, problem := m.order(orderCtx, run, job)
	defer clear(keyPEM)
	if ctx.Err() != nil {
		m.mu.Lock()
		m.run = nil
		m.st.Log = run.entries()
		m.save()
		m.mu.Unlock()
		m.log.Info("let's encrypt issuance stopped with the helper; it runs again at the next start")
		return
	}
	if problem != nil {
		m.failed(run, job, *problem)
		return
	}
	m.succeeded(run, job, certPEM, keyPEM)
}

// order asks Let's Encrypt for the certificate of job. A problem is a failure of the
// issuance in plain words.
func (m *Manager) order(ctx context.Context, run *issueRun, job issueJob) (certPEM, keyPEM []byte, problem *sslcfg.Problem) {
	dnsOrder := job.method == sslcfg.MethodLetsEncryptCloudflare
	fail := func(cause sslcfg.Cause, detail string) ([]byte, []byte, *sslcfg.Problem) {
		return nil, nil, &sslcfg.Problem{Cause: cause, Domain: sslcfg.DisplayName(job.names), Detail: detail}
	}
	req := acme.IssueRequest{HTTPClient: m.httpClient(), Domains: job.names, Replaces: job.replaces, Log: run.add}
	if dnsOrder {
		if job.token == "" {
			return fail(sslcfg.CauseNoToken, "")
		}
		req.CloudflareToken = job.token
	} else {
		if m.opts.ListenPort == 80 {
			return fail(sslcfg.CauseSelfOnPort80, "")
		}
		req.HTTP01 = &http01Solver{m: m, run: run}
	}
	acct, err := m.account()
	if err != nil {
		return fail(sslcfg.CauseOther, acme.ErrorText(err))
	}
	if p := m.preflight(ctx, run, job.names, dnsOrder, acct.Registration.URI); p != nil {
		return nil, nil, p
	}
	req.Account = acct
	res, issueErr := m.engine.Issue(ctx, req)
	if res.RegistrationChanged {
		m.mu.Lock()
		if m.st.Account != nil && m.st.Account.Directory == acct.DirectoryURL {
			m.st.Account.Registration = res.Registration
			m.save()
		}
		m.mu.Unlock()
	}
	if issueErr != nil {
		p := acme.Explain(issueErr, job.names, dnsOrder, m.now())
		run.add(sslcfg.LogError, "Details: "+acme.ErrorText(issueErr))
		return nil, nil, &p
	}
	return res.CertPEM, res.KeyPEM, nil
}

// account returns the Let's Encrypt account of the directory, making and saving a new
// key the first time (or for another directory).
func (m *Manager) account() (acme.Account, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	dir := m.opts.Directory
	if a := m.st.Account; a != nil && a.Directory == dir {
		key, err := acme.DecodeKey([]byte(a.KeyPEM))
		if err != nil {
			return acme.Account{}, err
		}
		return acme.Account{DirectoryURL: dir, Key: key, Registration: a.Registration}, nil
	}
	key, err := acme.NewAccountKey()
	if err != nil {
		return acme.Account{}, err
	}
	keyPEM, err := acme.EncodeKey(key)
	if err != nil {
		return acme.Account{}, err
	}
	m.st.Account = &account{Directory: dir, KeyPEM: string(keyPEM)}
	clear(keyPEM)
	m.save()
	return acme.Account{DirectoryURL: dir, Key: key}, nil
}

// preflight runs xmtp panel's domain preflight for names and writes what it finds to the
// log. It stops the order only on what Let's Encrypt would surely refuse: a CAA record
// that forbids it, and for HTTP-01 a name without an address, when the resolvers
// answered.
func (m *Manager) preflight(ctx context.Context, run *issueRun, names []string, dnsOrder bool, accountURI string) *sslcfg.Problem {
	ctx, cancel := context.WithTimeout(ctx, preflightTimeout)
	defer cancel()
	method := "http-01"
	if dnsOrder {
		method = "dns-01"
	}
	serverIPs, err := certs.HostAddresses()
	if err != nil {
		serverIPs = nil // the check of the addresses is left out
	}
	for _, name := range names {
		findings := runPreflight(ctx, preflightInput{domain: name, serverIPs: serverIPs, method: method,
			resolvers: acme.Resolvers(), caaIdentities: []string{letsEncryptCAA}, accountURI: accountURI})
		resolverFailed := slices.ContainsFunc(findings, func(f finding) bool { return f.code == "resolver_error" })
		for _, f := range findings {
			switch {
			case f.code == "caa_forbids":
				run.add(sslcfg.LogError, "Preflight: "+f.msg)
				return &sslcfg.Problem{Cause: sslcfg.CauseCAA, Domain: name}
			case f.code == "no_address" && !dnsOrder && !resolverFailed:
				run.add(sslcfg.LogError, "Preflight: "+f.msg)
				return &sslcfg.Problem{Cause: sslcfg.CauseWrongDNS, Domain: name}
			case f.level == levelError, f.level == levelWarn:
				run.add(sslcfg.LogWarning, "Preflight: "+f.msg)
			case f.level == levelOK:
			}
		}
	}
	return nil
}

// succeeded stores the certificate Let's Encrypt issued for job and serves it.
func (m *Manager) succeeded(run *issueRun, job issueJob, certPEM, keyPEM []byte) {
	now := m.now()
	pair, err := certs.Parse(certPEM, keyPEM, "", "", certs.LoadOptions{Now: now})
	if err != nil {
		m.failed(run, job, sslcfg.Problem{Cause: sslcfg.CauseOther, Domain: sslcfg.DisplayName(job.names),
			Detail: "Let's Encrypt sent a certificate xDesign cannot use: " + acme.ErrorText(err)})
		return
	}
	run.add(sslcfg.LogInfo, "Let's Encrypt checked "+strings.Join(job.names, ", "))
	run.add(sslcfg.LogInfo, "Certificate issued, valid until "+sslcfg.FormatDate(pair.Info.NotAfter))
	m.mu.Lock()
	if err := m.storePair(pair); err != nil {
		m.mu.Unlock()
		m.failed(run, job, sslcfg.Problem{Cause: sslcfg.CauseStopped, Domain: sslcfg.DisplayName(job.names),
			Detail: "the certificate files could not be written (" + acme.ErrorText(err) + ")"})
		return
	}
	m.st.Status, m.st.FromLetsEncrypt, m.st.IssuedAt = sslcfg.StatusActive, true, now.UTC()
	m.st.RenewAt, m.st.ARI = sslcfg.RenewAt(pair.Info.NotBefore, pair.Info.NotAfter), nil
	m.st.Failures, m.st.NextAttemptAt, m.st.LastProblem, m.st.LastProblemAt = 0, time.Time{}, "", time.Time{}
	m.st.Log = run.entries()
	m.run = nil
	m.save()
	m.mu.Unlock()
	m.log.Info("let's encrypt certificate issued", "renew", job.renew, "not_after", pair.Info.NotAfter,
		"fingerprint_sha256", pair.Info.Fingerprint)
	m.changed()
}

// failed records the failure p of an issuance or renewal: a first issuance fails, a
// renewal keeps its certificate (active, or expired past its end) and tries again after
// the backoff.
func (m *Manager) failed(run *issueRun, job issueJob, p sslcfg.Problem) {
	text := p.Text()
	run.add(sslcfg.LogError, text)
	now := m.now()
	m.mu.Lock()
	m.st.Status = sslcfg.StatusFailed
	if job.renew {
		m.st.Status = sslcfg.StatusActive
		if !m.st.NotAfter.IsZero() && !now.Before(m.st.NotAfter) {
			m.st.Status = sslcfg.StatusExpired
		}
		m.st.Failures++
		m.st.NextAttemptAt = now.Add(sslcfg.RetryDelay(m.st.Failures)).UTC()
		if p.RetryAfter.After(m.st.NextAttemptAt) {
			m.st.NextAttemptAt = p.RetryAfter.UTC()
		}
	}
	m.st.LastProblem, m.st.LastProblemAt = text, now.UTC()
	m.st.Log = run.entries()
	m.run = nil
	failures, next := m.st.Failures, m.st.NextAttemptAt
	m.save()
	m.mu.Unlock()
	m.log.Warn("let's encrypt issuance failed", "renew", job.renew, "cause", string(p.Cause), "failures", failures,
		"next_attempt_at", next, "reason", text)
}

// issueRun collects the log of one issuance or renewal.
type issueRun struct {
	now func() time.Time

	mu   sync.Mutex
	log  []sslcfg.LogEntry
	seen map[string]bool
}

// add appends a line, redacted, keeping the last sslcfg.MaxLogEntries.
func (r *issueRun) add(level sslcfg.LogLevel, text string) {
	entry := sslcfg.NewLogEntry(r.now(), level, acme.Redact(text))
	r.mu.Lock()
	defer r.mu.Unlock()
	r.log = append(r.log, entry)
	if over := len(r.log) - sslcfg.MaxLogEntries; over > 0 {
		r.log = slices.Delete(r.log, 0, over)
	}
}

// addOnce appends a line unless the same text was added already.
func (r *issueRun) addOnce(level sslcfg.LogLevel, text string) {
	r.mu.Lock()
	if r.seen[text] {
		r.mu.Unlock()
		return
	}
	if r.seen == nil {
		r.seen = map[string]bool{}
	}
	r.seen[text] = true
	r.mu.Unlock()
	r.add(level, text)
}

// entries returns a copy of the log.
func (r *issueRun) entries() []sslcfg.LogEntry {
	r.mu.Lock()
	defer r.mu.Unlock()
	return slices.Clone(r.log)
}
