package install

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/ssl"
	sslcfg "github.com/Sir-MmD/xdesign/helper/internal/ssl/domain"
)

// The certificate at install (docs/plan/17-second-owner-list-2026-11-23.md section 5,
// D-644, D-645): the "HTTPS certificate" question (or --https), and the certificate step,
// which asks the running site for a Let's Encrypt certificate through the helper's control
// socket once the firewall step let port 80 in, follows its log and reports the outcome. A
// certificate that Let's Encrypt does not issue never fails the installation: the site
// serves its built-in certificate, and Settings > HTTPS keeps the method with its problem
// for "Try now".

// The values of --https.
const (
	httpsLetsEncrypt = "letsencrypt"
	httpsCloudflare  = "cloudflare"
	httpsBuiltin     = "builtin"
)

const (
	// controlTimeout bounds one question to the control socket.
	controlTimeout = 10 * time.Second
	// maxViewBody bounds what the installer reads of an answer of the control socket.
	maxViewBody = 1 << 20
	// certificateWait is how long the certificate step follows Let's Encrypt, and
	// certificatePoll how often it reads the certificate's state.
	certificateWait = 5 * time.Minute
	certificatePoll = 2 * time.Second
)

// cloudflareTokenHelp is the text before the Cloudflare API token question.
const cloudflareTokenHelp = "A token with Zone Read and DNS Edit for the domain's zone, made in Cloudflare under " +

	"My Profile > API Tokens."

// stateUnknown is the state of a certificate the site could not be asked for.
const stateUnknown = "unknown"

// httpsPlan is the certificate this run gets for the site: method is builtin,
// letsencrypt_http or letsencrypt_cloudflare, with the Cloudflare API token of the last
// one (secret); an empty method keeps the HTTPS settings the site has.
type httpsPlan struct {
	method sslcfg.Method
	token  string
}

// certOutcome is what the certificate step found: the state of the certificate as
// Settings > HTTPS has it (sslcfg.Status), or stateUnknown when the site could not be
// asked, with the problem in plain words, and the end of the certificate Let's Encrypt
// issued.
type certOutcome struct {
	state   string
	problem string
	until   time.Time
}

// CertificateResult is the site's certificate in the --json result.
type CertificateResult struct {
	// Method is builtin, letsencrypt_http or letsencrypt_cloudflare.
	Method string `json:"method"`
	// State is active (issued by Let's Encrypt, or the built-in certificate), issuing
	// (Let's Encrypt was still working after the 5 minutes the installer waits), failed
	// (Problem says why; the site serves its built-in certificate), unknown (the site could
	// not be asked; Problem says why) or planned (a dry run).
	State   string `json:"state"`
	Problem string `json:"problem,omitempty"`
}

// keptHTTPS reports whether the site keeps the HTTPS settings it has, so its certificate
// is not asked: its state file is there (a repair, a reinstall with the data an uninstall
// kept), or the backup brings it for the same domain. An unfinished installation asks
// again: its state file is the built-in one step 13 wrote, and its answer was not kept.
func (r *run) keptHTTPS() bool {
	if r.mode == ModeResume {
		return false
	}
	return exists(r.sys.FS, path.Join(r.certsDir(), ssl.StateFile)) || r.restoreCerts()
}

// letsEncryptRefusal says why Let's Encrypt cannot issue a certificate for the site's
// domain, or "": an IP address, or a name it does not take (sslcfg.ValidateNames).
func (r *run) letsEncryptRefusal() string {
	if !r.domainIsName() {
		return "Let's Encrypt needs a domain name"
	}
	if _, err := sslcfg.ValidateNames(sslcfg.MethodLetsEncryptHTTP, []string{r.cfg.Domain}); err != nil {
		return "Let's Encrypt cannot take this domain (" + strings.TrimSuffix(err.Error(), ".") + ")"
	}
	return ""
}

// port80Text says that port 80 is not free for Let's Encrypt's checks: "Another program
// (nginx) uses port 80, so Let's Encrypt cannot check this server over it".
func (r *run) port80Text() string {
	return r.heldText(httpPort) + ", so Let's Encrypt cannot check this server over it"
}

