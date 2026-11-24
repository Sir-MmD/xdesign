package ssl

import (
	"bytes"
	"crypto"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"net/netip"
	"slices"
	"strings"
	"time"
)

// Pasted certificates: a certificate and private key the owner brings (bought, or issued
// elsewhere) rather than one Let's Encrypt issues. Copied from xmtp panel's
// internal/panel/certsvc/custom.go (parseUpload and the functions it calls); xDesign
// stores the result as the certificate files of the state folder and never renews it.

// Upload limits. A leaf with a few intermediates, and one key, fit in far less.
const (
	maxCustomCertPEM = 64 << 10
	maxCustomKeyPEM  = 16 << 10
	// maxUploadChain bounds the stored chain: the leaf and its intermediates.
	maxUploadChain = 8
	// uploadClockSkew is how far in the future a certificate's start may be
	// and still count as valid now (the CA's clock and the server's differ).
	uploadClockSkew = 5 * time.Minute
)

// UploadError refuses a pasted certificate for what was pasted (not PEM, a key that
// does not match the certificate, an expired certificate, no DNS names, ...). The
// message says what to fix, so the control socket answers it as it is.
type UploadError struct {
	Message string
}

// Error returns the message.
func (e *UploadError) Error() string { return e.Message }

// invalidUpload returns an *UploadError with the text as a sentence.
func invalidUpload(format string, args ...any) error {
	msg := fmt.Sprintf(format, args...)
	return &UploadError{Message: strings.ToUpper(msg[:1]) + msg[1:] + "."}
}

// DroppedCert is a certificate of a pasted bundle that xDesign left out: only the
// certificate the key belongs to and the chain of its issuers are stored, since the
// front sends every stored certificate in every handshake.
type DroppedCert struct {
	Subject string `json:"subject"` // e.g. "CN=ISRG Root X1,O=Internet Security Research Group,C=US"
	Reason  string `json:"reason"`  // DroppedRoot, DroppedUnrelated or DroppedSuperseded
}

// Why a certificate of a pasted bundle was left out.
const (
	// DroppedRoot: the root (self-signed) certificate the chain ends at.
	// Clients carry their own copy of a root, so it is never sent.
	DroppedRoot = "root"
	// DroppedUnrelated: not on the chain from the certificate to its issuers,
	// for example another site's certificate. Sending it would tie that site
	// to this one in every handshake, which a censor can see.
	DroppedUnrelated = "unrelated"
	// DroppedSuperseded: another certificate for the same private key, older
	// or not valid now.
	DroppedSuperseded = "superseded"
)

// parsedUpload is a validated upload, normalized for storage.
type parsedUpload struct {
	chainPEM []byte // the leaf, then the chain of its issuers (no root); certificates only
	keyPEM   []byte // the key as PKCS#8 PEM
	leaf     *x509.Certificate
	names    []string // lower case, deduplicated, in the certificate's order
	primary  string
	dropped  []DroppedCert
}

