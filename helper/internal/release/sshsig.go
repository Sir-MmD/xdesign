package release

import (
	"bytes"
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"strings"
)

// Release signatures are made with `ssh-keygen -Y sign -n xdesign-release` over
// SHA256SUMS (docs/plan/07-server-install-update.md section 2) and checked here with
// the semantics of `ssh-keygen -Y verify`: the signature must be an SSHSIG of the
// expected namespace, made by exactly one of the public keys this build trusts
// (trustedKeys). The format is OpenSSH's PROTOCOL.sshsig.

const (
	sshsigMagic   = "SSHSIG"
	sshsigVersion = 1
	sshsigBegin   = "-----BEGIN SSH SIGNATURE-----"
	sshsigEnd     = "-----END SSH SIGNATURE-----"
	sshEd25519    = "ssh-ed25519"
)

// ErrBadSignature is returned when a signature does not verify.
var ErrBadSignature = errors.New("the signature does not match")

// trustedKeys returns the public halves of the release signing keys in OpenSSH form
// ("ssh-ed25519 AAAA..."). It is empty until the developer creates the signing key pair
// (ssh-keygen -t ed25519) and adds its public half here: until then every check reports
// "not signed", and an update relies on SHA256SUMS alone.
func trustedKeys() []string {
	return nil
}

// Signature is what [CheckSignature] found.
type Signature int

// Results of a signature check.
const (
	// SignatureNone is "not signed": no SHA256SUMS.sig, or no trusted key to check it with.
	SignatureNone Signature = iota
	// SignatureValid is "valid": SHA256SUMS.sig verifies with a trusted key.
	SignatureValid
)

// String returns the words the update shows after "Signature: ".
func (s Signature) String() string {
	if s == SignatureValid {
		return "valid"
	}
	return "not signed"
}

// CheckSignature checks sig, the content of SHA256SUMS.sig (empty when there is none),
// over sums, the content of SHA256SUMS, with the trusted keys. It reports SignatureNone
// when there is no signature or no trusted key, SignatureValid when a trusted key verifies
// it, and an error wrapping ErrBadSignature when none does: the update stops then.
func CheckSignature(sums, sig []byte) (Signature, error) {
	keys := trustedKeys()
	if len(sig) == 0 || len(keys) == 0 {
		return SignatureNone, nil
	}
	var err error
	for _, key := range keys {
		if err = VerifySSHSignature(key, SigNamespace, sums, sig); err == nil {
			return SignatureValid, nil
		}
	}
	return SignatureNone, err
}

// VerifySSHSignature checks the armored signature sig of message: an Ed25519 SSHSIG
// in namespace made by publicKey, which is in OpenSSH form ("ssh-ed25519 AAAA...").
func VerifySSHSignature(publicKey, namespace string, message, sig []byte) error {
	keyBlob, key, err := parseEd25519PublicKey(publicKey)
	if err != nil {
		return fmt.Errorf("the release key of this binary: %w", err)
	}
	blob, err := unarmorSSHSig(sig)
	if err != nil {
		return err
	}
	r := sshReader{data: blob}
	magic := r.bytes(len(sshsigMagic))
	version := r.uint32()
	signer := r.str()
	ns := r.str()
	reserved := r.str()
	hashAlg := r.str()
	sigBlob := r.str()
	if r.err != nil || !r.done() || string(magic) != sshsigMagic {
		return fmt.Errorf("%w: it is not an SSH signature", ErrBadSignature)
	}
	if version != sshsigVersion {
		return fmt.Errorf("%w: unknown SSH signature version %d", ErrBadSignature, version)
	}
	if !bytes.Equal(signer, keyBlob) {
		return fmt.Errorf("%w: it was made with another key than the release key of this binary", ErrBadSignature)
	}
	if string(ns) != namespace {
		return fmt.Errorf("%w: it is for %q, not for %q", ErrBadSignature, ns, namespace)
	}
	var digest []byte
	switch string(hashAlg) {
	case "sha512":
		d := sha512.Sum512(message)
		digest = d[:]
	case "sha256":
		d := sha256.Sum256(message)
		digest = d[:]
	default:
		return fmt.Errorf("%w: unknown hash algorithm %q", ErrBadSignature, hashAlg)
	}
	sr := sshReader{data: sigBlob}
	alg := sr.str()
	raw := sr.str()
	if sr.err != nil || !sr.done() || string(alg) != sshEd25519 || len(raw) != ed25519.SignatureSize {
		return fmt.Errorf("%w: it is not an Ed25519 signature", ErrBadSignature)
	}
	var signed bytes.Buffer
	signed.WriteString(sshsigMagic)
	writeSSHString(&signed, ns)
	writeSSHString(&signed, reserved)
	writeSSHString(&signed, hashAlg)
	writeSSHString(&signed, digest)
	if !ed25519.Verify(key, signed.Bytes(), raw) {
		return ErrBadSignature
	}
	return nil
}

