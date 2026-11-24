package install

import (
	"errors"
	"fmt"
	"net/netip"
	"path"
	"regexp"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/config"
)

// Options are the flags of `xdesign --install` (docs/plan/07-server-install-update.md
// section 3). The zero value installs interactively.
type Options struct {
	// Yes answers every question with its default (non-interactive): the backup question
	// with no, the domain with Domain or this server's IP address, the port and the web
	// base path with Port and BasePath or random ones, the owner with OwnerUsername (or
	// "owner") and OwnerName.
	Yes bool
	// JSON writes progress as JSON lines to standard error and one result object to
	// standard output. It needs Yes.
	JSON bool
	// DryRun prints the plan and every command without changing anything.
	DryRun bool
	// Domain is the site's domain; "" takes this server's IP address.
	Domain string
	// Port serves HTTPS on this port; 0 takes a random free port from 20000 to 60999.
	Port int
	// BasePath is the web base path the site answers under; "" takes a random one of 16
	// characters.
	BasePath string
	// OwnerUsername and OwnerName are the site owner's, for --yes; "" takes the username
	// "owner" (docs/plan/18-third-owner-list-2026-11-23.md section 3.7).
	OwnerUsername, OwnerName string
	// HTTPS is the certificate of a site with a domain name, for --yes
	// (docs/plan/17-second-owner-list-2026-11-23.md section 5): letsencrypt (over port 80),
	// cloudflare (Let's Encrypt through Cloudflare DNS, with CloudflareToken) or builtin;
	// "" takes Let's Encrypt over port 80 when port 80 is free, else the built-in one.
	HTTPS string
	// CloudflareToken is the Cloudflare API token of --https cloudflare; secret.
	CloudflareToken string
	// LogPath is the install log; "" means [DefaultLogPath].
	LogPath string
	// NoColor turns the colors of the output off, like NO_COLOR (UseColor).
	NoColor bool
}

// ErrUsage marks invalid options; the command exits with status 2.
var ErrUsage = errors.New("usage")

// hostnameRE accepts DNS names; IP addresses are checked separately.
var hostnameRE = regexp.MustCompile(`^(?i)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.?$`)

// usernameRE is the app's check of a username (packages/api common.ts): letters a to z,
// digits, dots, underscores and hyphens, starting with a letter or a digit.
var usernameRE = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]*$`)

// The app's limits of an owner's username and name (packages/api common.ts).
const (
	minUsername = 3
	maxUsername = 32
	maxName     = 100
)

// defaultOwnerUsername is the owner's username when the question or --owner-username is
// left empty (docs/plan/18-third-owner-list-2026-11-23.md section 3.7).
const defaultOwnerUsername = "owner"

// Validate checks the options on their own, before anything is detected.
func (o Options) Validate() error {
	var problems []string
	add := func(format string, args ...any) { problems = append(problems, fmt.Sprintf(format, args...)) }
	if o.JSON && !o.Yes && !o.DryRun {
		add("--json needs --yes: questions cannot be asked while the output is JSON")
	}
	if o.Domain != "" && !validHost(o.Domain) {
		add("--domain %q is not a domain such as design.example.com", o.Domain)
	}
	if o.Port != 0 && (o.Port < 1 || o.Port > 65535 || o.Port == httpPort) {
		add("--port %d is not a port that can serve HTTPS (1 to 65535, not 80)", o.Port)
	}
	if o.BasePath != "" {
		if err := config.CheckBasePath(o.BasePath); err != nil {
			add("--base-path %v", err)
		}
	}
	if o.OwnerUsername != "" {
		if problem := usernameProblem(o.OwnerUsername); problem != "" {
			add("--owner-username %q: %s", o.OwnerUsername, problem)
		}
	}
	if o.OwnerName != "" {
		if problem := nameProblem(o.OwnerName); problem != "" {
			add("--owner-name: %s", problem)
		}
	}
	if o.OwnerUsername != "" && o.OwnerName == "" {
		add("--owner-username needs --owner-name")
	}
	switch o.HTTPS {
	case "", httpsLetsEncrypt, httpsCloudflare, httpsBuiltin:
	default:
		add("--https %q is not one of letsencrypt, cloudflare or builtin", o.HTTPS)
	}
	switch {
	case o.HTTPS == httpsCloudflare && o.CloudflareToken == "":
		add("--https cloudflare needs --cloudflare-token")
	case o.CloudflareToken != "" && o.HTTPS != httpsCloudflare:
		add("--cloudflare-token goes with --https cloudflare")
	case o.CloudflareToken != "":
		if problem := tokenProblem(o.CloudflareToken); problem != "" {
			add("--cloudflare-token: %s", problem)
		}
	}
	if o.LogPath != "" && !path.IsAbs(o.LogPath) {
		add("--log %q must be an absolute path", o.LogPath)
	}
	if len(problems) > 0 {
		return fmt.Errorf("%w: %s", ErrUsage, strings.Join(problems, "; "))
	}
	return nil
}

func validHost(h string) bool {
	if _, err := netip.ParseAddr(h); err == nil {
		return true
	}
	return len(h) <= 253 && hostnameRE.MatchString(h)
}

// normalUsername is a username as the app keeps it: trimmed and in lower case.
func normalUsername(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

// usernameProblem says why s is not a username the app takes, in the app's words
// (docs/plan/18-third-owner-list-2026-11-23.md section 3.1); "" when it is one.
func usernameProblem(s string) string {
	s = normalUsername(s)
	switch n := len([]rune(s)); {
	case n < minUsername || n > maxUsername:
		return "A username has 3 to 32 characters."
	case !usernameRE.MatchString(s):
		return "Use letters a to z, digits, dots, underscores and hyphens, starting with a letter or a digit."
	}
	return ""
}

// nameProblem says why s is not a person's name the app takes, in the app's words; ""
// when it is one.
func nameProblem(s string) string {
	switch n := len([]rune(strings.TrimSpace(s))); {
	case n == 0:
		return "Enter a name."
	case n > maxName:
		return "Use at most 100 characters."
	}
	return ""
}

func (o Options) logPath() string {
	if o.LogPath == "" {
		return DefaultLogPath
	}
	return o.LogPath
}
