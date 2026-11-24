package certs

import (
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"syscall"
	"time"
)

const (
	// NotBeforeTolerance is how far in the future the validity of a certificate may
	// start: one issued moments ago by a machine whose clock runs ahead still loads
	// (docs/plan/11-security.md section 7.3).
	NotBeforeTolerance = 24 * time.Hour
	// maxFileSize bounds the files Load reads: chains and keys are a few kilobytes.
	maxFileSize = 1 << 20
)

// File names the file of a pair that a ValidationError is about.
type File string

// The two files of a pair.
const (
	FileCert File = "cert"
	FileKey  File = "key"
)

// Field codes of docs/plan/09-web-api.md section 7.3 that ValidationError.Code takes.
const (
	CodeCertUnreadable    = "cert_unreadable"
	CodeKeyUnreadable     = "key_unreadable"
	CodeCertPermissions   = "cert_permissions"
	CodeKeyPermissions    = "key_permissions"
	CodeCertInvalid       = "cert_invalid"
	CodeKeyInvalid        = "key_invalid"
	CodeCertKeyMismatch   = "cert_key_mismatch"
	CodeCertExpired       = "cert_expired"
	CodeCertNotYetValid   = "cert_not_yet_valid"
	CodeCertNotServerAuth = "cert_not_server_auth"
)

// ValidationError is a certificate or key that cannot be used. Code is the field code
// the settings API reports, and the message tells the owner what to do.
type ValidationError struct {
	// Code is one of the Code constants.
	Code string
	// File is the file the problem is in.
	File File
	// Path is the path of that file as it was given.
	Path string
	// Message says what is wrong and how to fix it, in plain words.
	Message string
	// Err is the underlying error, if any (for example one matching fs.ErrPermission).
	Err error
}

// Error returns the message.
func (e *ValidationError) Error() string { return e.Message }

// Unwrap returns the underlying error.
func (e *ValidationError) Unwrap() error { return e.Err }

// FileState identifies one version of a file: size, modification time, inode and
// device, with symlinks followed. The certificate watcher reloads a pair when the
// state of either file changes (docs/plan/11-security.md section 7.4). Replacing a
// file by rename or pointing a symlink elsewhere changes the inode even when the size
// and time stay the same.
type FileState struct {
	Size    int64
	ModTime time.Time
	Inode   uint64
	Device  uint64
}

// Equal reports whether s and o describe the same version of a file.
func (s FileState) Equal(o FileState) bool {
	return s.Size == o.Size && s.ModTime.Equal(o.ModTime) && s.Inode == o.Inode && s.Device == o.Device
}

// StatFile returns the state of the file at path, following symlinks.
func StatFile(path string) (FileState, error) {
	fi, err := os.Stat(path)
	if err != nil {
		return FileState{}, fmt.Errorf("stat %s: %w", path, err)
	}
	return stateOf(fi), nil
}

func stateOf(fi fs.FileInfo) FileState {
	st := FileState{Size: fi.Size(), ModTime: fi.ModTime()}
	st.Inode, st.Device = fileID(fi)
	return st
}

// LoadOptions are the inputs of Load besides the two paths.
type LoadOptions struct {
	// Now is the time the validity window is checked against.
	Now time.Time
	// Roots is the trust store that decides Info.Trusted; nil means the system's.
	Roots *x509.CertPool
}

// Pair is a certificate chain with its private key that passed Load.
type Pair struct {
	// Certificate is ready for a tls.Config; its Leaf is set.
	Certificate *tls.Certificate
	// Info describes the leaf certificate.
	Info Info
	// CertFile and KeyFile are the states of the two files as they were read.
	CertFile FileState
	KeyFile  FileState
}

// Load reads the PEM certificate chain at certPath and the PEM private key at keyPath
// (they may be the same file) and checks them with the rules of
// docs/plan/11-security.md section 7.3:
//
//  1. both paths are absolute and lead to regular files (symlinks are followed);
//  2. the process can read them (the service runs as the xdesign user);
//  3. the key is not readable or writable by other users and the certificate is not
//     writable by them (on Linux: a file's mode on Windows does not tell, checkMode);
//  4. the key belongs to the certificate;
//  5. the leaf's validity starts at most 24 hours after opts.Now and ends after it,
//     and an extended key usage, when present, includes server authentication;
//  6. Info.Trusted tells whether the chain verifies against opts.Roots (it decides
//     HSTS only and never fails the load).
//
// Every failure is a *ValidationError.
func Load(certPath, keyPath string, opts LoadOptions) (*Pair, error) {
	certPEM, certState, err := readFile(certPath, FileCert)
	if err != nil {
		return nil, err
	}
	keyPEM, keyState, err := readFile(keyPath, FileKey)
	if err != nil {
		return nil, err
	}
	p, err := parsePair(certPEM, keyPEM, certPath, keyPath, opts)
	if err != nil {
		return nil, err
	}
	p.CertFile, p.KeyFile = certState, keyState
	return p, nil
}

