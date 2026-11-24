package certs

import "crypto/tls"

// MinVersion is the oldest TLS version the panel accepts. The newest is Go's
// default, TLS 1.3 (docs/plan/11-security.md section 7.1).
const MinVersion = tls.VersionTLS12

// CipherSuites returns the TLS 1.2 cipher suites the panel accepts: ECDHE key
// exchange with AEAD ciphers only. Go's defaults exclude RSA key exchange and 3DES
// but still accept CBC suites with SHA-1, so the list is pinned
// (docs/plan/11-security.md section 7.1). TLS 1.3 suites are not configurable in Go
// and are all AEAD.
func CipherSuites() []uint16 {
	return []uint16{
		tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
		tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
		tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256,
		tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
		tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
		tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256,
	}
}

// ServerConfig returns the TLS configuration of the panel's listeners: MinVersion,
// CipherSuites and get as GetCertificate. Certificates stays empty, so Go calls get
// for every handshake, including clients that connect by IP address and send no
// server name (docs/plan/11-security.md section 7.1). Key exchanges are Go's
// defaults, which include the hybrid post-quantum ones; http.Server.ServeTLS adds the
// ALPN protocols h2 and http/1.1.
func ServerConfig(get func(*tls.ClientHelloInfo) (*tls.Certificate, error)) *tls.Config {
	return &tls.Config{
		MinVersion:     MinVersion,
		CipherSuites:   CipherSuites(),
		GetCertificate: get,
	}
}
