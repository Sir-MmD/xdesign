package acme

import (
	"context"
	"crypto"
	"crypto/x509"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"sync"
	"sync/atomic"
	"time"

	legoacme "github.com/go-acme/lego/v5/acme"
	"github.com/go-acme/lego/v5/acme/api"
	"github.com/go-acme/lego/v5/certcrypto"
	"github.com/go-acme/lego/v5/certificate"
	"github.com/go-acme/lego/v5/challenge/dns01"
	"github.com/go-acme/lego/v5/lego"
	legolog "github.com/go-acme/lego/v5/log"
	"github.com/go-acme/lego/v5/registration"

	ssl "github.com/Sir-MmD/xdesign/helper/internal/ssl/domain"
)

// The Let's Encrypt directories: production, and staging for `serve --dev`.
const (
	DirectoryLetsEncrypt        = lego.DirectoryURLLetsEncrypt
	DirectoryLetsEncryptStaging = lego.DirectoryURLLetsEncryptStaging
)

const (
	// certificateTimeout bounds the wait for an order to be finalized and for its
	// certificate.
	certificateTimeout = 90 * time.Second
	// dnsTimeout bounds one DNS query of the DNS-01 checks.
	dnsTimeout = 10 * time.Second
	// mailto starts the email contact of an account.
	mailto = "mailto:"
)

// Resolvers returns the DNS servers the DNS-01 checks ask unless Options names others:
// 1.1.1.1 and 8.8.8.8, never the server's own resolver, which may see an older
// state of the zone.
func Resolvers() []string {
	return []string{"1.1.1.1:53", "8.8.8.8:53"}
}

// Options configure an Engine.
type Options struct {
	// UserAgent is sent with the ACME and Cloudflare calls, for example "xDesign/1.4.0";
	// lego adds its own name.
	UserAgent string
	// Logger receives lego's records at debug level, redacted.
	Logger *slog.Logger
	// Now dates the registrations; nil means time.Now.
	Now func() time.Time
	// Resolvers are the DNS servers (host:port) of the DNS-01 checks; nil means
	// Resolvers().
	Resolvers []string
	// PropagationTimeout is how long a DNS-01 order waits for its TXT records; 0 means
	// ssl.TXTWait (3 minutes).
	PropagationTimeout time.Duration
}

// Engine orders certificates from an ACME directory. Make one per process with New: it
// installs lego's process-wide logger and DNS client. Issue runs one order at a time;
// RenewalInfo may run beside it.
type Engine struct {
	userAgent   string
	log         *slog.Logger
	now         func() time.Time
	propagation time.Duration

	// mu lets one Issue run at a time, so lego's records reach the right sink.
	mu sync.Mutex
	// sink receives lego's records of the order that runs; nil between orders.
	sink atomic.Pointer[LogFunc]
}

// LogFunc receives log lines of an order: the engine's steps in plain words and lego's
// records, redacted.
type LogFunc func(level ssl.LogLevel, text string)

// New returns the Engine of the process and points lego's logger and DNS client at it.
func New(o Options) *Engine {
	e := &Engine{userAgent: o.UserAgent, log: o.Logger, now: o.Now, propagation: o.PropagationTimeout}
	if e.log == nil {
		e.log = slog.New(slog.DiscardHandler)
	}
	if e.now == nil {
		e.now = time.Now
	}
	if e.propagation <= 0 {
		e.propagation = ssl.TXTWait
	}
	resolvers := o.Resolvers
	if len(resolvers) == 0 {
		resolvers = Resolvers()
	}
	legolog.SetDefault(slog.New(&legoHandler{e: e}))
	dns01.SetDefaultClient(dns01.NewClient(&dns01.Options{RecursiveNameservers: slices.Clone(resolvers),
		Timeout: dnsTimeout}))
	return e
}

// Account is xDesign's account at an ACME directory (in the manager's state file).
type Account struct {
	DirectoryURL string
	// Email is the contact the account should have; empty for none. Issue updates the
	// account when its registered contact differs.
	Email string
	// Key signs the account's requests (ECDSA P-256).
	Key crypto.Signer
	// Registration is what xDesign knows of the account; Issue registers an account
	// that has no URI yet.
	Registration ssl.Registration
}

// HTTPSolver answers the HTTP-01 challenges of an order. The manager's solver keeps the
// answer for the front's port-80 answerer.
type HTTPSolver interface {
	// Present makes http://<domain>/.well-known/acme-challenge/<token> answer keyAuth and
	// returns once it does. When port 80 cannot answer it returns ErrPort80Taken,
	// ErrPort80Closed or ErrSelfOnPort80, wrapped.
	Present(ctx context.Context, domain, token, keyAuth string) error
	// CleanUp removes the answer once Let's Encrypt checked it.
	CleanUp(ctx context.Context, domain, token, keyAuth string) error
}

