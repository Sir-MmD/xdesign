// Package certs holds the panel's TLS policy and the certificate helpers that the web
// server and the admin CLI share (docs/plan/11-security.md section 7):
//
//   - ServerConfig and CipherSuites: TLS 1.2 and 1.3 only, with the pinned ECDHE AEAD
//     suites of section 7.1;
//   - Load: reads and validates a certificate and key with the rules of section 7.3,
//     and Pair.Warnings for the problems that do not block a certificate
//     (docs/plan/09-web-api.md section 3.2);
//   - GenerateSelfSigned, WriteSelfSigned and EnsureSelfSigned: the built-in
//     self-signed certificate of section 7.5, its files and its renewal;
//   - Fingerprint: the SHA-256 fingerprint that the installer and `xdesign admin url`
//     print;
//   - CheckPlainHTTPAddr: plain HTTP only on a loopback address (section 4.6).
//
// It imports only the standard library, so internal/cli can use it without importing
// internal/front (docs/plan/05-repo-and-conventions.md section 2). Nothing here keeps
// state or starts goroutines: the certificate store that serves, watches and reloads
// certificates lives in internal/front (Certificates) and internal/ssl.
//
// Copied from xWriter's internal/certs as it is (docs/plan/07-server-install-update.md
// section 10); the other docs/plan references in this package are xWriter's plan. Its
// messages name Settings > HTTPS and xDesign where xWriter's name its admin commands
// and the panel.
package certs