// parseUpload checks a pasted certificate and its key at now and returns them
// normalized for storage. Every error that refuses the upload is an *UploadError.
func parseUpload(certPEM, keyPEM []byte, now time.Time) (*parsedUpload, error) {
	if len(bytes.TrimSpace(certPEM)) == 0 {
		return nil, invalidUpload("the certificate is empty: paste it as PEM text, starting with -----BEGIN CERTIFICATE-----")
	}
	if len(bytes.TrimSpace(keyPEM)) == 0 {
		return nil, invalidUpload("the private key is empty: paste it as PEM text, starting with -----BEGIN PRIVATE KEY----- (or RSA / EC PRIVATE KEY)")
	}
	if len(certPEM) > maxCustomCertPEM {
		return nil, invalidUpload("the certificate is larger than %d KiB", maxCustomCertPEM>>10)
	}
	if len(keyPEM) > maxCustomKeyPEM {
		return nil, invalidUpload("the private key is larger than %d KiB", maxCustomKeyPEM>>10)
	}

	var chain []*x509.Certificate
	seen := map[string]bool{}
	pkcs7 := false
	for rest := certPEM; ; {
		var b *pem.Block
		if b, rest = pem.Decode(rest); b == nil {
			break
		}
		if b.Type != "CERTIFICATE" {
			// A private key pasted along with the certificate is read only from
			// the key field, so it is never stored with the public chain.
			pkcs7 = pkcs7 || b.Type == "PKCS7"
			continue
		}
		c, err := x509.ParseCertificate(b.Bytes)
		if err != nil {
			return nil, invalidUpload("certificate %d of the chain does not parse: %v", len(chain)+1, err)
		}
		if !seen[string(c.Raw)] {
			seen[string(c.Raw)] = true
			chain = append(chain, c)
		}
	}
	if len(chain) == 0 && pkcs7 {
		return nil, invalidUpload("a PKCS#7 bundle is not accepted: convert it to PEM certificates first, for example with: openssl pkcs7 -print_certs -in chain.p7b -out chain.pem")
	}
	if len(chain) == 0 {
		return nil, invalidUpload("no certificate found: the certificate must be PEM text with blocks starting with -----BEGIN CERTIFICATE-----")
	}
	key, err := parsePrivateKeyPEM(keyPEM)
	if err != nil {
		return nil, err
	}

	// The leaf is the certificate the key belongs to, wherever it is in the
	// bundle. A bundle may hold an old and a renewed certificate for the same
	// key: the leaf is the one valid now that expires last, and the others are
	// left out.
	pub, ok := key.Public().(interface{ Equal(crypto.PublicKey) bool })
	if !ok {
		return nil, invalidUpload("unsupported private key type %T", key)
	}
	var mine []*x509.Certificate
	for _, c := range chain {
		if pub.Equal(c.PublicKey) {
			mine = append(mine, c)
		}
	}
	if len(mine) == 0 {
		return nil, invalidUpload("the private key does not belong to the certificate (their public keys differ): upload the key that was generated with this certificate")
	}
	validNow := func(c *x509.Certificate) bool {
		return now.Before(c.NotAfter) && !c.NotBefore.After(now.Add(uploadClockSkew))
	}
	var leaf *x509.Certificate
	for _, c := range mine {
		if validNow(c) && (leaf == nil || expiresLater(c, leaf)) {
			leaf = c
		}
	}
	if leaf == nil {
		best := mine[0]
		for _, c := range mine[1:] {
			if expiresLater(c, best) {
				best = c
			}
		}
		if !now.Before(best.NotAfter) {
			return nil, invalidUpload("the certificate expired on %s", best.NotAfter.UTC().Format("2006-01-02 15:04 UTC"))
		}
		return nil, invalidUpload("the certificate is not valid before %s: upload it once it is", best.NotBefore.UTC().Format("2006-01-02 15:04 UTC"))
	}
	var dropped []DroppedCert
	for _, c := range mine {
		if c != leaf {
			dropped = append(dropped, DroppedCert{Subject: c.Subject.String(), Reason: DroppedSuperseded})
		}
	}

	if leaf.BasicConstraintsValid && leaf.IsCA {
		return nil, invalidUpload("the certificate is a CA certificate (basic constraints CA:TRUE), which browsers refuse from a web server. " +
			"A self-signed one made with openssl req -x509 often is: make it with -addext \"basicConstraints=critical,CA:FALSE\"")
	}
	if leaf.PublicKeyAlgorithm == x509.Ed25519 {
		return nil, invalidUpload("the certificate has an Ed25519 key, which browsers and Android WebViews do not accept from a TLS server: use an ECDSA (P-256) or RSA certificate")
	}
	if len(leaf.ExtKeyUsage) > 0 && !slices.Contains(leaf.ExtKeyUsage, x509.ExtKeyUsageServerAuth) &&
		!slices.Contains(leaf.ExtKeyUsage, x509.ExtKeyUsageAny) {
		return nil, invalidUpload("the certificate is not for TLS servers: its extended key usage does not include server authentication")
	}

	// What is stored: the leaf, then the chain of its issuers found in the
	// bundle (each one's key verifies the signature of the one before), up to
	// the root, which is left out: clients carry their own. Everything else is
	// left out too. The front sends every stored certificate in every handshake,
	// so another site's certificate in there would tie the two sites together
	// for anyone watching the connection.
	path := []*x509.Certificate{leaf}
	roots := map[*x509.Certificate]bool{}
	skip := func(c *x509.Certificate) bool { return slices.Contains(path, c) || slices.Contains(mine, c) }
	for cur := leaf; len(path) < maxUploadChain; {
		var next *x509.Certificate
		for _, c := range chain {
			if skip(c) || !bytes.Equal(cur.RawIssuer, c.RawSubject) || cur.CheckSignatureFrom(c) != nil {
				continue
			}
			if isSelfSigned(c) {
				roots[c] = true
				continue
			}
			// Of several copies of an issuer (re-issued with the same key, or
			// cross-signed), the one valid now that expires last.
			if next == nil || (validNow(c) && !validNow(next)) || (validNow(c) == validNow(next) && expiresLater(c, next)) {
				next = c
			}
		}
		if next == nil {
			break
		}
		path = append(path, next)
		cur = next
	}
	for _, c := range chain {
		if skip(c) {
			continue
		}
		reason := DroppedUnrelated
		if roots[c] {
			reason = DroppedRoot
		}
		dropped = append(dropped, DroppedCert{Subject: c.Subject.String(), Reason: reason})
	}

	names := certNames(leaf)
	if len(names) == 0 {
		hint := ""
		if cn := strings.TrimSpace(leaf.Subject.CommonName); cn != "" {
			hint = fmt.Sprintf(" (its subject names %q, but clients ignore the subject)", cn)
		}
		return nil, invalidUpload("the certificate lists no DNS names or IP addresses in its subjectAltName%s: xDesign serves a certificate for the domains it names, so it must name at least one", hint)
	}
	primary := names[0]
	if cn := strings.ToLower(strings.TrimSuffix(strings.TrimSpace(leaf.Subject.CommonName), ".")); slices.Contains(names, cn) {
		primary = cn
	}

	var chainPEM bytes.Buffer
	for _, c := range path {
		_ = pem.Encode(&chainPEM, &pem.Block{Type: "CERTIFICATE", Bytes: c.Raw})
	}
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return nil, invalidUpload("the private key cannot be stored: %v", err)
	}
	keyOut := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})
	// What the front does with it: the same check, by the same library.
	if _, err := tls.X509KeyPair(chainPEM.Bytes(), keyOut); err != nil {
		return nil, invalidUpload("the certificate and key do not form a usable pair: %v", err)
	}
	return &parsedUpload{chainPEM: chainPEM.Bytes(), keyPEM: keyOut, leaf: leaf, names: names, primary: primary, dropped: dropped}, nil
}

