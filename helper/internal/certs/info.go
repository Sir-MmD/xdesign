package certs

import (
	"bytes"
	"crypto/sha256"
	"crypto/x509"
	"fmt"
	"net"
	"slices"
	"strings"
	"time"
)

// Info describes a certificate for the Network and System tabs, system_checks, the
// control socket and the CLI (docs/plan/09-web-api.md sections 3.2 and 10.3).
type Info struct {
	// Subject and Issuer are distinguished names, such as "CN=panel.example.com".
	Subject string
	Issuer  string
	// DNSNames and IPAddresses are the subject alternative names.
	DNSNames    []string
	IPAddresses []string
	// NotBefore and NotAfter bound the validity.
	NotBefore time.Time
	NotAfter  time.Time
	// SelfSigned reports a certificate signed with its own key: the built-in one, or
	// one the admin made.
	SelfSigned bool
	// Trusted reports that the chain verifies against the trust store. Only then is
	// HSTS sent (docs/plan/11-security.md section 6.4).
	Trusted bool
	// Fingerprint is the SHA-256 fingerprint of the certificate in the form browsers
	// show (see Fingerprint).
	Fingerprint string
}

// SANs returns the subject alternative names, DNS names first.
func (i Info) SANs() []string {
	return slices.Concat(i.DNSNames, i.IPAddresses)
}

// InfoOf describes a leaf certificate that was parsed already, as Load describes the leaf
// of a pair; trusted is whether its chain verified against the trust store. The agents'
// address gets its certificate in that form (AGT-03).
func InfoOf(leaf *x509.Certificate, trusted bool) Info {
	return newInfo(leaf, trusted)
}

func newInfo(leaf *x509.Certificate, trusted bool) Info {
	ips := make([]string, 0, len(leaf.IPAddresses))
	for _, ip := range leaf.IPAddresses {
		ips = append(ips, ip.String())
	}
	return Info{
		Subject:     leaf.Subject.String(),
		Issuer:      leaf.Issuer.String(),
		DNSNames:    slices.Clone(leaf.DNSNames),
		IPAddresses: ips,
		NotBefore:   leaf.NotBefore,
		NotAfter:    leaf.NotAfter,
		SelfSigned:  isSelfSigned(leaf),
		Trusted:     trusted,
		Fingerprint: Fingerprint(leaf.Raw),
	}
}

// isSelfSigned reports whether c names itself as its issuer and carries a signature
// made with its own key. CheckSignatureFrom would refuse a parent without the CA
// flag, which a self-signed server certificate does not have, so the signature is
// checked directly.
func isSelfSigned(c *x509.Certificate) bool {
	return bytes.Equal(c.RawIssuer, c.RawSubject) &&
		c.CheckSignature(c.SignatureAlgorithm, c.RawTBSCertificate, c.Signature) == nil
}

// Fingerprint returns the SHA-256 fingerprint of a DER-encoded certificate the way
// browsers and openssl show it: upper-case hex byte pairs joined by colons, as in
// "3B:9F:0C:...:A1:7E" (docs/plan/12-deployment.md section 4.10). The owner compares
// it with the browser's certificate warning before trusting the self-signed
// certificate (docs/plan/11-security.md section 7.5).
func Fingerprint(der []byte) string {
	const digits = "0123456789ABCDEF"
	sum := sha256.Sum256(der)
	b := make([]byte, 0, len(sum)*3-1)
	for i, c := range sum {
		if i > 0 {
			b = append(b, ':')
		}
		b = append(b, digits[c>>4], digits[c&0x0f])
	}
	return string(b)
}

// Warning codes for usable certificates with a problem (docs/plan/09-web-api.md
// sections 3.2 and 8.6).
const (
	WarnSelfSigned   = "self_signed_certificate"
	WarnExpiringSoon = "certificate_expiring_soon"
	WarnHostMismatch = "certificate_host_mismatch"
	WarnNotTrusted   = "certificate_not_trusted"
)

// ExpiryWarningPeriod is how long before its expiry a certificate gets
// WarnExpiringSoon. system_checks raises system.tls_expiring with the same period
// (docs/plan/04-domain-logic.md section 16).
const ExpiryWarningPeriod = 14 * 24 * time.Hour

// Warning is a problem that does not stop a certificate from being used.
type Warning struct {
	// Code is one of the Warn constants.
	Code string
	// Message explains the problem to the owner.
	Message string
}

// Warnings returns the warnings for serving p at time now to browsers that open the
// panel at host, the Host header of the admin's request (a port is ignored; an empty
// host skips the name check): the certificate is self-signed, it expires within 14
// days, it has no subject alternative name for host, or the trust store does not
// accept it, so HSTS is not sent (docs/plan/11-security.md section 6.4). A
// self-signed certificate gets the self-signed warning instead of the last one.
func (p *Pair) Warnings(host string, now time.Time) []Warning {
	var out []Warning
	info := p.Info
	if info.SelfSigned {
		out = append(out, Warning{Code: WarnSelfSigned, Message: "The certificate is self-signed, so browsers warn until it is accepted. " +
			"A certificate from a public authority, such as Let's Encrypt, avoids the warning."})
	}
	if info.NotAfter.Sub(now) < ExpiryWarningPeriod {
		out = append(out, Warning{Code: WarnExpiringSoon, Message: fmt.Sprintf("The certificate expires on %s. Renew it before then.",
			formatTime(info.NotAfter))})
	}
	if h := hostOnly(host); h != "" && p.Certificate.Leaf.VerifyHostname(h) != nil {
		out = append(out, Warning{Code: WarnHostMismatch, Message: fmt.Sprintf("The certificate does not cover %s: it is valid for %s. "+
			"Open xDesign with one of those names, or browsers will warn.", h, namesText(info.SANs()))})
	}
	if !info.Trusted && !info.SelfSigned {
		out = append(out, Warning{Code: WarnNotTrusted, Message: "The certificate is not signed by an authority this server trusts, " +
			"so browsers may warn and xDesign does not send HSTS."})
	}
	return out
}

// hostOnly removes the port and the IPv6 brackets from a Host header value.
func hostOnly(host string) string {
	if h, _, err := net.SplitHostPort(host); err == nil {
		return h
	}
	return strings.TrimSuffix(strings.TrimPrefix(host, "["), "]")
}

func namesText(names []string) string {
	if len(names) == 0 {
		return "no names"
	}
	return strings.Join(names, ", ")
}
