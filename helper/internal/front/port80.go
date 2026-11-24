package front

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"golang.org/x/net/netutil"
)

// Timing and limits of the port-80 answerer (07 section 4.1), xWriter's.
const (
	// port80CloseAfter is how long port 80 stays open after the last answer is gone.
	port80CloseAfter = 2 * time.Minute
	// port80OpenRecheck and port80IdleRecheck are how often the answerer looks at the
	// answers while port 80 is open, and while it is closed (besides the wake-ups, which
	// open it at once).
	port80OpenRecheck = 5 * time.Second
	port80IdleRecheck = time.Minute
	// port80MaxConnections bounds the open connections of the answerer.
	port80MaxConnections = 64
	// acmePathPrefix is the path of the HTTP-01 answers (RFC 8555 section 8.3).
	acmePathPrefix = "/.well-known/acme-challenge/"
)

// ACMEAnswers is what the port-80 answerer needs from the HTTPS manager (internal/ssl
// implements it).
type ACMEAnswers interface {
	// ChallengeAnswer returns the key authorization of the HTTP-01 challenge token; found
	// is false for a token that is unknown or expired.
	ChallengeAnswer(token string) (keyAuth string, found bool)
	// ChallengesWaiting reports whether an answer waits.
	ChallengesWaiting() bool
	// Port80Wakeups receives a value whenever an answer comes or goes.
	Port80Wakeups() <-chan struct{}
	// Port80Problem records why port 80 could not be opened (a bind error) in the log of
	// the issuance that waits, once.
	Port80Problem(err error)
}

// Port80 answers Let's Encrypt's HTTP-01 checks on TCP port 80 of the front's listen IP
// while an answer waits (07 section 4.1). GET and HEAD /.well-known/acme-challenge/<token>
// get the key authorization as text/plain, whatever the Host; every other request, an
// unknown token included, gets the empty page (D-615: a redirect to the site's address
// would tell anyone its secret path). The port opens when an answer is
// stored (a wake-up of the manager) and closes two minutes after the last one is gone.
// The service may bind it thanks to the unit's CAP_NET_BIND_SERVICE; a bind that fails
// is logged, reported to the waiting issuance and tried again every few seconds while an
// answer waits. Copied from xWriter's internal/web/port80.go with a channel of the
// manager in place of the event bus and one listen IP. It is safe for concurrent use.
type Port80 struct {
	answers ACMEAnswers
	// addr is where port 80 opens: the front's listen IP with port 80.
	addr string
	log  *slog.Logger

	mu  sync.Mutex
	srv *http.Server // open now; nil while closed
	// waiting is whether an answer waited at the last look, lastWaiting when one last did.
	waiting     bool
	lastWaiting time.Time
	// problem and problemAt are the bind failure logged last and when, so the same
	// failure fills the log once a minute at most.
	problem   string
	problemAt time.Time
}

// NewPort80 returns the answerer for the front's listen IP (empty for every address).
func NewPort80(answers ACMEAnswers, listenIP string, log *slog.Logger) *Port80 {
	return &Port80{answers: answers, addr: net.JoinHostPort(listenIP, "80"), log: log.With("part", "port80")}
}

// Run looks at the answers at once, then at every wake-up of the manager, and every few
// seconds while port 80 is open or an answer waits, every minute otherwise. It returns
// when ctx ends, with port 80 closed.
func (p *Port80) Run(ctx context.Context) {
	defer p.Close()
	wake := p.answers.Port80Wakeups()
	p.refresh(ctx)
	for {
		wait := port80IdleRecheck
		if p.busy() {
			wait = port80OpenRecheck
		}
		timer := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			timer.Stop()
			return
		case <-wake:
		case <-timer.C:
		}
		timer.Stop()
		p.refresh(ctx)
	}
}

// Open reports whether port 80 is open.
func (p *Port80) Open() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.srv != nil
}

// busy reports whether port 80 is open or an answer waits for it.
func (p *Port80) busy() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.srv != nil || p.waiting
}

