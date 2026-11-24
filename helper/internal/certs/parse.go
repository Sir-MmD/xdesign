package certs

import (
	"crypto/x509"
	"encoding/pem"
	"fmt"
)

// Parse checks a certificate chain and its private key given as PEM content, with the
// rules of Load that concern the content (4 to 6): the key belongs to the certificate,
// the leaf's validity window and extended key usage, and Info.Trusted. certPath and
// keyPath only name the files in the messages; Pair.CertFile and Pair.KeyFile stay
// zero.
//
// The admin CLI uses it: it reads the files as root through its own file system layer
// and checks their modes and whether the service user can read them itself, because
// the files it is given are often readable by root only (docs/plan/12-deployment.md
// section 6.5). Every failure is a *ValidationError.
func Parse(certPEM, keyPEM []byte, certPath, keyPath string, opts LoadOptions) (*Pair, error) {
	for _, f := range []struct {
		data  []byte
		path  string
		which File
	}{{certPEM, certPath, FileCert}, {keyPEM, keyPath, FileKey}} {
		if len(f.data) > maxFileSize {
			return nil, &ValidationError{Code: invalidCode(f.which), File: f.which, Path: f.path,
				Message: fmt.Sprintf("The file %s is larger than 1 MiB, so it is not a %s file.", f.path, noun(f.which))}
		}
	}
	return parsePair(certPEM, keyPEM, certPath, keyPath, opts)
}

// PEM returns the chain of p as PEM, leaf first, and its private key as PKCS #8 PEM: the
// form the panel stores a certificate in (docs/plan/18-install-ssl-update.md section
// 6.3). What the files held besides the certificates (a key in the same file, comments)
// is left out, so the stored chain is public. The caller clears the key once it is
// stored.
func (p *Pair) PEM() (chain, key []byte, err error) {
	for _, der := range p.Certificate.Certificate {
		chain = append(chain, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})...)
	}
	der, err := x509.MarshalPKCS8PrivateKey(p.Certificate.PrivateKey)
	if err != nil {
		return nil, nil, fmt.Errorf("encode the private key: %w", err)
	}
	defer clear(der)
	return chain, pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}), nil
}
