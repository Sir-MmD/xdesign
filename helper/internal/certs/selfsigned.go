package certs

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"fmt"
	"io/fs"
	"math/big"
	"net"
	"net/netip"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

// Parameters of the built-in self-signed certificate (docs/plan/11-security.md
// section 7.5, docs/plan/12-deployment.md sections 2 and 4.8).
const (
	// SelfSignedCertFile and SelfSignedKeyFile are the file names in the self-signed
	// folder, /var/lib/xdesign/certs.
	SelfSignedCertFile = "self-signed.crt"
	SelfSignedKeyFile  = "self-signed.key"
	// SelfSignedValidity is the longest validity Apple platforms accept, even for a
	// certificate the user chose to trust.
	SelfSignedValidity = 825 * 24 * time.Hour
	// SelfSignedRenewBefore is how long before its expiry the certificate is replaced.
	SelfSignedRenewBefore = 30 * 24 * time.Hour

	// selfSignedBackdate starts the validity a little in the past, so browsers whose
	// clock is behind the server's accept a new certificate.
	selfSignedBackdate = time.Hour
	// serialBits is the size of the random serial number.
	serialBits = 128

	selfSignedCertMode fs.FileMode = 0o644
	selfSignedKeyMode  fs.FileMode = 0o600
	selfSignedDirMode  fs.FileMode = 0o700
)

// SelfSignedOptions are the names a self-signed certificate covers. Every certificate
// also covers localhost, 127.0.0.1 and ::1.
type SelfSignedOptions struct {
	// Hostname is the subject's common name and a subject alternative name.
	Hostname string
	// Hosts are more host names or IP addresses, such as the installer's
	// --public-host value.
	Hosts []string
	// Addresses are the global unicast addresses of the host's interfaces.
	Addresses []netip.Addr
}

// LocalSelfSignedOptions returns the options for this host: its host name and the
// global unicast addresses of its interfaces, plus hosts.
func LocalSelfSignedOptions(hosts ...string) (SelfSignedOptions, error) {
	name, err := os.Hostname()
	if err != nil {
		return SelfSignedOptions{}, fmt.Errorf("read the host name: %w", err)
	}
	addrs, err := HostAddresses()
	if err != nil {
		return SelfSignedOptions{}, err
	}
	return SelfSignedOptions{Hostname: name, Hosts: hosts, Addresses: addrs}, nil
}

// HostAddresses returns the global unicast addresses of the host's interfaces:
// private ranges included, loopback and link-local addresses left out.
func HostAddresses() ([]netip.Addr, error) {
	ifaddrs, err := net.InterfaceAddrs()
	if err != nil {
		return nil, fmt.Errorf("list the addresses of the network interfaces: %w", err)
	}
	var out []netip.Addr
	for _, a := range ifaddrs {
		ipnet, ok := a.(*net.IPNet)
		if !ok {
			continue
		}
		ip, ok := netip.AddrFromSlice(ipnet.IP)
		if ok && ip.Unmap().IsGlobalUnicast() {
			out = append(out, ip.Unmap())
		}
	}
	return out, nil
}

// names returns the subject alternative names of o without duplicates, in order:
// the host name, the hosts, localhost, the addresses and the loopback addresses.
// Names that cannot be DNS names in a certificate are skipped.
func (o SelfSignedOptions) names() (dns []string, ips []net.IP) {
	seenDNS := map[string]bool{}
	seenIP := map[netip.Addr]bool{}
	addIP := func(ip netip.Addr) {
		ip = ip.Unmap().WithZone("")
		if ip.IsValid() && !seenIP[ip] {
			seenIP[ip] = true
			ips = append(ips, net.IP(ip.AsSlice()))
		}
	}
	addHost := func(h string) {
		h = strings.TrimSuffix(strings.TrimSpace(h), ".")
		if ip, err := netip.ParseAddr(strings.TrimSuffix(strings.TrimPrefix(h, "["), "]")); err == nil {
			addIP(ip)
			return
		}
		h = strings.ToLower(h)
		if validDNSName(h) && !seenDNS[h] {
			seenDNS[h] = true
			dns = append(dns, h)
		}
	}
	addHost(o.Hostname)
	for _, h := range o.Hosts {
		addHost(h)
	}
	addHost("localhost")
	for _, a := range o.Addresses {
		addIP(a)
	}
	addIP(netip.AddrFrom4([4]byte{127, 0, 0, 1}))
	addIP(netip.IPv6Loopback())
	return dns, ips
}

