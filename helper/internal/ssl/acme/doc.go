// Package acme gets Let's Encrypt certificates for the HTTPS manager
// (docs/plan/07-server-install-update.md section 4.1) with lego
// (github.com/go-acme/lego/v5), which only this package imports (a depguard rule):
//
//   - Engine.Issue registers the account of a directory when it has none yet (ECDSA
//     P-256, accepting the Subscriber Agreement), keeps its email current, and orders a
//     certificate with a new ECDSA P-256 key, answering HTTP-01 through the caller's
//     HTTPSolver (the front's port-80 answerer) or DNS-01 through Cloudflare with the
//     certificate's token; a renewal names the certificate it replaces (RFC 9773);
//   - Engine.RenewalInfo reads the renewal window the CA suggests (ARI);
//   - Explain turns a failure into xWriter's plain-words causes (domain.Problem).
//
// Every call takes the HTTP client to use; the DNS-01 checks ask 1.1.1.1 and 8.8.8.8
// directly. lego logs through one process-wide logger and reads one process-wide DNS
// client: New installs both, so a process has one Engine, which runs one issuance at a
// time and hands lego's records, redacted (Redact), to the issuance that runs.
//
// Copied from xWriter's internal/ssl/acme (07 section 10) with a small Redact in place
// of xWriter's secrets package and a time function in place of its clock.
package acme
