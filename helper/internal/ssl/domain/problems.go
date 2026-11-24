package domain

import (
	"strings"
	"time"
)

// Cause names why Let's Encrypt did not issue or renew a certificate (xWriter's table).
type Cause string

// The causes.
const (
	// CausePort80Unreachable: Let's Encrypt could not connect to port 80.
	CausePort80Unreachable Cause = "port80_unreachable"
	// CausePort80Taken: another program answers on port 80 of this server.
	CausePort80Taken Cause = "port80_taken"
	// CausePort80Closed: xDesign did not open port 80 (no permission for low ports, or
	// `serve --dev`, which has no port-80 answerer).
	CausePort80Closed Cause = "port80_closed"
	// CauseSelfOnPort80: xDesign itself listens on port 80.
	CauseSelfOnPort80 Cause = "self_on_port80"
	// CauseWrongDNS: the domain does not point to this server.
	CauseWrongDNS Cause = "wrong_dns"
	// CauseUnknownDomain: the domain is not in the public DNS (Cloudflare finds no zone).
	CauseUnknownDomain Cause = "unknown_domain"
	// CauseCAA: the domain's CAA record does not allow Let's Encrypt.
	CauseCAA Cause = "caa"
	// CauseRateLimited: Let's Encrypt's limits stop issuing for a while.
	CauseRateLimited Cause = "rate_limited"
	// CauseCloudflareRefused: Cloudflare refused the token.
	CauseCloudflareRefused Cause = "cloudflare_refused"
	// CauseNoToken: a Cloudflare certificate has no token.
	CauseNoToken Cause = "no_token"
	// CauseTXTLate: the DNS record did not appear in time.
	CauseTXTLate Cause = "txt_late"
	// CauseUnreachable: Let's Encrypt or Cloudflare could not be reached (network, proxy).
	CauseUnreachable Cause = "unreachable"
	// CauseStopped: the issuance stopped before it finished, because the helper stopped
	// or the state file could not be written.
	CauseStopped Cause = "stopped"
	// CauseOther is every other failure.
	CauseOther Cause = "other"
)

// TXTWait is how long a DNS-01 issuance waits for its TXT record to appear.
const TXTWait = 3 * time.Minute

// Problem is a failure of an issuance or renewal with what its text names.
type Problem struct {
	Cause Cause
	// Domain is the name concerned, Zone the Cloudflare zone of a token problem
	// ("example.com"), Address this server's address for CauseWrongDNS ("" when unknown).
	Domain  string
	Zone    string
	Address string
	// RetryAfter is when Let's Encrypt issues again, for CauseRateLimited (zero when it
	// did not say).
	RetryAfter time.Time
	// Detail is the redacted error of CauseOther and CauseUnreachable.
	Detail string
}

// Text returns the problem in plain words for the state file's last problem and the log.
func (p Problem) Text() string {
	domain := orText(p.Domain, "the domain")
	switch p.Cause {
	case CausePort80Unreachable:
		return "Let's Encrypt could not reach this server on port 80. Open TCP port 80 in the firewall and at your " +
			"hosting provider, or use Cloudflare."
	case CausePort80Taken:
		return "Another program on this server uses port 80. Stop it, or use Cloudflare or certificate files."
	case CausePort80Closed:
		return "xDesign did not answer on port 80 of this server, so Let's Encrypt cannot check it there. " +
			"The certificate's log may say why; or use Cloudflare."
	case CauseSelfOnPort80:
		return "xDesign itself uses port 80, so Let's Encrypt cannot check this server there. Use Cloudflare, or " +
			"move xDesign to another port."
	case CauseWrongDNS:
		return domain + " does not point to this server. Set its DNS record to " + orText(p.Address,
			"this server's public address") + " and wait for it to spread."
	case CauseUnknownDomain:
		return domain + " was not found in the public DNS. Check the name, and that the domain uses Cloudflare's " +
			"name servers."
	case CauseCAA:
		return "The domain's DNS (CAA record) does not allow Let's Encrypt."
	case CauseRateLimited:
		if p.RetryAfter.IsZero() {
			return "Let's Encrypt limits how often it issues for this domain. Try again in a few hours."
		}
		return "Let's Encrypt limits how often it issues for this domain. Try again after " + FormatTime(p.RetryAfter) + "."
	case CauseCloudflareRefused:
		return "Cloudflare refused the token: it needs Zone Read and DNS Edit for " + orText(p.Zone, BaseName(domain)) + "."
	case CauseNoToken:
		return "The certificate has no Cloudflare token. Replace the token, then try again."
	case CauseTXTLate:
		return "The DNS record did not appear within 3 minutes. Try again in a few minutes."
	case CauseUnreachable:
		return "Let's Encrypt or Cloudflare could not be reached from this server" + detail(p.Detail)
	case CauseStopped:
		return "The issuance stopped before it finished" + detail(p.Detail) + " Try again."
	case CauseOther:
		// The general text below.
	}
	return "Let's Encrypt did not issue the certificate" + detail(p.Detail)
}

// detail returns ": <detail>." or "." for the end of a sentence.
func detail(d string) string {
	d = strings.TrimSuffix(strings.TrimSpace(d), ".")
	if d == "" {
		return "."
	}
	return ": " + d + "."
}

func orText(s, fallback string) string {
	if s == "" {
		return fallback
	}
	return s
}

// FormatDate returns a day the way the SSL texts write it: "4 Jan 2027" (UTC).
func FormatDate(t time.Time) string {
	return t.UTC().Format("2 Jan 2006")
}

// FormatTime returns a moment the way the SSL texts write it: "4 Jan 2027 14:05 UTC".
func FormatTime(t time.Time) string {
	return t.UTC().Format("2 Jan 2006 15:04 UTC")
}