// chooseHTTPS picks the certificate of the site: with a domain name, the "HTTPS
// certificate" question when ask is set, else --https or its default, Let's Encrypt over
// port 80 when port 80 is free and the built-in certificate otherwise; with an IP address
// the built-in certificate. A site that keeps its HTTPS settings is asked nothing.
func (r *run) chooseHTTPS(ask bool) error {
	r.https = httpsPlan{}
	if r.keptHTTPS() {
		if !ask && r.opts.HTTPS != "" {
			r.noticef("the HTTPS settings are kept, so --https changes nothing; Settings > HTTPS changes them")
		}
		return nil
	}
	if refusal := r.letsEncryptRefusal(); refusal != "" {
		if !ask && r.opts.HTTPS != "" && r.opts.HTTPS != httpsBuiltin {
			return fmt.Errorf("--https %s: %s; give a domain name with --domain, or use --https builtin", r.opts.HTTPS, refusal)
		}
		r.https.method = sslcfg.MethodBuiltin
		r.noticef("%s; xDesign uses its built-in certificate.", refusal)
		return nil
	}
	if ask {
		return r.askHTTPS()
	}
	port80 := r.state.HTTPS.Port80
	switch r.opts.HTTPS {
	case httpsLetsEncrypt:
		if !port80 {
			return fmt.Errorf("--https letsencrypt: %s; use --https cloudflare or --https builtin", r.port80Text())
		}
		r.https.method = sslcfg.MethodLetsEncryptHTTP
	case httpsCloudflare:
		r.https = httpsPlan{method: sslcfg.MethodLetsEncryptCloudflare, token: r.opts.CloudflareToken}
	case httpsBuiltin:
		r.https.method = sslcfg.MethodBuiltin
	default:
		r.https.method = sslcfg.MethodLetsEncryptHTTP
		if !port80 {
			r.https.method = sslcfg.MethodBuiltin
			r.noticef("%s: xDesign uses its built-in certificate (--https cloudflare gets one through Cloudflare DNS).",
				r.port80Text())
		}
	}
	return nil
}

// askHTTPS asks the "HTTPS certificate" question, with Let's Encrypt over port 80 as the
// default when port 80 is free and through Cloudflare DNS otherwise; Cloudflare asks for
// its API token.
func (r *run) askHTTPS() error {
	port80 := r.state.HTTPS.Port80
	def := "1"
	if !port80 {
		def = "2"
	}
	o := r.out
	o.section("HTTPS certificate:")
	o.line("  1) Let's Encrypt over port 80 (free, trusted by browsers)")
	o.line("  2) Let's Encrypt through Cloudflare DNS (free, trusted, needs a Cloudflare API token)")
	o.line("  3) The built-in certificate (browsers show a warning)")
	answer, err := r.ask.ask("Choose", def, func(s string) string {
		switch s {
		case "1":
			if !port80 {
				return r.port80Text() + ". Choose 2 or 3."
			}
		case "2", "3":
		default:
			return "please answer 1, 2 or 3"
		}
		return ""
	})
	if err != nil {
		return err
	}
	switch answer {
	case "1":
		r.https.method = sslcfg.MethodLetsEncryptHTTP
	case "2":
		o.note(cloudflareTokenHelp)
		token, err := r.askToken()
		if err != nil {
			return err
		}
		r.https = httpsPlan{method: sslcfg.MethodLetsEncryptCloudflare, token: token}
	default:
		r.https.method = sslcfg.MethodBuiltin
	}
	return nil
}

// askToken asks for the Cloudflare API token without showing what is typed, until it has
// the form Settings > HTTPS takes; the log and the output mask it.
func (r *run) askToken() (string, error) {
	for {
		token, err := r.ask.secret("Cloudflare API token:", r.in.EchoOff)
		if err != nil {
			return "", err
		}
		if problem := tokenProblem(token); problem != "" {
			r.out.errorf("%s", problem)
			continue
		}
		r.env.Masker().Add(token)
		return token, nil
	}
}

// tokenProblem says why token cannot be a Cloudflare API token, as Settings > HTTPS checks
// it (ssl.ValidToken), or "".
func tokenProblem(token string) string {
	switch {
	case token == "":
		return "give the Cloudflare API token"
	case !ssl.ValidToken(token):
		return "that is not a Cloudflare API token: it has at most 200 printable characters and no spaces; copy it " +
			"again from Cloudflare (My Profile > API Tokens)"
	}
	return ""
}

