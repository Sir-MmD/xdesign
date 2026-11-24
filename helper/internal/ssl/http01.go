package ssl

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/platform"
	"github.com/Sir-MmD/xdesign/helper/internal/ssl/acme"
	sslcfg "github.com/Sir-MmD/xdesign/helper/internal/ssl/domain"
)

// Timing of the HTTP-01 answers, xWriter's.
const (
	// challengeLife is how long an answer is kept.
	challengeLife = 10 * time.Minute
	// port80Wait is how long Present waits for the port-80 answerer to answer.
	port80Wait = 20 * time.Second
	// port80Foreign is how long another answer must persist before Present decides that
	// another program uses port 80.
	port80Foreign = 3 * time.Second
	// port80Poll is the interval of the checks.
	port80Poll = 250 * time.Millisecond
	// port80Try bounds one check request.
	port80Try = 3 * time.Second
	// maxAnswer bounds what a check reads of an answer.
	maxAnswer = 4096
)

// challenge is one HTTP-01 answer the port-80 answerer gives.
type challenge struct {
	keyAuth string
	expires time.Time
}

// http01Solver answers the HTTP-01 challenges of one issuance (acme.HTTPSolver): it keeps
// each answer for the front's port-80 answerer, wakes it, and waits until port 80 of this
// server gives the answer, so Let's Encrypt never checks before the answerer is open.
type http01Solver struct {
	m   *Manager
	run *issueRun
}

// Present keeps the answer for domain and returns once port 80 answers it.
func (h *http01Solver) Present(ctx context.Context, domain, token, keyAuth string) error {
	m := h.m
	m.mu.Lock()
	m.challenges[token] = challenge{keyAuth: keyAuth, expires: m.now().Add(challengeLife)}
	m.mu.Unlock()
	m.wakePort80()
	h.run.add(sslcfg.LogInfo, "Waiting for xDesign to answer on port 80 for "+domain)
	if err := m.checkPort80(ctx, domain, token, keyAuth); err != nil {
		// lego cleans up only after a Present that succeeded: remove the answer here.
		_ = h.CleanUp(ctx, domain, token, keyAuth) // only forgets the answer; never fails
		return err
	}
	h.run.add(sslcfg.LogInfo, "Port 80 answers for "+domain+"; Let's Encrypt checks it next")
	return nil
}

// CleanUp forgets the answer for domain; the answerer closes port 80 two minutes after
// the last answer.
func (h *http01Solver) CleanUp(_ context.Context, _, token, _ string) error {
	h.m.mu.Lock()
	delete(h.m.challenges, token)
	h.m.mu.Unlock()
	h.m.wakePort80()
	return nil
}

// checkPort80 asks port 80 of this server, at the front's listen IP, for the answer to
// token the way Let's Encrypt will, until it is right: another answer for port80Foreign
// is another program (acme.ErrPort80Taken); no answer within port80Wait means xDesign
// did not open the port (acme.ErrPort80Closed).
func (m *Manager) checkPort80(ctx context.Context, domain, token, keyAuth string) error {
	target := net.JoinHostPort(selfCheckHost(m.opts.ListenIP), "80")
	url := "http://" + target + "/.well-known/acme-challenge/" + token
	client := &http.Client{
		Timeout: port80Try,
		// A redirect is someone else's answer: the answerer never redirects.
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		Transport: &http.Transport{
			Proxy:             nil, // straight to this server
			DialContext:       (&net.Dialer{Timeout: port80Try}).DialContext,
			DisableKeepAlives: true,
		},
	}
	start := m.now()
	var foreignSince time.Time
	var lastErr error
	for {
		status, body, err := askPort80(ctx, client, url, domain)
		switch {
		case err == nil && status == http.StatusOK && body == keyAuth:
			return nil
		case err == nil:
			if foreignSince.IsZero() {
				foreignSince = m.now()
			}
			if m.now().Sub(foreignSince) >= port80Foreign {
				return fmt.Errorf("port 80 at %s answered %d instead of the challenge's answer: %w", target, status,
					acme.ErrPort80Taken)
			}
		default:
			foreignSince, lastErr = time.Time{}, err
		}
		if m.now().Sub(start) >= port80Wait {
			return fmt.Errorf("nothing answered on port 80 at %s within %s (%s): %w", target, port80Wait,
				acme.ErrorText(lastErr), acme.ErrPort80Closed)
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("wait for port 80: %w", ctx.Err())
		case <-time.After(port80Poll):
		}
	}
}

// askPort80 sends one check and returns the status and the start of the body.
func askPort80(ctx context.Context, client *http.Client, url, domain string) (int, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, "", fmt.Errorf("check port 80: %w", err)
	}
	req.Host = domain
	resp, err := client.Do(req)
	if err != nil {
		return 0, "", fmt.Errorf("check port 80: %w", err)
	}
	defer func() { _ = resp.Body.Close() }() // read-only: closing cannot lose data
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxAnswer))
	if err != nil {
		return 0, "", fmt.Errorf("check port 80: %w", err)
	}
	return resp.StatusCode, string(body), nil
}

// selfCheckHost returns the address the checks reach port 80 at: the listen IP, or the
// loopback address when the front listens on every address.
func selfCheckHost(listenIP string) string {
	ip, err := netip.ParseAddr(listenIP)
	if err != nil || ip.IsUnspecified() {
		return "127.0.0.1"
	}
	return ip.Unmap().String()
}

// ChallengeAnswer returns the key authorization of the HTTP-01 challenge token, the
// answer of the port-80 answerer; found is false for a token that is unknown or expired.
func (m *Manager) ChallengeAnswer(token string) (keyAuth string, found bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	c, ok := m.challenges[token]
	if !ok || !m.now().Before(c.expires) {
		return "", false
	}
	return c.keyAuth, true
}

// ChallengesWaiting reports whether an HTTP-01 answer waits: the port-80 answerer is open
// while one does, and two minutes longer.
func (m *Manager) ChallengesWaiting() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	now := m.now()
	for token, c := range m.challenges {
		if !now.Before(c.expires) {
			delete(m.challenges, token)
		}
	}
	return len(m.challenges) > 0
}

// Port80Wakeups receives a value whenever an answer comes or goes, so the port-80
// answerer opens or closes port 80 at once.
func (m *Manager) Port80Wakeups() <-chan struct{} {
	return m.port80Wake
}

func (m *Manager) wakePort80() {
	select {
	case m.port80Wake <- struct{}{}:
	default: // a wake-up waits already
	}
}

// Port80Problem adds what keeps the port-80 answerer from opening port 80 (err, a bind
// failure) to the log of the issuance that waits, in plain words, once.
func (m *Manager) Port80Problem(err error) {
	text := "xDesign could not open port 80: " + acme.ErrorText(err)
	switch {
	case errors.Is(err, platform.ErrAddrInUse):
		text = sslcfg.Problem{Cause: sslcfg.CausePort80Taken}.Text()
	case errors.Is(err, platform.ErrAccess):
		text = "xDesign may not open port 80: its service needs the CAP_NET_BIND_SERVICE permission, " +
			"which the installed service has (in development it runs as your user)."
	}
	m.mu.Lock()
	run := m.run
	m.mu.Unlock()
	if run != nil {
		run.addOnce(sslcfg.LogError, text)
	}
}