// validDNSName accepts host names made of labels of letters, digits, hyphens and
// underscores, at most 63 characters each and 253 in total.
func validDNSName(name string) bool {
	if name == "" || len(name) > 253 {
		return false
	}
	for label := range strings.SplitSeq(name, ".") {
		if label == "" || len(label) > 63 {
			return false
		}
		for _, c := range label {
			if (c < 'a' || c > 'z') && (c < '0' || c > '9') && c != '-' && c != '_' {
				return false
			}
		}
	}
	return true
}

// withNamesOf adds the names of leaf to o, so a renewed certificate covers what the
// old one covered (a --public-host given at install time, for example).
func (o SelfSignedOptions) withNamesOf(leaf *x509.Certificate) SelfSignedOptions {
	if o.Hostname == "" {
		o.Hostname = leaf.Subject.CommonName
	}
	o.Hosts = append(slices.Clone(o.Hosts), leaf.DNSNames...)
	addrs := slices.Clone(o.Addresses)
	for _, ip := range leaf.IPAddresses {
		if a, ok := netip.AddrFromSlice(ip); ok {
			addrs = append(addrs, a)
		}
	}
	o.Addresses = addrs
	return o
}

// GenerateSelfSigned returns a new self-signed certificate and its private key, PEM
// encoded, with the parameters of docs/plan/11-security.md section 7.5: an ECDSA
// P-256 key, an ECDSA with SHA-256 signature, a 128-bit random serial number,
// validity of 825 days from an hour before now, the subject CN=<hostname> and nothing
// else (no organization or product name, so scanners cannot tell what serves it),
// subject alternative names from opts, basic constraints CA:FALSE, key usage digital
// signature and extended key usage server authentication.
func GenerateSelfSigned(opts SelfSignedOptions, now time.Time) (certPEM, keyPEM []byte, err error) {
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("generate the key: %w", err)
	}
	return selfSignedWith(opts, key, now)
}

// RenewSelfSigned is GenerateSelfSigned with the key in keyPEM instead of a new one: the
// certificate is new (its serial, validity and names), its key is not, so whoever trusts
// the key alone still accepts it. The agents of the agents' address pin the key of the
// panel's built-in certificate (docs/plan/24-android-devices-agents-whatsapp.md sections 6.3
// and 6.4, AGT-03), and its renewals keep it. The key must be an ECDSA P-256 key in PKCS #8
// or SEC 1, as GenerateSelfSigned makes; any other key fails, and the caller makes a new
// pair instead. keyPEM comes back as PKCS #8.
func RenewSelfSigned(opts SelfSignedOptions, keyPEM []byte, now time.Time) (certPEM, newKeyPEM []byte, err error) {
	block, _ := pem.Decode(keyPEM)
	if block == nil {
		return nil, nil, errors.New("the key is not in PEM")
	}
	var parsed any
	switch block.Type {
	case "PRIVATE KEY":
		parsed, err = x509.ParsePKCS8PrivateKey(block.Bytes)
	case "EC PRIVATE KEY":
		parsed, err = x509.ParseECPrivateKey(block.Bytes)
	default:
		return nil, nil, fmt.Errorf("the key is a %s, not an ECDSA key", strings.ToLower(block.Type))
	}
	if err != nil {
		return nil, nil, fmt.Errorf("read the key: %w", err)
	}
	key, ok := parsed.(*ecdsa.PrivateKey)
	if !ok || key.Curve != elliptic.P256() {
		return nil, nil, errors.New("the key is not an ECDSA P-256 key")
	}
	return selfSignedWith(opts, key, now)
}