// stepCertificate is step 16, when the owner chose Let's Encrypt: the running site asks
// for the certificate (PUT /https on the control socket, once the firewall step let port
// 80 in), and the installer follows its log for up to 5 minutes and reports the outcome,
// which the end block shows. It never fails the installation (D-645).
func (r *run) stepCertificate() Step {
	return Step{
		Num: "16", ID: "certificate", Title: "HTTPS certificate",
		Check: func(context.Context, *Env) (string, error) {
			if !r.https.method.LetsEncrypt() {
				return "no Let's Encrypt certificate to get", nil
			}
			return "", nil
		},
		Act:    r.getCertificate,
		Verify: func(context.Context, *Env) error { return nil }, // the outcome is reported, not checked
	}
}

// getCertificate asks the site for the Let's Encrypt certificate of r.https and follows
// it: every 2 seconds it reads GET /https, shows each new line of the certificate's log,
// and stops once Let's Encrypt issued it or failed, or after 5 minutes. Only Ctrl+C stops
// it with an error.
func (r *run) getCertificate(ctx context.Context, env *Env) error {
	choice := ssl.Choice{Method: r.https.method, Names: []string{r.cfg.Domain}, CloudflareToken: r.https.token}
	if env.DryRun {
		env.Plan(fmt.Sprintf("PUT /https on %s: %s; then read GET /https every 2 s for up to 5 minutes and report "+
			"the certificate", controlName, r.httpsText()))
		return nil
	}
	client, err := controlClient()
	if err != nil {
		return r.notAsked(env, err)
	}
	w := env.waiting(ctx, "asking the site for the certificate")
	defer w.stop()
	r.log.Printf("PUT /https: %s for %s", choice.Method, r.cfg.Domain)
	v, err := siteHTTPS(ctx, client, &choice)
	if refused, ok := errors.AsType[*siteError](err); ok && refused.status == http.StatusConflict {
		// Let's Encrypt works on the certificate already (an earlier run asked): follow it.
		r.log.Printf("PUT /https: %s", refused.text)
		v, err = siteHTTPS(ctx, client, nil)
	}
	if err != nil {
		return r.notAsked(env, err)
	}
	seen := map[string]bool{}
	deadline := time.Now().Add(certificateWait)
	for {
		for _, e := range v.Log {
			key := e.At.Format(time.RFC3339Nano) + " " + e.Text
			if seen[key] {
				continue
			}
			seen[key] = true
			env.Notef("%s", e.Text)
			w.say(e.Text)
		}
		if v.Method != choice.Method || !v.State.Busy() || !time.Now().Before(deadline) {
			break
		}
		select {
		case <-ctx.Done():
			return errors.New("interrupted while waiting for Let's Encrypt; the site keeps asking, and Settings > HTTPS " +
				"shows how it goes")
		case <-time.After(certificatePoll):
		}
		next, err := siteHTTPS(ctx, client, nil)
		if err != nil {
			r.log.Printf("follow the certificate: %v", err)
			continue
		}
		v = next
	}
	r.reportCertificate(env, v)
	return nil
}

// reportCertificate keeps what the site's view v says of the certificate for the end
// block and --json, and says it under the step.
func (r *run) reportCertificate(env *Env, v ssl.View) {
	r.certificate = certOutcome{state: string(v.State)}
	switch {
	case v.Method != r.https.method:
		r.certificate = certOutcome{state: stateUnknown, problem: "Settings > HTTPS chose another method meanwhile"}
		env.Notef("Settings > HTTPS chose another method meanwhile; it shows the certificate.")
	case v.State == sslcfg.StatusActive:
		r.certificate.until = v.ExpiresAt
		env.Notef("Certificate issued by Let's Encrypt, valid until %s.", sslcfg.FormatDate(v.ExpiresAt))
	case v.State.Busy():
		env.Notef("Let's Encrypt is still working; see Settings > HTTPS.")
	default:
		r.certificate.problem = strings.TrimSuffix(orText(v.LastProblem, "Settings > HTTPS shows why"), ".")
		env.Warnf("Let's Encrypt could not issue the certificate: %s. xDesign uses its built-in certificate for now; "+
			"after fixing it, press Try now in Settings > HTTPS.", r.certificate.problem)
	}
}

