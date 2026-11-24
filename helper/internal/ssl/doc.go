// Package ssl is the helper's HTTPS manager (docs/plan/07-server-install-update.md
// sections 4.1, 4.3 and 4.4, D-31): the certificate the front serves on the site's port,
// chosen in Settings > HTTPS through the control socket. It is a small rewrite of
// xWriter's internal/services/ssl on a JSON state file instead of PostgreSQL, River jobs
// and events, with the same methods, states and plain-words problems:
//
//   - Open reads /var/lib/xdesign/certs/state.json (0600) and the certificate files
//     beside it (cert.pem, key.pem), and keeps the built-in self-signed certificate
//     (internal/certs) for the methods that have no certificate yet;
//   - ServedCertificate tells the front what to serve: the certificate of the method,
//     the last good copy of certificate files that cannot be read, or the built-in one;
//   - Run issues a Let's Encrypt certificate that waits, and renews it at the time
//     Let's Encrypt's renewal information (ARI) suggests, else after two thirds of its
//     lifetime, with xWriter's backoff after failures;
//   - Choose, Upload and IssueNow are PUT /https, POST /https/certificate and POST
//     /https/issue; View is GET /https;
//   - ChallengeAnswer, ChallengesWaiting, Port80Wakeups and Port80Problem serve the
//     front's port-80 answerer while an HTTP-01 answer waits.
//
// upload.go is xmtp panel's parsing of a pasted certificate and preflight.go its domain
// preflight (07 section 10). The Let's Encrypt engine is internal/ssl/acme and the rules
// internal/ssl/domain, both copied from xWriter.
package ssl
