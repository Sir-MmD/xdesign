package acme

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/go-acme/lego/v5/challenge"
	"github.com/go-acme/lego/v5/challenge/dns01"
	"github.com/go-acme/lego/v5/providers/dns/cloudflare"

	ssl "github.com/Sir-MmD/xdesign/helper/internal/ssl/domain"
)

const (
	// cloudflareTTL is the TTL of the TXT records: Cloudflare's minimum.
	cloudflareTTL = 120
	// dnsPolling is how often the DNS-01 checks ask the resolvers.
	dnsPolling = 5 * time.Second
)

// cloudflare returns the DNS-01 provider of an order through Cloudflare with token (Zone
// Read and DNS Edit). Its calls use hc; the TXT records are checked for up to the
// engine's propagation time. Its steps reach logf in plain words.
func (e *Engine) cloudflare(token string, hc *http.Client, logf LogFunc) (challenge.ProviderTimeout, error) {
	p, err := cloudflare.NewDNSProviderConfig(&cloudflare.Config{
		AuthToken:          token,
		TTL:                cloudflareTTL,
		PropagationTimeout: e.propagation,
		PollingInterval:    dnsPolling,
		HTTPClient:         hc,
	})
	if err != nil {
		return nil, fmt.Errorf("set up Cloudflare: %w", err)
	}
	return &loggedDNS{p: p, logf: logf}, nil
}

// loggedDNS is lego's Cloudflare provider with its steps in the order's log.
type loggedDNS struct {
	p    *cloudflare.DNSProvider
	logf LogFunc
}

// Present adds the TXT record of a challenge through Cloudflare.
func (d *loggedDNS) Present(ctx context.Context, domain, token, keyAuth string) error {
	if err := d.p.Present(ctx, domain, token, keyAuth); err != nil {
		return err //nolint:wrapcheck // lego wraps it with the domain, Explain reads lego's error
	}
	d.logf(ssl.LogInfo, "Added the DNS record "+dns01.UnFqdn(dns01.GetChallengeInfo(ctx, domain, keyAuth).FQDN)+
		" through Cloudflare; waiting for it to appear (up to 3 minutes)")
	return nil
}

// CleanUp removes the TXT record of a challenge.
func (d *loggedDNS) CleanUp(ctx context.Context, domain, token, keyAuth string) error {
	return d.p.CleanUp(ctx, domain, token, keyAuth) //nolint:wrapcheck // lego logs a failed clean-up itself
}

// Timeout returns how long and how often the TXT records are checked.
func (d *loggedDNS) Timeout() (timeout, interval time.Duration) {
	return d.p.Timeout()
}
