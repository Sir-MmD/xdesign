package acme

import (
	"cmp"
	"context"
	"errors"
	"net"
	"net/url"
	"slices"
	"strings"
	"time"

	legoacme "github.com/go-acme/lego/v5/acme"
	"golang.org/x/net/publicsuffix"

	ssl "github.com/Sir-MmD/xdesign/helper/internal/ssl/domain"
)

// The failures of an HTTPSolver that Explain names; the solver wraps them with its
// details.
var (
	// ErrPort80Taken: something other than xDesign answers on port 80 of this server.
	ErrPort80Taken = errors.New("another program answers on port 80")
	// ErrPort80Closed: xDesign did not open port 80 in time.
	ErrPort80Closed = errors.New("xDesign does not answer on port 80")
	// ErrSelfOnPort80: xDesign itself listens on port 80, so it cannot answer HTTP-01
	// there.
	ErrSelfOnPort80 = errors.New("xDesign itself listens on port 80")
)

// Explain returns why the order of Issue for domains failed with err, at now, as a cause
// of xWriter's table with what its text names (ssl.Problem.Text): over HTTP-01, or through Cloudflare
// when dnsOrder is set. Detail holds the redacted error for the causes that show it.
func Explain(err error, domains []string, dnsOrder bool, now time.Time) ssl.Problem {
	p := ssl.Problem{Cause: ssl.CauseOther, Domain: domainIn(err, domains), Detail: ErrorText(err)}
	text := err.Error()
	var rate *legoacme.RateLimitedError
	var pd *legoacme.ProblemDetails
	switch {
	case errors.Is(err, ErrPort80Taken):
		p.Cause = ssl.CausePort80Taken
	case errors.Is(err, ErrPort80Closed):
		p.Cause = ssl.CausePort80Closed
	case errors.Is(err, ErrSelfOnPort80):
		p.Cause = ssl.CauseSelfOnPort80
	case errors.As(err, &rate):
		p.Cause = ssl.CauseRateLimited
		if rate.RetryAfter > 0 {
			p.RetryAfter = now.Add(rate.RetryAfter).UTC()
		}
	case errors.As(err, &pd):
		p.Cause = problemCause(pd, dnsOrder)
	case dnsOrder && strings.Contains(text, "time limit exceeded"):
		// lego's wait for the TXT records ran out (dns01: time limit exceeded: last error ...).
		p.Cause = ssl.CauseTXTLate
	case unreachable(err):
		p.Cause = ssl.CauseUnreachable
	case strings.Contains(text, "cloudflare: could not find zone for domain"):
		// The public DNS knows no zone above the name: lego asks it for the SOA record.
		p.Cause = ssl.CauseUnknownDomain
	case strings.Contains(text, "cloudflare:"):
		p.Cause, p.Zone = ssl.CauseCloudflareRefused, ZoneOf(p.Domain)
	}
	return p
}

// problemCause maps an error document of the CA (RFC 8555 section 6.7) to a cause.
func problemCause(pd *legoacme.ProblemDetails, dnsOrder bool) ssl.Cause {
	types := []string{pd.Type}
	for _, sub := range pd.SubProblems {
		types = append(types, sub.Type)
	}
	has := func(t string) bool { return slices.Contains(types, t) }
	switch {
	case has(legoacme.CaaErrorType):
		return ssl.CauseCAA
	case has(legoacme.RateLimitedErrorType):
		return ssl.CauseRateLimited
	case dnsOrder && (has(legoacme.DNSErrorType) || has(legoacme.UnauthorizedErrorType) ||
		has(legoacme.IncorrectResponseErrorType)):
		// The CA found no TXT record, or an old one.
		return ssl.CauseTXTLate
	case !dnsOrder && has(legoacme.ConnectionErrorType) && nameUnresolved(pd):
		// Some CAs report a name without an address as a connection problem.
		return ssl.CauseWrongDNS
	case !dnsOrder && has(legoacme.ConnectionErrorType):
		return ssl.CausePort80Unreachable
	case !dnsOrder && (has(legoacme.DNSErrorType) || has(legoacme.UnauthorizedErrorType) ||
		has(legoacme.IncorrectResponseErrorType) || has(legoacme.TLSErrorType)):
		// No address for the name, or another server answered for it.
		return ssl.CauseWrongDNS
	case pd.HTTPStatus >= 500 || has(legoacme.ServerInternalErrorType):
		return ssl.CauseUnreachable
	}
	return ssl.CauseOther
}

// nameUnresolved reports whether the CA's error document says it found no address for the
// name ("could not resolve", "NXDOMAIN", "no valid A records").
func nameUnresolved(pd *legoacme.ProblemDetails) bool {
	details := []string{pd.Detail}
	for _, sub := range pd.SubProblems {
		details = append(details, sub.Detail)
	}
	for _, d := range details {
		d = strings.ToLower(d)
		if strings.Contains(d, "could not resolve") || strings.Contains(d, "nxdomain") ||
			strings.Contains(d, "no valid a records") || strings.Contains(d, "dns problem") {
			return true
		}
	}
	return false
}

// unreachable reports a failure to reach Let's Encrypt or Cloudflare: a connection, a
// name lookup or a deadline, not an answer.
func unreachable(err error) bool {
	var urlErr *url.Error
	var opErr *net.OpError
	var dnsErr *net.DNSError
	return errors.As(err, &urlErr) || errors.As(err, &opErr) || errors.As(err, &dnsErr) ||
		errors.Is(err, context.DeadlineExceeded)
}

// domainIn returns the name of domains that err is about: a name of the CA's error
// documents, else the longest name its message mentions, else the first name.
func domainIn(err error, domains []string) string {
	if len(domains) == 0 {
		return ""
	}
	var pd *legoacme.ProblemDetails
	if errors.As(err, &pd) {
		for _, sub := range pd.SubProblems {
			if slices.Contains(domains, sub.Identifier.Value) {
				return sub.Identifier.Value
			}
		}
	}
	sorted := slices.Clone(domains)
	slices.SortFunc(sorted, func(a, b string) int { return cmp.Compare(len(b), len(a)) })
	text := err.Error()
	for _, d := range sorted {
		if strings.Contains(text, d) {
			return d
		}
	}
	return domains[0]
}

// ZoneOf returns the zone a Cloudflare token must reach for name: its registered domain,
// such as example.com for *.design.example.com.
func ZoneOf(name string) string {
	base := ssl.BaseName(name)
	if zone, err := publicsuffix.EffectiveTLDPlusOne(base); err == nil {
		return zone
	}
	return base
}