// readFile applies rules 1 to 3 of Load to one file and returns its content.
func readFile(path string, which File) ([]byte, FileState, error) {
	fail := func(code, msg string, err error) ([]byte, FileState, error) {
		return nil, FileState{}, &ValidationError{Code: code, File: which, Path: path, Message: msg, Err: err}
	}
	if !filepath.IsAbs(path) {
		return fail(unreadableCode(which), fmt.Sprintf("The %s path %q is not absolute. Give the full path, for example %s.",
			noun(which), path, examplePath(which)), nil)
	}
	// O_NONBLOCK keeps a FIFO at that path from blocking the open; it changes nothing
	// for regular files.
	f, err := os.OpenFile(path, os.O_RDONLY|syscall.O_NONBLOCK, 0) //nolint:gosec // G304: reading the configured certificate files is the purpose of this function
	if err != nil {
		return fail(unreadableCode(which), openMessage(path, which, err), err)
	}
	defer func() { _ = f.Close() }() // opened read-only: closing cannot lose data
	fi, err := f.Stat()
	if err != nil {
		return fail(unreadableCode(which), fmt.Sprintf("The %s file %s cannot be read: %v.", noun(which), path, err), err)
	}
	if !fi.Mode().IsRegular() {
		return fail(unreadableCode(which), fmt.Sprintf("%s is not a regular file. Give the path of the %s file itself.",
			path, noun(which)), nil)
	}
	if code, msg := checkMode(path, which, fi.Mode()); code != "" {
		return fail(code, msg, nil)
	}
	data, err := io.ReadAll(io.LimitReader(f, maxFileSize+1))
	if err != nil {
		return fail(unreadableCode(which), fmt.Sprintf("The %s file %s cannot be read: %v.", noun(which), path, err), err)
	}
	if len(data) > maxFileSize {
		return fail(invalidCode(which), fmt.Sprintf("The file %s is larger than 1 MiB, so it is not a %s file.", path, noun(which)), nil)
	}
	return data, stateOf(fi), nil
}

// openMessage explains why a file of a pair cannot be opened.
func openMessage(path string, which File, err error) string {
	var msg string
	switch {
	case errors.Is(err, fs.ErrNotExist):
		msg = fmt.Sprintf("The %s file %s does not exist.", noun(which), path)
	case errors.Is(err, fs.ErrPermission):
		msg = fmt.Sprintf("xDesign cannot read the %s file %s. Make the file and its folders readable for %s, "+
			"or paste the certificate and its key in Settings > HTTPS.", noun(which), path, serviceAccount)
	default:
		msg = fmt.Sprintf("The %s file %s cannot be opened: %v.", noun(which), path, err)
	}
	if underHome(path) {
		// ProtectHome=yes hides these folders from the service, which then reports
		// them as missing or unreadable (docs/plan/11-security.md section 7.3).
		msg += " Folders under /home and /root are hidden from the service: copy the files to another folder, " +
			"or paste the certificate and its key in Settings > HTTPS."
	}
	return msg
}

// parsePair applies rules 4 to 6 of Load.
func parsePair(certPEM, keyPEM []byte, certPath, keyPath string, opts LoadOptions) (*Pair, error) {
	chain, err := parseChain(certPEM, certPath)
	if err != nil {
		return nil, err
	}
	if err := checkKey(keyPEM, keyPath); err != nil {
		return nil, err
	}
	cert, err := tls.X509KeyPair(certPEM, keyPEM)
	if err != nil {
		// Both parse on their own, so the key belongs to another certificate.
		return nil, &ValidationError{Code: CodeCertKeyMismatch, File: FileKey, Path: keyPath, Err: err,
			Message: fmt.Sprintf("The private key in %s does not belong to the certificate in %s.", keyPath, certPath)}
	}
	leaf := chain[0]
	cert.Leaf = leaf
	invalid := func(code, msg string) (*Pair, error) {
		return nil, &ValidationError{Code: code, File: FileCert, Path: certPath, Message: msg}
	}
	switch {
	case leaf.NotBefore.After(opts.Now.Add(NotBeforeTolerance)):
		return invalid(CodeCertNotYetValid, fmt.Sprintf("The certificate in %s is valid only from %s. Check the date on the server, or wait until then.",
			certPath, formatTime(leaf.NotBefore)))
	case !opts.Now.Before(leaf.NotAfter):
		return invalid(CodeCertExpired, fmt.Sprintf("The certificate in %s expired on %s. Renew it and set the new files.",
			certPath, formatTime(leaf.NotAfter)))
	case !serverAuth(leaf):
		return invalid(CodeCertNotServerAuth, fmt.Sprintf("The certificate in %s is not meant for web servers: "+
			"its extended key usage does not include server authentication.", certPath))
	}
	return &Pair{Certificate: &cert, Info: newInfo(leaf, verifyChain(chain, opts))}, nil
}

