package domain

import (
	"slices"
	"time"
)

// Method is how the certificate of Settings > HTTPS is obtained
// (docs/plan/07-server-install-update.md section 4.1); the values are those of the state
// file's method.
type Method string

// The methods.
const (
	// MethodBuiltin is the built-in self-signed certificate, the default without a domain.
	MethodBuiltin Method = "builtin"
	// MethodLetsEncryptHTTP is Let's Encrypt over port 80 (HTTP-01); it renews itself.
	MethodLetsEncryptHTTP Method = "letsencrypt_http"
	// MethodLetsEncryptCloudflare is Let's Encrypt through Cloudflare (DNS-01 with an API
	// token): wildcards, no open port; it renews itself.
	MethodLetsEncryptCloudflare Method = "letsencrypt_cloudflare"
	// MethodUploaded is a certificate the owner pasted or uploaded.
	MethodUploaded Method = "uploaded"
	// MethodFile is certificate files on the server (for example certbot's), read every
	// minute.
	MethodFile Method = "file"
)

// Methods returns every method, in the order Settings > HTTPS lists them.
func Methods() []Method {
	return []Method{MethodBuiltin, MethodLetsEncryptHTTP, MethodLetsEncryptCloudflare, MethodUploaded, MethodFile}
}

// Valid reports whether m is a method of the list.
func (m Method) Valid() bool {
	return slices.Contains(Methods(), m)
}

// LetsEncrypt reports whether certificates of method m come from Let's Encrypt and renew
// themselves.
func (m Method) LetsEncrypt() bool {
	return m == MethodLetsEncryptHTTP || m == MethodLetsEncryptCloudflare
}

// Status is the state of the certificate; the values are those of the state file's
// status.
type Status string

// The states, xWriter's. A first issuance goes issuing to active or failed; a renewal goes
// renewing to active, and a failed renewal back to active (or expired) with its failures
// counted.
const (
	StatusIssuing  Status = "issuing"
	StatusActive   Status = "active"
	StatusRenewing Status = "renewing"
	StatusFailed   Status = "failed"
	StatusExpired  Status = "expired"
	// StatusUnreadable is a file certificate whose files cannot be read; its last good
	// copy is served while valid.
	StatusUnreadable Status = "unreadable"
)

// Statuses returns every state.
func Statuses() []Status {
	return []Status{StatusIssuing, StatusActive, StatusRenewing, StatusFailed, StatusExpired, StatusUnreadable}
}

// Valid reports whether s is a state of the list.
func (s Status) Valid() bool {
	return slices.Contains(Statuses(), s)
}

// Busy reports whether Let's Encrypt is working on the certificate: a first issuance or
// a renewal runs.
func (s Status) Busy() bool {
	return s == StatusIssuing || s == StatusRenewing
}

// Registration is what xDesign keeps of its account at an ACME directory, in the state
// file beside the account key.
type Registration struct {
	// URI is the account's URL at the directory, its key ID in signed requests; empty
	// until the account is registered.
	URI string `json:"uri,omitempty"`
	// Status is the account's status at the directory: valid, deactivated or revoked.
	Status string `json:"status,omitempty"`
	// Contact lists the account's contacts, such as "mailto:owner@example.com".
	Contact []string `json:"contact,omitempty"`
	// TermsOfService is the address of the Subscriber Agreement the registration
	// accepted, as the directory named it.
	TermsOfService string `json:"terms_of_service,omitempty"`
	// AgreedAt is when the registration accepted it.
	AgreedAt time.Time `json:"agreed_at,omitzero"`
}

// Registered reports whether the account exists at its directory.
func (r Registration) Registered() bool {
	return r.URI != ""
}