// expiresLater reports whether a expires after b (or, expiring together, was
// issued after it): the newer of two certificates.
func expiresLater(a, b *x509.Certificate) bool {
	if !a.NotAfter.Equal(b.NotAfter) {
		return a.NotAfter.After(b.NotAfter)
	}
	return a.NotBefore.After(b.NotBefore)
}

// parsePrivateKeyPEM returns the first private key in p.
func parsePrivateKeyPEM(p []byte) (crypto.Signer, error) {
	for rest := p; ; {
		var b *pem.Block
		if b, rest = pem.Decode(rest); b == nil {
			break
		}
		if b.Type == "ENCRYPTED PRIVATE KEY" || strings.Contains(b.Headers["Proc-Type"], "ENCRYPTED") {
			return nil, invalidUpload("the private key is protected by a passphrase: remove it first, for example with: openssl pkey -in key.pem -out key-plain.pem")
		}
		var (
			k   any
			err error
		)
		switch b.Type {
		case "PRIVATE KEY":
			k, err = x509.ParsePKCS8PrivateKey(b.Bytes)
		case "RSA PRIVATE KEY":
			k, err = x509.ParsePKCS1PrivateKey(b.Bytes)
		case "EC PRIVATE KEY":
			k, err = x509.ParseECPrivateKey(b.Bytes)
		default:
			continue // EC PARAMETERS, a certificate pasted along with the key, ...
		}
		if err != nil {
			return nil, invalidUpload("the private key does not parse: %v", err)
		}
		signer, ok := k.(crypto.Signer)
		if !ok {
			return nil, invalidUpload("unsupported private key type %T: use an RSA, ECDSA or Ed25519 key", k)
		}
		return signer, nil
	}
	return nil, invalidUpload("no private key found: the key must be PEM text with a block such as -----BEGIN PRIVATE KEY-----")
}

// certNames returns the names leaf covers that xDesign can match a domain
// against: its subjectAltName dNSName entries that are a host name or a
// wildcard "*.base" whose base has at least two labels, lower case, then its
// iPAddress entries in the canonical form an IP cover is stored under.
// Deduplicated, in the certificate's order.
func certNames(leaf *x509.Certificate) []string {
	var out []string
	for _, n := range leaf.DNSNames {
		n = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(n), "."))
		if validCertName(n) && !slices.Contains(out, n) {
			out = append(out, n)
		}
	}
	for _, raw := range leaf.IPAddresses {
		ip, ok := netip.AddrFromSlice(raw)
		if n := ip.Unmap().String(); ok && !slices.Contains(out, n) {
			out = append(out, n)
		}
	}
	return out
}

func validCertName(n string) bool {
	host := n
	if strings.HasPrefix(n, "*.") {
		host = n[2:]
		if !strings.Contains(host, ".") {
			return false // "*.com" would cover a whole top-level domain
		}
	}
	if host == "" || len(host) > 253 {
		return false
	}
	for _, label := range strings.Split(host, ".") {
		if label == "" || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, r := range label {
			if (r < 'a' || r > 'z') && (r < '0' || r > '9') && r != '-' && r != '_' {
				return false
			}
		}
	}
	return true
}

// isSelfSigned reports whether c is its own issuer and signed by its own key.
func isSelfSigned(c *x509.Certificate) bool {
	return bytes.Equal(c.RawIssuer, c.RawSubject) &&
		c.CheckSignature(c.SignatureAlgorithm, c.RawTBSCertificate, c.Signature) == nil
}