// selfSignedWith makes the certificate of GenerateSelfSigned for opts with key and returns
// both PEM encoded.
func selfSignedWith(opts SelfSignedOptions, key *ecdsa.PrivateKey, now time.Time) (certPEM, keyPEM []byte, err error) {
	serial, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), serialBits))
	if err != nil {
		return nil, nil, fmt.Errorf("generate the serial number: %w", err)
	}
	if serial.Sign() == 0 {
		serial.SetInt64(1) // RFC 5280 asks for a positive serial number
	}
	cn := strings.TrimSpace(opts.Hostname)
	if cn == "" {
		cn = "localhost"
	}
	dns, ips := opts.names()
	notBefore := now.UTC().Truncate(time.Second).Add(-selfSignedBackdate)
	tmpl := &x509.Certificate{
		SerialNumber:          serial,
		Subject:               pkix.Name{CommonName: cn},
		NotBefore:             notBefore,
		NotAfter:              notBefore.Add(SelfSignedValidity),
		KeyUsage:              x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		IsCA:                  false,
		DNSNames:              dns,
		IPAddresses:           ips,
		SignatureAlgorithm:    x509.ECDSAWithSHA256,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		return nil, nil, fmt.Errorf("create the certificate: %w", err)
	}
	keyDER, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		return nil, nil, fmt.Errorf("encode the key: %w", err)
	}
	return pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}),
		pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: keyDER}), nil
}

// SelfSignedPaths returns the paths of the self-signed certificate and key in dir.
func SelfSignedPaths(dir string) (certPath, keyPath string) {
	return filepath.Join(dir, SelfSignedCertFile), filepath.Join(dir, SelfSignedKeyFile)
}

// WriteSelfSigned replaces the self-signed pair in dir with certPEM and keyPEM. It
// creates dir with mode 0700 when it is missing and writes the certificate with mode
// 0644 and the key with mode 0600, whatever the umask. Each file is written to a
// temporary file in dir and renamed over the old one, so a reader sees either the old
// or the new file. The key is replaced first: a reader that catches the new key with
// the old certificate refuses the mismatched pair and keeps what it serves. The
// caller sets the owner (the files belong to the xdesign user, docs/plan/12-deployment.md
// section 2).
func WriteSelfSigned(dir string, certPEM, keyPEM []byte) error {
	if err := os.MkdirAll(dir, selfSignedDirMode); err != nil {
		return fmt.Errorf("create the folder %s: %w", dir, err)
	}
	certPath, keyPath := SelfSignedPaths(dir)
	if err := writeAtomic(keyPath, keyPEM, selfSignedKeyMode); err != nil {
		return err
	}
	return writeAtomic(certPath, certPEM, selfSignedCertMode)
}