// IssueRequest is one order.
type IssueRequest struct {
	// HTTPClient makes the ACME and Cloudflare calls. Required.
	HTTPClient *http.Client
	Account    Account
	// Domains are the names of the certificate, the first one the domain the owner typed.
	Domains []string
	// HTTP01 answers HTTP-01, for letsencrypt_http; CloudflareToken answers DNS-01 through
	// Cloudflare, for letsencrypt_cloudflare. Exactly one is set.
	HTTP01          HTTPSolver
	CloudflareToken string
	// Replaces is the certificate a renewal replaces (RFC 9773), nil for a first issuance.
	Replaces *x509.Certificate
	// Log receives the order's log lines; nil discards them.
	Log LogFunc
}

// IssueResult is what Issue made.
type IssueResult struct {
	// Registration is the account's registration after the call. When
	// RegistrationChanged is set, the call registered or updated the account: save it,
	// whether the order succeeded or not.
	Registration        ssl.Registration
	RegistrationChanged bool
	// CertPEM is the full chain, leaf first, and KeyPEM its new private key (ECDSA P-256,
	// PEM), both set when the order succeeded.
	CertPEM []byte
	KeyPEM  []byte
}

// Issue registers the account when needed and orders a certificate for r.Domains with a
// new ECDSA P-256 key. It returns the registration whatever happens; on failure,
// Explain says why in plain words.
func (e *Engine) Issue(ctx context.Context, r IssueRequest) (IssueResult, error) {
	res := IssueResult{Registration: r.Account.Registration}
	switch {
	case r.HTTPClient == nil:
		return res, errors.New("order a certificate: no HTTP client")
	case len(r.Domains) == 0:
		return res, errors.New("order a certificate: no names")
	case (r.HTTP01 == nil) == (r.CloudflareToken == ""):
		return res, errors.New("order a certificate: give an HTTP-01 solver or a Cloudflare token")
	case r.Account.Key == nil:
		return res, errors.New("order a certificate: no account key")
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	logf := r.Log
	if logf == nil {
		logf = func(ssl.LogLevel, string) {}
	}
	e.sink.Store(&logf)
	defer e.sink.Store(nil)

	user := &legoUser{email: r.Account.Email, key: r.Account.Key, reg: extendedAccount(r.Account.Registration)}
	client, err := e.client(r.Account.DirectoryURL, user, r.HTTPClient)
	if err != nil {
		return res, err
	}
	terms := client.GetServerMetadata().TermsOfService
	if !r.Account.Registration.Registered() {
		if res.Registration, err = e.register(ctx, client, user, terms, logf); err != nil {
			return res, err
		}
		res.RegistrationChanged = true
	} else if !slices.Equal(r.Account.Registration.Contact, contact(r.Account.Email)) {
		acct, err := client.Registration.UpdateRegistration(ctx, registration.RegisterOptions{TermsOfServiceAgreed: true})
		if err != nil {
			logf(ssl.LogWarning, "The email of the Let's Encrypt account could not be changed: "+err.Error())
		} else {
			reg := registrationOf(acct, user.email, r.Account.Registration.TermsOfService, r.Account.Registration.AgreedAt)
			res.Registration, res.RegistrationChanged, user.reg = reg, true, acct
		}
	}
	if r.HTTP01 != nil {
		if err := client.Challenge.SetHTTP01Provider(r.HTTP01); err != nil {
			return res, fmt.Errorf("set up HTTP-01: %w", err)
		}
	} else {
		provider, err := e.cloudflare(r.CloudflareToken, r.HTTPClient, logf)
		if err != nil {
			return res, err
		}
		if err := client.Challenge.SetDNS01Provider(provider); err != nil {
			return res, fmt.Errorf("set up DNS-01 through Cloudflare: %w", err)
		}
	}
	req := certificate.ObtainRequest{Domains: r.Domains, KeyType: certcrypto.EC256, Bundle: true}
	if r.Replaces != nil {
		if id, err := api.MakeARICertID(r.Replaces); err == nil {
			req.ReplacesCertID = id // lego sends it only to a directory with renewal information
		}
	}
	cert, err := client.Certificate.Obtain(ctx, req)
	if isAccountGone(err) {
		// The directory forgot the account (Let's Encrypt's staging resets now and then):
		// register the key again and order once more.
		logf(ssl.LogWarning, "Let's Encrypt no longer knows the account, so it is registered again.")
		reg, regErr := e.register(ctx, client, user, terms, logf)
		if regErr != nil {
			res.Registration, res.RegistrationChanged = ssl.Registration{}, true // registered anew next time
			return res, regErr
		}
		res.Registration, res.RegistrationChanged = reg, true
		cert, err = client.Certificate.Obtain(ctx, req)
	}
	if err != nil {
		return res, fmt.Errorf("order the certificate for %s: %w", r.Domains[0], err)
	}
	res.CertPEM, res.KeyPEM = cert.Certificate, cert.PrivateKey
	return res, nil
}

// register registers the key of user at the client's directory, accepting the
// Subscriber Agreement, and returns the new registration.
func (e *Engine) register(ctx context.Context, client *lego.Client, user *legoUser, terms string, logf LogFunc) (ssl.Registration, error) {
	logf(ssl.LogInfo, "Creating the Let's Encrypt account")
	acct, err := client.Registration.Register(ctx, registration.RegisterOptions{TermsOfServiceAgreed: true})
	if err != nil {
		return ssl.Registration{}, fmt.Errorf("register the Let's Encrypt account: %w", err)
	}
	user.reg = acct
	return registrationOf(acct, user.email, terms, e.now()), nil
}

// isAccountGone reports whether err says the directory does not know the account.
func isAccountGone(err error) bool {
	var pd *legoacme.ProblemDetails
	return errors.As(err, &pd) && pd.Type == legoacme.AccountDoesNotExistErrorType
}

// Renewal is the renewal window a CA suggests for a certificate (RFC 9773 section 4.2).
type Renewal struct {
	Start, End     time.Time
	ExplanationURL string
	// RetryAfter is when the CA wants to be asked again; 0 when it did not say.
	RetryAfter time.Duration
}

// ErrNoRenewalInfo reports a directory without renewal information: the certificate
// renews at ssl.RenewAt.
var ErrNoRenewalInfo = errors.New("the CA offers no renewal information")

// RenewalInfo reads the renewal window the directory at directoryURL suggests for leaf.
// The request is not signed, so no account is needed.
func (e *Engine) RenewalInfo(ctx context.Context, hc *http.Client, directoryURL string, leaf *x509.Certificate) (Renewal, error) {
	if hc == nil {
		return Renewal{}, errors.New("read the renewal information: no HTTP client")
	}
	key, err := NewAccountKey() // lego needs a key to build a client, even for an unsigned request
	if err != nil {
		return Renewal{}, err
	}
	client, err := e.client(directoryURL, &legoUser{key: key}, hc)
	if err != nil {
		return Renewal{}, err
	}
	info, err := client.Certificate.GetRenewalInfo(ctx, leaf)
	if errors.Is(err, api.ErrNoARI) {
		return Renewal{}, ErrNoRenewalInfo
	}
	if err != nil {
		return Renewal{}, fmt.Errorf("read the renewal information: %w", err)
	}
	return Renewal{Start: info.SuggestedWindow.Start.UTC(), End: info.SuggestedWindow.End.UTC(),
		ExplanationURL: info.ExplanationURL, RetryAfter: info.RetryAfter}, nil
}

// client returns a lego client of the directory at url for user. Building the config
// here, not with lego.NewConfig, keeps lego from reading its environment variables.
func (e *Engine) client(url string, user *legoUser, hc *http.Client) (*lego.Client, error) {
	client, err := lego.NewClient(&lego.Config{
		CADirURL:   url,
		User:       user,
		UserAgent:  e.userAgent,
		HTTPClient: hc,
		Certificate: lego.CertificateConfig{Timeout: certificateTimeout,
			OverallRequestLimit: certificate.DefaultOverallRequestLimit},
	})
	if err != nil {
		return nil, fmt.Errorf("read the ACME directory %s: %w", url, err)
	}
	return client, nil
}

// legoUser is an account as lego's registration.User.
type legoUser struct {
	email string
	key   crypto.Signer
	reg   *legoacme.ExtendedAccount
}

func (u *legoUser) GetEmail() string                           { return u.email }
func (u *legoUser) GetRegistration() *legoacme.ExtendedAccount { return u.reg }
func (u *legoUser) GetPrivateKey() crypto.Signer               { return u.key }

// extendedAccount returns the registration of r as lego keeps it; nil before the account
// is registered.
func extendedAccount(r ssl.Registration) *legoacme.ExtendedAccount {
	if !r.Registered() {
		return nil
	}
	return &legoacme.ExtendedAccount{Account: legoacme.Account{Status: r.Status, Contact: slices.Clone(r.Contact)},
		Location: r.URI}
}

// registrationOf returns what xDesign keeps of an account lego registered or updated
// with email. Contact is what xDesign sent, not what the directory answered: Let's
// Encrypt no longer keeps emails, so its answer would never match and every issuance
// would update the account again.
func registrationOf(a *legoacme.ExtendedAccount, email, terms string, agreedAt time.Time) ssl.Registration {
	return ssl.Registration{URI: a.Location, Status: a.Status, Contact: contact(email), TermsOfService: terms,
		AgreedAt: agreedAt.UTC()}
}

// contact returns the contacts of an account with email: none, or one mailto address.
func contact(email string) []string {
	if email == "" {
		return nil
	}
	return []string{mailto + email}
}
