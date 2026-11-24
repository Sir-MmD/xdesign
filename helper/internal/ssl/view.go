package ssl

import (
	"slices"
	"time"

	sslcfg "github.com/Sir-MmD/xdesign/helper/internal/ssl/domain"
)

// View is what Settings > HTTPS shows of the certificate (GET /https, and the answer of
// the requests that change it). The Cloudflare token and the keys never appear in it.
type View struct {
	// Mode is port (xDesign serves HTTPS itself on the port of the config file), or dev;
	// the control socket sets it.
	Mode string `json:"mode"`
	// Method is the method in use.
	Method sslcfg.Method `json:"method"`
	// Names are the names of a Let's Encrypt certificate, else those of the certificate
	// served.
	Names []string `json:"names"`
	// State is the state of the method's certificate (sslcfg.Status).
	State sslcfg.Status `json:"state"`
	// ExpiresAt is when the certificate served now expires.
	ExpiresAt time.Time `json:"expires_at"`
	// RenewAt is when a Let's Encrypt certificate renews; NextAttemptAt when the next
	// try after failures runs, Failures how many failed in a row.
	RenewAt       time.Time `json:"renew_at,omitzero"`
	NextAttemptAt time.Time `json:"next_attempt_at,omitzero"`
	Failures      int       `json:"failures"`
	// RenewalExplanationURL is Let's Encrypt's page about an early renewal window.
	RenewalExplanationURL string `json:"renewal_explanation_url,omitempty"`
	// LastProblem is why the last issuance, renewal or read of the files failed, in plain
	// words; empty once one succeeded.
	LastProblem   string    `json:"last_problem,omitempty"`
	LastProblemAt time.Time `json:"last_problem_at,omitzero"`
	// CloudflareTokenSet reports that a Cloudflare token is saved.
	CloudflareTokenSet bool `json:"cloudflare_token_set"`
	// CertFile and KeyFile are the paths of the file method.
	CertFile string `json:"cert_file,omitempty"`
	KeyFile  string `json:"key_file,omitempty"`
	// Certificate describes the certificate served now.
	Certificate ServedView `json:"certificate"`
	// Log is the log of the last (or running) issuance or renewal.
	Log []sslcfg.LogEntry `json:"log"`
	// LeftOut lists what xDesign left out of a pasted bundle; only in the answer of POST
	// /https/certificate.
	LeftOut []DroppedCert `json:"left_out,omitempty"`
}

// ServedView describes the certificate served now.
type ServedView struct {
	// Method is how it was obtained: builtin for the built-in one.
	Method      sslcfg.Method `json:"method"`
	Name        string        `json:"name"`
	Subject     string        `json:"subject"`
	Issuer      string        `json:"issuer"`
	Names       []string      `json:"names"`
	NotBefore   time.Time     `json:"not_before"`
	NotAfter    time.Time     `json:"not_after"`
	Fingerprint string        `json:"fingerprint_sha256"`
	// SelfSigned and Trusted say whether browsers warn: a self-signed certificate, or one
	// not signed by an authority this server trusts.
	SelfSigned bool `json:"self_signed"`
	Trusted    bool `json:"trusted"`
	// Problem says why the certificate of the method is not served as it is.
	Problem string `json:"problem,omitempty"`
}

// View returns what Settings > HTTPS shows.
func (m *Manager) View() View {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.viewLocked()
}

// viewLocked builds the View. The caller holds m.mu.
func (m *Manager) viewLocked() View {
	st := &m.st
	v := View{Method: st.Method, Names: slices.Clone(st.Names), State: st.Status, Failures: st.Failures,
		NextAttemptAt: st.NextAttemptAt, LastProblem: st.LastProblem, LastProblemAt: st.LastProblemAt,
		CloudflareTokenSet: st.CloudflareToken != "", CertFile: st.CertPath, KeyFile: st.KeyPath, Log: slices.Clone(st.Log)}
	if m.run != nil {
		v.Log = m.run.entries()
	}
	if v.Log == nil {
		v.Log = []sslcfg.LogEntry{}
	}
	if st.Method.LetsEncrypt() && st.FromLetsEncrypt {
		v.RenewAt = m.renewAtLocked()
		if st.ARI != nil {
			v.RenewalExplanationURL = st.ARI.ExplanationURL
		}
	}
	served, err := m.servedLocked(m.now(), false)
	if err != nil {
		v.Certificate.Problem = err.Error()
	} else {
		info := served.Pair.Info
		v.Certificate = ServedView{Method: served.Method, Name: served.Name, Subject: info.Subject, Issuer: info.Issuer,
			Names: info.SANs(), NotBefore: info.NotBefore, NotAfter: info.NotAfter, Fingerprint: info.Fingerprint,
			SelfSigned: info.SelfSigned, Trusted: info.Trusted, Problem: served.Problem}
		v.ExpiresAt = info.NotAfter
	}
	if !st.Method.LetsEncrypt() {
		v.Names = v.Certificate.Names
	}
	if v.Names == nil {
		v.Names = []string{}
	}
	return v
}