// writeAtomic replaces path with data through a temporary file in the same folder
// that is written, given mode, synced and renamed over path; then it syncs the
// folder, so the new file survives a crash.
func writeAtomic(path string, data []byte, mode fs.FileMode) (err error) {
	dir := filepath.Dir(path)
	f, err := os.CreateTemp(dir, "."+filepath.Base(path)+".*.tmp")
	if err != nil {
		return fmt.Errorf("create a temporary file in %s: %w", dir, err)
	}
	tmp := f.Name()
	defer func() {
		if err != nil {
			_ = f.Close()      // already closed on the success path; a second close only fails
			_ = os.Remove(tmp) // nothing else refers to the temporary file
		}
	}()
	if _, err := f.Write(data); err != nil {
		return fmt.Errorf("write %s: %w", tmp, err)
	}
	// CreateTemp makes 0600 files; Chmod sets the mode exactly, without the umask.
	if err := f.Chmod(mode); err != nil {
		return fmt.Errorf("set the mode of %s: %w", tmp, err)
	}
	if err := f.Sync(); err != nil {
		return fmt.Errorf("sync %s: %w", tmp, err)
	}
	if err := f.Close(); err != nil {
		return fmt.Errorf("close %s: %w", tmp, err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("replace %s: %w", path, err)
	}
	return syncDir(dir)
}

func syncDir(dir string) error {
	d, err := os.Open(dir) //nolint:gosec // G304: the folder of the self-signed certificate, from the bootstrap config
	if err != nil {
		return fmt.Errorf("open %s: %w", dir, err)
	}
	defer func() { _ = d.Close() }() // a folder opened read-only: closing cannot lose data
	if err := d.Sync(); err != nil {
		return fmt.Errorf("sync %s: %w", dir, err)
	}
	return nil
}

// NeedsRenewal reports whether a self-signed certificate that expires at notAfter is
// due for renewal at now: 30 days or less before its expiry.
func NeedsRenewal(notAfter, now time.Time) bool {
	return notAfter.Sub(now) <= SelfSignedRenewBefore
}

// EnsureAction says what EnsureSelfSigned did.
type EnsureAction int

// Values of EnsureAction.
const (
	// SelfSignedKept means the files hold a usable certificate that is not due for
	// renewal.
	SelfSignedKept EnsureAction = iota
	// SelfSignedCreated means the files were missing or unusable and a new
	// certificate was written.
	SelfSignedCreated
	// SelfSignedRenewed means the certificate was due for renewal and a new one with
	// the same names was written.
	SelfSignedRenewed
)

// String returns kept, created or renewed.
func (a EnsureAction) String() string {
	switch a {
	case SelfSignedKept:
		return "kept"
	case SelfSignedCreated:
		return "created"
	case SelfSignedRenewed:
		return "renewed"
	}
	return fmt.Sprintf("EnsureAction(%d)", int(a))
}

// Ensured is the result of EnsureSelfSigned.
type Ensured struct {
	// Pair is the self-signed pair now in the folder.
	Pair *Pair
	// Action says whether the pair was kept, created or renewed.
	Action EnsureAction
	// Replaced is the problem of the previous files when they existed but could not
	// be used (Action is SelfSignedCreated); nil otherwise.
	Replaced error
}

// EnsureSelfSigned returns the self-signed pair in dir, after writing a new one when
// the files are missing or fail Load (expired, mismatched, a key readable by other
// users, which may have leaked) or when the certificate is due for renewal. A renewed
// certificate keeps the names of the old one besides those of opts. The server calls
// it at start, the installer and `xdesign admin clear-tls` when they need the
// certificate (docs/plan/11-security.md section 7.5); every new certificate has a new
// fingerprint, which the caller logs or prints.
func EnsureSelfSigned(dir string, opts SelfSignedOptions, now time.Time) (Ensured, error) {
	certPath, keyPath := SelfSignedPaths(dir)
	pair, err := Load(certPath, keyPath, LoadOptions{Now: now})
	result := Ensured{Action: SelfSignedCreated}
	switch {
	case err == nil && !NeedsRenewal(pair.Info.NotAfter, now):
		return Ensured{Pair: pair, Action: SelfSignedKept}, nil
	case err == nil:
		result.Action = SelfSignedRenewed
		opts = opts.withNamesOf(pair.Certificate.Leaf)
	case !errors.Is(err, fs.ErrNotExist):
		result.Replaced = err
	}
	certPEM, keyPEM, err := GenerateSelfSigned(opts, now)
	if err != nil {
		return Ensured{}, err
	}
	if err := WriteSelfSigned(dir, certPEM, keyPEM); err != nil {
		return Ensured{}, err
	}
	if result.Pair, err = Load(certPath, keyPath, LoadOptions{Now: now}); err != nil {
		return Ensured{}, fmt.Errorf("load the new self-signed certificate: %w", err)
	}
	return result, nil
}
