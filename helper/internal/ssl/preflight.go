package ssl

import (
	"context"
	"fmt"
	"net/netip"
	"slices"
	"strings"
	"time"

	"github.com/miekg/dns"
)

// The domain preflight: the checks xDesign runs before asking Let's Encrypt for a
// certificate, so the owner sees "the domain has no A/AAAA records yet" instead of an
// opaque ACME error, and Let's Encrypt's budget of 5 failures an hour is not spent. It
// never changes DNS. Copied from xmtp panel's internal/panel/certs/preflight, without
// the Cloudflare edge ranges (xmtp panel reads them from Cloudflare's API; a proxied
// record still passes HTTP-01, since Cloudflare forwards port 80).

// findingLevel is the severity of a finding.
type findingLevel string

const (
	levelOK    findingLevel = "ok"
	levelWarn  findingLevel = "warn"
	levelError findingLevel = "error"
)

// finding is one preflight result.
type finding struct {
	level findingLevel
	code  string
	msg   string
}

// preflightInput describes the certificate xDesign is about to request.
type preflightInput struct {
	domain string // FQDN to certify, e.g. "design.example.com" or "*.example.com"
	// serverIPs are the addresses of this server's interfaces. Without any, whether the
	// name points at the server is not checked: the HTTP-01 self-check finds that out.
	serverIPs []netip.Addr
	method    string   // "http-01" | "dns-01"
	resolvers []string // e.g. {"1.1.1.1:53","8.8.8.8:53"}; never only the server's local resolver

	// CAA evaluation (from the CA directory meta.caaIdentities + our account URL)
	caaIdentities []string // e.g. {"letsencrypt.org"}
	accountURI    string   // e.g. "https://acme-v02.api.letsencrypt.org/acme/acct/123"
}

// runPreflight performs all checks. It never mutates DNS.
func runPreflight(ctx context.Context, in preflightInput) []finding {
	var out []finding
	name := strings.TrimPrefix(strings.ToLower(strings.TrimSuffix(in.domain, ".")), "*.")
	wildcard := strings.HasPrefix(in.domain, "*.")

	if wildcard && in.method != "dns-01" {
		out = append(out, finding{levelError, "wildcard_needs_dns01", "wildcard certificates can only be validated with DNS-01 (Cloudflare token mode)"})
	}

	// 1) A/AAAA as seen by several public resolvers
	seen := map[netip.Addr]bool{}
	for _, srv := range in.resolvers {
		for _, qt := range []uint16{dns.TypeA, dns.TypeAAAA} {
			addrs, err := lookupAddrs(ctx, srv, name, qt)
			if err != nil {
				out = append(out, finding{levelWarn, "resolver_error", fmt.Sprintf("%s via %s: %v", dns.TypeToString[qt], srv, err)})
				continue
			}
			for _, a := range addrs {
				seen[a] = true
			}
		}
	}
	resolved := make([]netip.Addr, 0, len(seen))
	for a := range seen {
		resolved = append(resolved, a)
	}
	slices.SortFunc(resolved, func(a, b netip.Addr) int { return a.Compare(b) })

	if !wildcard || in.method == "http-01" {
		out = append(out, checkPointing(name, resolved, in)...)
	}

	// 2) CAA (RFC 8659): relevant RRset = first non-empty CAA set climbing the tree
	if len(in.resolvers) > 0 {
		set, owner, err := relevantCAA(ctx, in.resolvers[0], name)
		if err != nil {
			out = append(out, finding{levelWarn, "caa_lookup", err.Error()})
		} else {
			ok, why := caaPermits(set, in.caaIdentities, in.accountURI, in.method, wildcard)
			if ok {
				out = append(out, finding{levelOK, "caa", why})
			} else {
				out = append(out, finding{levelError, "caa_forbids", fmt.Sprintf("CAA at %s forbids issuance: %s", owner, why)})
			}
		}
	}

	// TCP port 80 is not dialed here: xDesign opens it only while a challenge is
	// pending, so before the challenge it would always look closed. The HTTP-01
	// self-check fetches the token through it once it is served.
	return out
}

func checkPointing(name string, resolved []netip.Addr, in preflightInput) []finding {
	var out []finding
	if len(resolved) == 0 {
		return []finding{{levelError, "no_address", name + " has no A/AAAA records yet"}}
	}
	if len(in.serverIPs) == 0 {
		return nil // nothing to compare with (see preflightInput.serverIPs)
	}
	var foreign []string
	matched := false
	for _, a := range resolved {
		if slices.Contains(in.serverIPs, a) {
			matched = true
		} else {
			foreign = append(foreign, a.String())
		}
	}
	switch {
	case !matched:
		out = append(out, finding{levelWarn, "not_pointing", fmt.Sprintf("%s -> %v, but this server's addresses are %v "+
			"(fine when the server is behind NAT)", name, resolved, in.serverIPs)})
	case len(foreign) > 0:
		// Classic HTTP-01 failure: stale AAAA. LE prefers IPv6 when an AAAA exists.
		out = append(out, finding{levelWarn, "extra_addresses", fmt.Sprintf("%s also resolves to %v which is not this server", name, foreign)})
	default:
		out = append(out, finding{levelOK, "pointing", fmt.Sprintf("%s -> %v", name, resolved)})
	}
	hasV6Server := slices.ContainsFunc(in.serverIPs, func(a netip.Addr) bool { return a.Is6() && !a.Is4In6() })
	hasV6DNS := slices.ContainsFunc(resolved, func(a netip.Addr) bool { return a.Is6() && !a.Is4In6() })
	if hasV6Server && !hasV6DNS {
		out = append(out, finding{levelWarn, "no_aaaa", "this server has IPv6 but no AAAA record (IPv6-only clients cannot reach it)"})
	}
	return out
}

