// Package front is the helper's web front (docs/plan/07-server-install-update.md
// sections 1 and 8, D-30): `xdesign serve` starts the Node app as its child, restarts it
// with backoff when it exits and stops it cleanly on shutdown (Child), and answers every
// request under the web base path by passing it to the app's Unix socket (on Windows its
// port of 127.0.0.1 with the proxy secret, docs/plan/18-third-owner-list-2026-11-23.md
// section 8.2), WebSocket upgrades included, or with the "xDesign is starting..." page while the app is not ready,
// and every other request with the empty page itself (Serve; the secret path of
// docs/plan/16-owner-list-2026-11-23.md section 4), but the two OAuth metadata addresses
// that carry the path after their well-known name, which the app answers too
// (docs/plan/17-second-owner-list-2026-11-23.md section 13.5).
//
// The front listens with HTTPS on the site's port (and for `serve --dev`): Certificates
// serves the certificate the HTTPS manager (internal/ssl) chooses, swapped without a
// restart, and Port80 answers Let's Encrypt's HTTP-01 checks while one waits, and the
// empty page to everything else meanwhile. Both are copied from xWriter's
// internal/web (tlscert.go, port80.go and the getCertificate hook of listeners.go, 07
// section 10).
package front
