package install

import (
	"bufio"
	"context"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"net"
	"net/netip"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/ssl"
	sslcfg "github.com/Sir-MmD/xdesign/helper/internal/ssl/domain"
)

// ownerPlan is the site owner the installer makes (section 3 step 6): app/cli.mjs
// init-owner gets them and prints the generated password.
type ownerPlan struct {
	Username, Name string
}

// Generated values: the random port and web base path of the site (as xWriter's installer
// picks its panel's), and the random names of staging folders.
const (
	portMin       = 20000
	portMax       = 60999
	portTries     = 100
	basePathLen   = 16
	basePathChars = "abcdefghijklmnopqrstuvwxyz0123456789"
)

// dnsTimeout bounds the lookup of the domain.
const dnsTimeout = 10 * time.Second

// RandomFreePort picks a random port in 20000 to 60999 that listen:port can bind.
func RandomFreePort(ctx context.Context, m host.Machine, rnd io.Reader, listen string) (int, error) {
	for range portTries {
		n, err := randomInt(rnd, portMax-portMin+1)
		if err != nil {
			return 0, err
		}
		port := portMin + n
		if m.ProbePort(ctx, listen, port) == nil {
			return port, nil
		}
	}
	return 0, fmt.Errorf("found no free port between %d and %d; give one with --port", portMin, portMax)
}

// RandomBasePath returns a web base path of 16 random characters of [a-z0-9]:
// "/k3v9x2m1q8wz7r4t/" (xWriter's).
func RandomBasePath(rnd io.Reader) (string, error) {
	s, err := randomString(rnd, basePathChars, basePathLen)
	if err != nil {
		return "", err
	}
	return "/" + s + "/", nil
}

// randomInt returns a uniform random number in [0, n) read from rnd.
func randomInt(rnd io.Reader, n int) (int, error) {
	if n <= 0 || uint64(n) > 1<<32 {
		return 0, fmt.Errorf("random number below %d: out of range", n)
	}
	limit := (uint64(1) << 32) - (uint64(1)<<32)%uint64(n)
	var b [4]byte
	for {
		if _, err := io.ReadFull(rnd, b[:]); err != nil {
			return 0, fmt.Errorf("random number: %w", err)
		}
		if v := uint64(binary.BigEndian.Uint32(b[:])); v < limit {
			return int(v % uint64(n)), nil //nolint:gosec // G115: the value is below n, an int
		}
	}
}

// randomString returns n characters drawn uniformly from alphabet.
func randomString(rnd io.Reader, alphabet string, n int) (string, error) {
	var b strings.Builder
	for range n {
		i, err := randomInt(rnd, len(alphabet))
		if err != nil {
			return "", err
		}
		b.WriteByte(alphabet[i])
	}
	return b.String(), nil
}

// prompter asks the questions of section 3 in pacman's style: ":: Proceed with
// installation? [Y/n] ", ":: Site port [34567]: ".
type prompter struct {
	in  *bufio.Reader
	out *printer
}

// errNoAnswer is returned when standard input ends before an answer.
var errNoAnswer = errors.New("no answer: standard input ended. Run the installer with --yes and --owner-name " +
	"to install without questions")

func (p *prompter) line() (string, error) {
	s, err := p.in.ReadString('\n')
	if err != nil && (!errors.Is(err, io.EOF) || s == "") {
		if errors.Is(err, io.EOF) {
			return "", errNoAnswer
		}
		return "", fmt.Errorf("read the answer: %w", err)
	}
	return strings.TrimSpace(s), nil
}

// ask asks for a value; an empty answer takes def. valid returns why an answer is
// not accepted ("" when it is), and the question is asked again.
func (p *prompter) ask(label, def string, valid func(string) string) (string, error) {
	for {
		p.out.prompt(fmt.Sprintf("%s [%s]:", label, def))
		ans, err := p.line()
		if err != nil {
			return "", err
		}
		if ans == "" {
			ans = def
		}
		if problem := valid(ans); problem != "" {
			p.out.errorf("%s", problem)
			continue
		}
		return ans, nil
	}
}

// text asks a question without a default (":: Owner name: "); valid returns why an
// answer is not accepted ("" when it is), and the question is asked again.
func (p *prompter) text(label string, valid func(string) string) (string, error) {
	for {
		p.out.prompt(label)
		ans, err := p.line()
		if err != nil {
			return "", err
		}
		if problem := valid(ans); problem != "" {
			p.out.errorf("%s", problem)
			continue
		}
		return ans, nil
	}
}

// confirm asks a yes or no question; an empty answer takes def.
func (p *prompter) confirm(question string, def bool) (bool, error) {
	hint := "[y/N]"
	if def {
		hint = "[Y/n]"
	}
	for {
		p.out.prompt(question + " " + hint)
		ans, err := p.line()
		if err != nil {
			return false, err
		}
		switch strings.ToLower(ans) {
		case "":
			return def, nil
		case "y", "yes":
			return true, nil
		case "n", "no":
			return false, nil
		}
		p.out.errorf("please answer y or n")
	}
}