// parseEd25519PublicKey parses "ssh-ed25519 <base64> [comment]" and returns the key
// blob and the key.
func parseEd25519PublicKey(s string) (blob []byte, key ed25519.PublicKey, err error) {
	fields := strings.Fields(s)
	if len(fields) < 2 || fields[0] != sshEd25519 {
		return nil, nil, errors.New("not an ssh-ed25519 public key")
	}
	blob, err = base64.StdEncoding.DecodeString(fields[1])
	if err != nil {
		return nil, nil, fmt.Errorf("the key is not base64: %w", err)
	}
	r := sshReader{data: blob}
	alg := r.str()
	k := r.str()
	if r.err != nil || !r.done() || string(alg) != sshEd25519 || len(k) != ed25519.PublicKeySize {
		return nil, nil, errors.New("not an ssh-ed25519 public key")
	}
	return blob, ed25519.PublicKey(k), nil
}

// unarmorSSHSig returns the binary signature inside the BEGIN and END lines.
func unarmorSSHSig(sig []byte) ([]byte, error) {
	text := strings.TrimSpace(strings.ReplaceAll(string(sig), "\r", ""))
	inner, ok := strings.CutPrefix(text, sshsigBegin)
	if ok {
		inner, ok = strings.CutSuffix(inner, sshsigEnd)
	}
	if !ok {
		return nil, fmt.Errorf("%w: %s is not an SSH signature file", ErrBadSignature, SigName)
	}
	blob, err := base64.StdEncoding.DecodeString(strings.Join(strings.Fields(inner), ""))
	if err != nil {
		return nil, fmt.Errorf("%w: %s is damaged: %w", ErrBadSignature, SigName, err)
	}
	return blob, nil
}

// sshReader reads the SSH wire format: big-endian uint32 lengths before strings.
type sshReader struct {
	data []byte
	err  error
}

func (r *sshReader) bytes(n int) []byte {
	if r.err != nil {
		return nil
	}
	if n < 0 || len(r.data) < n {
		r.err = errors.New("truncated")
		return nil
	}
	b := r.data[:n]
	r.data = r.data[n:]
	return b
}

func (r *sshReader) uint32() uint32 {
	b := r.bytes(4)
	if b == nil {
		return 0
	}
	return binary.BigEndian.Uint32(b)
}

func (r *sshReader) str() []byte {
	n := int64(r.uint32())
	if r.err != nil || n > int64(len(r.data)) {
		r.err = errors.New("truncated")
		return nil
	}
	return r.bytes(int(n))
}

func (r *sshReader) done() bool {
	return len(r.data) == 0
}

func writeSSHString(b *bytes.Buffer, s []byte) {
	var n [4]byte
	binary.BigEndian.PutUint32(n[:], uint32(len(s))) //nolint:gosec // G115: the parts are a few hundred bytes
	b.Write(n[:])
	b.Write(s)
}