func exchange(ctx context.Context, server, name string, qtype uint16) (*dns.Msg, error) {
	m := new(dns.Msg)
	m.SetQuestion(dns.Fqdn(name), qtype)
	m.RecursionDesired = true
	m.SetEdns0(1232, false)
	c := &dns.Client{Timeout: 5 * time.Second}
	r, _, err := c.ExchangeContext(ctx, m, server)
	if err == nil && r.Truncated {
		c.Net = "tcp"
		r, _, err = c.ExchangeContext(ctx, m, server)
	}
	if err != nil {
		return nil, fmt.Errorf("dns query: %w", err)
	}
	return r, nil
}

func lookupAddrs(ctx context.Context, server, name string, qtype uint16) ([]netip.Addr, error) {
	r, err := exchange(ctx, server, name, qtype)
	if err != nil {
		return nil, err
	}
	if r.Rcode != dns.RcodeSuccess && r.Rcode != dns.RcodeNameError {
		return nil, fmt.Errorf("rcode %s", dns.RcodeToString[r.Rcode])
	}
	var out []netip.Addr
	for _, rr := range r.Answer { // resolver already followed CNAMEs
		switch v := rr.(type) {
		case *dns.A:
			if a, ok := netip.AddrFromSlice(v.A.To4()); ok {
				out = append(out, a)
			}
		case *dns.AAAA:
			if a, ok := netip.AddrFromSlice(v.AAAA); ok {
				out = append(out, a)
			}
		}
	}
	return out, nil
}

// relevantCAA climbs name -> parent -> ... and returns the first non-empty CAA set.
func relevantCAA(ctx context.Context, server, name string) ([]*dns.CAA, string, error) {
	labels := dns.SplitDomainName(name)
	for i := range labels {
		owner := strings.Join(labels[i:], ".")
		r, err := exchange(ctx, server, owner, dns.TypeCAA)
		if err != nil {
			return nil, owner, err
		}
		if r.Rcode == dns.RcodeServerFailure {
			return nil, owner, fmt.Errorf("SERVFAIL looking up CAA at %s (CAs refuse to issue on CAA lookup failure)", owner)
		}
		var set []*dns.CAA
		for _, rr := range r.Answer {
			if c, ok := rr.(*dns.CAA); ok {
				set = append(set, c)
			}
		}
		if len(set) > 0 {
			return set, owner, nil
		}
	}
	return nil, "", nil
}

// caaPermits evaluates an RFC 8659 CAA set (+ RFC 8657 accounturi /
// validationmethods parameters) for the given CA identities.
func caaPermits(set []*dns.CAA, caIDs []string, accountURI, method string, wildcard bool) (bool, string) {
	if len(set) == 0 {
		return true, "no CAA records: any CA may issue"
	}
	var issue, issuewild []string
	for _, c := range set {
		tag := strings.ToLower(c.Tag)
		switch tag {
		case "issue":
			issue = append(issue, c.Value)
		case "issuewild":
			issuewild = append(issuewild, c.Value)
		case "iodef", "contactemail", "contactphone", "issuemail", "issuevmc":
		default:
			if c.Flag&128 != 0 {
				return false, fmt.Sprintf("unknown critical CAA tag %q", c.Tag)
			}
		}
	}
	props := issue
	if wildcard && len(issuewild) > 0 {
		props = issuewild // issuewild overrides issue for wildcard names
	}
	if len(props) == 0 {
		return true, "CAA set has no issue/issuewild property for this name type"
	}
	for _, v := range props {
		parts := strings.Split(v, ";")
		issuer := strings.ToLower(strings.TrimSpace(parts[0]))
		if issuer == "" || !slices.Contains(caIDs, issuer) {
			continue
		}
		okParams := true
		for _, p := range parts[1:] {
			k, val, _ := strings.Cut(strings.TrimSpace(p), "=")
			switch strings.ToLower(strings.TrimSpace(k)) {
			case "accounturi":
				if accountURI != "" && strings.TrimSpace(val) != accountURI {
					okParams = false
				}
			case "validationmethods":
				if !slices.Contains(strings.Split(strings.ReplaceAll(val, " ", ""), ","), method) {
					okParams = false
				}
			}
		}
		if okParams {
			return true, fmt.Sprintf("CAA allows %s (%q)", issuer, v)
		}
	}
	return false, fmt.Sprintf("none of %q authorizes %v with account/method constraints", props, caIDs)
}