// secret asks for a secret without a default: echoOff, when set, keeps the terminal from
// showing what is typed (a token), and the line break the owner typed is printed
// afterwards (xWriter's).
func (p *prompter) secret(label string, echoOff func() (func(), error)) (string, error) {
	p.out.prompt(label)
	if echoOff != nil {
		if restore, err := echoOff(); err == nil {
			defer func() {
				restore()
				p.out.line("")
			}()
		}
	}
	return p.line()
}

// questions asks the questions of section 3, after the facts of `:: Checking this
// server...`: the backup to restore, the domain, the port, the web base path, the HTTPS
// certificate and the owner; then the summary and ":: Proceed with installation?". A
// site that keeps its config.toml is not asked its domain, port and path, one that keeps
// its HTTPS settings not its certificate, and one that has its owner not the owner's
// questions.
func (r *run) questions(ctx context.Context) error {
	if r.mode == ModeRepair {
		ok, err := r.ask.confirm("Proceed with repair?", true)
		if err != nil {
			return err
		}
		if !ok {
			return errAborted
		}
		if r.ownerUsername == "" {
			return r.askOwner() // used only when the site lost its owner
		}
		return nil
	}
	if err := r.askRestore(); err != nil {
		return err
	}
	if !r.keptConfig {
		if err := r.askDomain(ctx); err != nil {
			return err
		}
		if err := r.chooseSite(ctx, true); err != nil {
			return err
		}
	}
	if err := r.chooseHTTPS(true); err != nil {
		return err
	}
	if err := r.askSystem(ctx, true); err != nil {
		return err
	}
	if r.ownerUsername == "" && r.restore.file == "" { // a backup brings its owner
		if err := r.askOwner(); err != nil {
			return err
		}
	}
	r.printSummary()
	ok, err := r.ask.confirm("Proceed with installation?", true)
	if err != nil {
		return err
	}
	if !ok {
		return errAborted
	}
	return nil
}

// askDomain asks for the site's domain (section 3 step 3).
func (r *run) askDomain(ctx context.Context) error {
	answer, err := r.ask.text("Domain for xDesign (for example design.example.com), or leave empty to use this server's IP address:",
		func(s string) string {
			if s == "" || validHost(s) {
				return ""
			}
			return "give a domain such as design.example.com, or leave it empty"
		})
	if err != nil {
		return err
	}
	return r.setDomain(ctx, answer)
}

// setDomain sets the site's domain: the one given, with the check that it points to this
// server (a warning when it does not), or else this server's public IP address, which
// config.toml then holds (GO-02).
func (r *run) setDomain(ctx context.Context, domain string) error {
	domain = strings.TrimSuffix(strings.ToLower(strings.TrimSpace(domain)), ".")
	if domain != "" {
		r.cfg.Domain = domain
		if a, err := netip.ParseAddr(domain); err == nil {
			r.cfg.Domain = a.Unmap().String()
			return nil
		}
		fact, problem := r.checkDomainDNS(ctx, domain)
		switch {
		case problem != "":
			r.warningf("%s", problem)
		case fact != "":
			r.noticef("%s", fact)
		}
		return nil
	}
	addr, note := r.publicAddr()
	if !addr.IsValid() {
		return errors.New("this server has no global IP address to open the site at; give its domain")
	}
	r.cfg.Domain = addr.String()
	if note != "" {
		r.warningf("%s", note)
	} else {
		r.noticef("the site opens at this server's address, %s", addr)
	}
	return nil
}

// publicAddr picks this server's address for a site without a domain: its first public
// IPv4 address, else its first public IPv6 one, else its first private one (a server
// behind NAT), which note says.
func (r *run) publicAddr() (netip.Addr, string) {
	addrs := r.serverAddrs()
	for _, public := range []func(netip.Addr) bool{
		func(a netip.Addr) bool { return a.Is4() && !a.IsPrivate() },
		func(a netip.Addr) bool { return !a.IsPrivate() },
	} {
		if i := slices.IndexFunc(addrs, public); i >= 0 {
			return addrs[i], ""
		}
	}
	if len(addrs) == 0 {
		return netip.Addr{}, ""
	}
	return addrs[0], fmt.Sprintf("this server has only private addresses, so the site opens at %s: whatever is in front of it must "+
		"forward the site's port here, or give a domain later", addrs[0])
}

// serverAddrs returns the addresses of this server's network interfaces.
func (r *run) serverAddrs() []netip.Addr {
	addrs, err := r.sys.Machine.GlobalAddrs()
	if err != nil {
		r.log.Printf("network addresses: %v", err)
	}
	return addrs
}