// refresh opens port 80 while an answer waits and closes it two minutes after the last
// answer is gone.
func (p *Port80) refresh(ctx context.Context) {
	waiting := p.answers.ChallengesWaiting()
	now := time.Now()
	if !waiting {
		p.mu.Lock()
		defer p.mu.Unlock()
		p.waiting = false
		if p.srv != nil && now.Sub(p.lastWaiting) >= port80CloseAfter {
			p.closeLocked()
		}
		return
	}
	p.mu.Lock()
	p.waiting, p.lastWaiting = true, now
	p.mu.Unlock()
	p.open(ctx)
}

// open starts the answerer unless it listens already. A bind that fails is reported
// (bindFailed) and tried again at the next look.
func (p *Port80) open(ctx context.Context) {
	if p.Open() {
		return
	}
	ln, err := (&net.ListenConfig{}).Listen(ctx, "tcp", p.addr)
	if err != nil {
		p.bindFailed(ctx, err)
		return
	}
	srv := &http.Server{
		Handler:           p,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       30 * time.Second,
		MaxHeaderBytes:    8 << 10,
		ErrorLog:          slog.NewLogLogger(p.log.Handler(), slog.LevelDebug),
	}
	p.mu.Lock()
	if p.srv != nil { // another refresh opened it meanwhile
		p.mu.Unlock()
		_ = ln.Close()
		return
	}
	p.srv = srv
	p.problem = ""
	p.mu.Unlock()
	go func() {
		_ = srv.Serve(netutil.LimitListener(ln, port80MaxConnections)) // ends with Close
	}()
	p.log.InfoContext(ctx, "port 80 opened for let's encrypt", "address", ln.Addr().String())
}

// bindFailed reports a failed bind of port 80 to the waiting issuance (the manager tells
// it once) and logs it, the same error at most once a minute.
func (p *Port80) bindFailed(ctx context.Context, err error) {
	now := time.Now()
	p.mu.Lock()
	logIt := p.problem != err.Error() || now.Sub(p.problemAt) >= time.Minute
	if logIt {
		p.problem, p.problemAt = err.Error(), now
	}
	p.mu.Unlock()
	if logIt {
		p.log.ErrorContext(ctx, "port 80 cannot be opened for let's encrypt", "address", p.addr, "error", err)
	}
	p.answers.Port80Problem(err)
}

// Close closes port 80 at once.
func (p *Port80) Close() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.closeLocked()
}

func (p *Port80) closeLocked() {
	if p.srv == nil {
		return
	}
	_ = p.srv.Close() // the connections of an answer are short; nothing to finish
	p.srv = nil
	p.log.Info("port 80 closed", "address", p.addr)
}

// ServeHTTP answers one request on port 80: the answer of a waiting challenge, the empty
// page for anything else.
func (p *Port80) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	token, isChallenge := strings.CutPrefix(r.URL.Path, acmePathPrefix)
	var keyAuth string
	found := false
	if isChallenge && (r.Method == http.MethodGet || r.Method == http.MethodHead) && validACMEToken(token) {
		keyAuth, found = p.answers.ChallengeAnswer(token)
	}
	if !found {
		answerEmpty(w, r)
		return
	}
	h := w.Header()
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("Cache-Control", "no-store")
	h.Set("Content-Type", "text/plain; charset=utf-8")
	h.Set("Content-Length", strconv.Itoa(len(keyAuth)))
	w.WriteHeader(http.StatusOK)
	if r.Method != http.MethodHead {
		_, _ = w.Write([]byte(keyAuth)) //nolint:gosec // G705: text/plain with nosniff, never HTML
	}
}

// validACMEToken reports whether token has the form of an ACME token: 16 to 128
// characters of the base64url alphabet.
func validACMEToken(token string) bool {
	if len(token) < 16 || len(token) > 128 {
		return false
	}
	for i := range len(token) {
		c := token[i]
		if (c < 'A' || c > 'Z') && (c < 'a' || c > 'z') && (c < '0' || c > '9') && c != '-' && c != '_' {
			return false
		}
	}
	return true
}
