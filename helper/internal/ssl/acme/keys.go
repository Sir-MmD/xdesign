package acme

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
)

// NewAccountKey returns a new ACME account key: ECDSA P-256, which signs with ES256.
func NewAccountKey() (crypto.Signer, error) {
	k, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("make an ACME account key: %w", err)
	}
	return k, nil
}

// EncodeKey returns k as a PKCS #8 PEM block, the form the state file keeps.
func EncodeKey(k crypto.Signer) ([]byte, error) {
	der, err := x509.MarshalPKCS8PrivateKey(k)
	if err != nil {
		return nil, fmt.Errorf("encode an ACME account key: %w", err)
	}
	return pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der}), nil
}

// DecodeKey parses a key that EncodeKey wrote.
func DecodeKey(p []byte) (crypto.Signer, error) {
	block, _ := pem.Decode(p)
	if block == nil {
		return nil, errors.New("read an ACME account key: no PEM block")
	}
	k, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, fmt.Errorf("read an ACME account key: %w", err)
	}
	signer, ok := k.(crypto.Signer)
	if !ok {
		return nil, fmt.Errorf("read an ACME account key: a %T cannot sign", k)
	}
	return signer, nil
}