// parseChain returns the certificates of a PEM file, leaf first.
func parseChain(certPEM []byte, path string) ([]*x509.Certificate, error) {
	invalid := func(msg string, err error) error {
		return &ValidationError{Code: CodeCertInvalid, File: FileCert, Path: path, Message: msg, Err: err}
	}
	var chain []*x509.Certificate
	sawKey := false
	for block, rest := pem.Decode(certPEM); block != nil; block, rest = pem.Decode(rest) {
		switch {
		case block.Type == "CERTIFICATE":
			c, err := x509.ParseCertificate(block.Bytes)
			if err != nil {
				return nil, invalid(fmt.Sprintf("The certificate file %s contains a certificate that cannot be read: %v.", path, err), err)
			}
			chain = append(chain, c)
		case strings.HasSuffix(block.Type, "PRIVATE KEY"):
			sawKey = true
		}
	}
	switch {
	case len(chain) > 0:
		return chain, nil
	case sawKey:
		return nil, invalid(fmt.Sprintf("The file %s contains a private key but no certificate. "+
			"Were the certificate and key paths swapped?", path), nil)
	default:
		return nil, invalid(fmt.Sprintf("The file %s contains no PEM certificate.", path), nil)
	}
}

// checkKey reports a key file without a usable PEM private key, so a broken key is
// not mistaken for a key of another certificate.
func checkKey(keyPEM []byte, path string) error {
	invalid := func(msg string, err error) error {
		return &ValidationError{Code: CodeKeyInvalid, File: FileKey, Path: path, Message: msg, Err: err}
	}
	sawCert := false
	for block, rest := pem.Decode(keyPEM); block != nil; block, rest = pem.Decode(rest) {
		switch {
		case block.Type == "ENCRYPTED PRIVATE KEY" || strings.Contains(block.Headers["Proc-Type"], "ENCRYPTED"):
			return invalid(fmt.Sprintf("The private key in %s is protected with a passphrase. xDesign needs it without one: "+
				"openssl pkey -in %s -out <new file>", path, path), nil)
		case block.Type == "PRIVATE KEY" || strings.HasSuffix(block.Type, " PRIVATE KEY"):
			if err := parsePrivateKey(block.Bytes); err != nil {
				return invalid(fmt.Sprintf("The private key in %s cannot be read: %v.", path, err), err)
			}
			return nil
		case block.Type == "CERTIFICATE":
			sawCert = true
		}
	}
	if sawCert {
		return invalid(fmt.Sprintf("The file %s contains a certificate but no private key. "+
			"Were the certificate and key paths swapped?", path), nil)
	}
	return invalid(fmt.Sprintf("The file %s contains no PEM private key.", path), nil)
}

// errKeyType reports a private key of a type TLS cannot use.
var errKeyType = errors.New("the key type is not supported (use RSA, ECDSA or Ed25519)")

// parsePrivateKey accepts the encodings and key types crypto/tls accepts.
func parsePrivateKey(der []byte) error {
	if _, err := x509.ParsePKCS1PrivateKey(der); err == nil {
		return nil
	}
	if key, err := x509.ParsePKCS8PrivateKey(der); err == nil {
		switch key.(type) {
		case *rsa.PrivateKey, *ecdsa.PrivateKey, ed25519.PrivateKey:
			return nil
		default:
			return errKeyType
		}
	}
	if _, err := x509.ParseECPrivateKey(der); err != nil {
		return errors.New("it is not a PKCS #1, PKCS #8 or SEC 1 private key")
	}
	return nil
}

// serverAuth reports whether c may serve TLS: without an extended key usage
// extension, or with server authentication (or any usage) in it.
func serverAuth(c *x509.Certificate) bool {
	if len(c.ExtKeyUsage) == 0 && len(c.UnknownExtKeyUsage) == 0 {
		return true
	}
	return slices.ContainsFunc(c.ExtKeyUsage, func(u x509.ExtKeyUsage) bool {
		return u == x509.ExtKeyUsageServerAuth || u == x509.ExtKeyUsageAny
	})
}

// verifyChain reports whether the chain verifies against opts.Roots (the system trust
// store when nil) for server authentication. The host name is not known here and is
// not checked (docs/plan/11-security.md section 6.4).
func verifyChain(chain []*x509.Certificate, opts LoadOptions) bool {
	intermediates := x509.NewCertPool()
	for _, c := range chain[1:] {
		intermediates.AddCert(c)
	}
	_, err := chain[0].Verify(x509.VerifyOptions{
		Roots:         opts.Roots,
		Intermediates: intermediates,
		CurrentTime:   opts.Now,
		KeyUsages:     []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	})
	return err == nil
}

func formatTime(t time.Time) string {
	return t.UTC().Format("2006-01-02 15:04 UTC")
}

func noun(which File) string {
	if which == FileKey {
		return "key"
	}
	return "certificate"
}

func examplePath(which File) string {
	if which == FileKey {
		return ExampleDir + "privkey.pem"
	}
	return ExampleDir + "fullchain.pem"
}

func unreadableCode(which File) string {
	if which == FileKey {
		return CodeKeyUnreadable
	}
	return CodeCertUnreadable
}

func invalidCode(which File) string {
	if which == FileKey {
		return CodeKeyInvalid
	}
	return CodeCertInvalid
}