// notAsked reports that the site could not be asked for the certificate: it keeps its
// built-in certificate, and Settings > HTTPS can choose Let's Encrypt later.
func (r *run) notAsked(env *Env, err error) error {
	r.certificate = certOutcome{state: stateUnknown, problem: err.Error()}
	text := fmt.Sprintf("the site could not be asked for the certificate (%v).", err)
	if refused, ok := errors.AsType[*siteError](err); ok {
		text = "the site refused the request for the certificate: " + refused.text
	}
	env.Warnf("%s xDesign uses its built-in certificate for now; choose Let's Encrypt in Settings > HTTPS.", text)
	return nil
}

// certificateText is the HTTPS line of the end block: the certificate the site serves.
func (r *run) certificateText() string {
	c := r.certificate
	switch {
	case !r.https.method.LetsEncrypt():
		return "the built-in certificate (browsers show a warning)"
	case c.state == string(sslcfg.StatusActive):
		return "a certificate from Let's Encrypt, valid until " + sslcfg.FormatDate(c.until)
	case sslcfg.Status(c.state).Busy():
		return "the built-in certificate while Let's Encrypt works (Settings > HTTPS shows how it goes)"
	case c.state == stateUnknown:
		return "the built-in certificate (Settings > HTTPS chooses another)"
	}
	return "the built-in certificate: Let's Encrypt did not issue one (Settings > HTTPS says why and has Try now)"
}

// certificateResult is the certificate of the --json result; nil when the site keeps its
// HTTPS settings.
func (r *run) certificateResult() *CertificateResult {
	m := r.https.method
	switch {
	case m == "":
		return nil
	case r.opts.DryRun:
		return &CertificateResult{Method: string(m), State: "planned"}
	case !m.LetsEncrypt():
		return &CertificateResult{Method: string(m), State: string(sslcfg.StatusActive)}
	}
	return &CertificateResult{Method: string(m), State: orText(r.certificate.state, stateUnknown), Problem: r.certificate.problem}
}

// siteError is a refusal of the site's control socket: the HTTP status and the site's
// words.
type siteError struct {
	status int
	text   string
}

func (e *siteError) Error() string { return e.text }

// siteHTTPS asks the site's HTTPS manager on the control socket: GET /https, or PUT /https
// with choice, and returns the view it answers. A refusal (400, 409) is a *siteError with
// the site's words.
func siteHTTPS(ctx context.Context, client *http.Client, choice *ssl.Choice) (ssl.View, error) {
	ctx, cancel := context.WithTimeout(ctx, controlTimeout)
	defer cancel()
	method, body := http.MethodGet, []byte(nil)
	if choice != nil {
		var err error
		if body, err = json.Marshal(choice); err != nil {
			return ssl.View{}, fmt.Errorf("PUT /https: %w", err)
		}
		method = http.MethodPut
	}
	what := method + " /https"
	req, err := http.NewRequestWithContext(ctx, method, "http://xdesign/https", bytes.NewReader(body))
	if err != nil {
		return ssl.View{}, fmt.Errorf("%s: %w", what, err)
	}
	if choice != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := client.Do(req)
	if err != nil {
		return ssl.View{}, fmt.Errorf("%s: %w", what, err)
	}
	defer func() { _ = resp.Body.Close() }() // read to its end below
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxViewBody))
	if err != nil {
		return ssl.View{}, fmt.Errorf("%s: %w", what, err)
	}
	if resp.StatusCode != http.StatusOK {
		var refusal struct {
			Error string `json:"error"`
		}
		if json.Unmarshal(data, &refusal) == nil && refusal.Error != "" {
			return ssl.View{}, &siteError{status: resp.StatusCode, text: refusal.Error}
		}
		return ssl.View{}, fmt.Errorf("%s: HTTP %d", what, resp.StatusCode)
	}
	var v ssl.View
	if err := json.Unmarshal(data, &v); err != nil {
		return ssl.View{}, fmt.Errorf("%s: %w", what, err)
	}
	return v, nil
}