// checkDomainDNS checks that domain points to this server: one of its addresses in the DNS
// must be one of this server's. A server with only private addresses may sit behind NAT,
// so a domain that points elsewhere is noted then, not a problem.
func (r *run) checkDomainDNS(ctx context.Context, domain string) (fact, problem string) {
	if r.in.LookupIP == nil {
		return "", ""
	}
	lctx, cancel := context.WithTimeout(ctx, dnsTimeout)
	defer cancel()
	found, err := r.in.LookupIP(lctx, domain)
	own := r.serverAddrs()
	dnsErr := (*net.DNSError)(nil)
	if (errors.As(err, &dnsErr) && dnsErr.IsNotFound) || (err == nil && len(found) == 0) {
		return "", fmt.Sprintf("%s has no address in the DNS yet: point its DNS record to this server (%s) and give it time to "+
			"spread; the site opens at the domain once it does.", domain, orText(joinAddrs(own), "its public address"))
	}
	if err != nil {
		return "", fmt.Sprintf("the DNS lookup of %s failed (%v), so the installer cannot tell whether it points to this server.", domain, err)
	}
	for _, a := range found {
		if slices.Contains(own, a.Unmap()) {
			return fmt.Sprintf("%s points to this server (%s)", domain, a.Unmap()), ""
		}
	}
	public := slices.DeleteFunc(slices.Clone(own), func(a netip.Addr) bool { return a.IsPrivate() || a.IsLoopback() })
	if len(public) == 0 {
		return fmt.Sprintf("%s points to %s; this server has only private addresses, so that address must forward the site's port here",
			domain, joinAddrs(found)), ""
	}
	return "", fmt.Sprintf("%s points to %s, not to this server (%s). Set the domain's DNS record to %s and give it time to spread.",
		domain, joinAddrs(found), joinAddrs(public), public[0])
}

// joinAddrs joins addresses with commas.
func joinAddrs(addrs []netip.Addr) string {
	parts := make([]string, len(addrs))
	for i, a := range addrs {
		parts[i] = a.Unmap().String()
	}
	return strings.Join(parts, ", ")
}

// orText returns s, or fallback when s is empty.
func orText(s, fallback string) string {
	if s == "" {
		return fallback
	}
	return s
}

// joinAnd joins words as "a, b and c".
func joinAnd(words []string) string {
	if len(words) < 2 {
		return strings.Join(words, "")
	}
	return strings.Join(words[:len(words)-1], ", ") + " and " + words[len(words)-1]
}

// askOwner asks "Owner username [owner]:" and "Owner name:" (section 3 step 6,
// docs/plan/18-third-owner-list-2026-11-23.md section 3.7), checked as the app checks
// them.
func (r *run) askOwner() error {
	username, err := r.ask.ask("Owner username", defaultOwnerUsername, usernameProblem)
	if err != nil {
		return err
	}
	name, err := r.ask.text("Owner name:", nameProblem)
	if err != nil {
		return err
	}
	r.owner = ownerPlan{Username: normalUsername(username), Name: strings.TrimSpace(name)}
	return nil
}

// printSummary shows what this run does before the last question: a fact for each part.
func (r *run) printSummary() {
	o := r.out
	o.line("")
	o.fact("program", fmt.Sprintf("xDesign %s in %s, running as %s", r.version, optDir, runsAs))
	if r.keptConfig {
		o.fact("settings", "kept from "+configPath)
	}
	o.fact("address", r.cfg.PublicURL())
	o.fact("HTTPS", r.httpsText())
	if len(r.openPorts) > 0 {
		o.fact("firewall", fmt.Sprintf("opens %s in %s", portsText(r.openPorts), r.firewall.name()))
	}
	r.restoreFacts()
	switch {
	case r.ownerUsername != "":
		o.fact("owner", "username "+r.ownerUsername+" (the site has its owner)")
	case r.restore.file != "":
		o.fact("owner", "the backup's site owner")
	default:
		o.fact("owner", fmt.Sprintf("%s, username %s, with a password made now and shown at the end", r.owner.Name, r.owner.Username))
	}
	o.line("")
}

// httpsText says in plain words which certificate the site gets (chooseHTTPS), or that it
// keeps its HTTPS settings: the HTTPS fact of the summary.
func (r *run) httpsText() string {
	switch r.https.method {
	case sslcfg.MethodLetsEncryptHTTP:
		return "Let's Encrypt over port 80 for " + r.cfg.Domain
	case sslcfg.MethodLetsEncryptCloudflare:
		return "Let's Encrypt through Cloudflare DNS for " + r.cfg.Domain
	case sslcfg.MethodBuiltin:
		return "the built-in certificate"
	case sslcfg.MethodUploaded, sslcfg.MethodFile:
	}
	switch {
	case exists(r.sys.FS, filepath.Join(r.certsDir(), ssl.StateFile)):
		return "the HTTPS settings are kept"
	case r.restoreCerts():
		return "the HTTPS settings of the backup"
	}
	return "the built-in certificate until Settings > HTTPS chooses another" // a repair that lost them
}

// listenPort is the port of a listen address (":443").
func listenPort(listen string) string {
	_, port, err := net.SplitHostPort(listen)
	if err != nil {
		return listen
	}
	return port
}

// noticef prints a note among the questions and logs it; --json prints nothing.
func (r *run) noticef(format string, args ...any) {
	r.log.Printf("note: "+format, args...)
	if !r.opts.JSON {
		r.out.note(fmt.Sprintf(format, args...))
	}
}

// warningf prints a warning among the questions and logs it; --json prints nothing.
func (r *run) warningf(format string, args ...any) {
	r.log.Printf("warning: "+format, args...)
	if !r.opts.JSON {
		r.out.warn(fmt.Sprintf(format, args...))
	}
}
