package config

import (
	"errors"
	"fmt"
	"net"
	"net/netip"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// maxDomain is the longest DNS name; maxLabel the longest part between two dots.
const (
	maxDomain = 253
	maxLabel  = 63
)

// validate checks every value and returns one message per problem. It normalizes the
// domain and the data folder on the way.
func (c *Config) validate() []string {
	var p []string
	add := func(format string, args ...any) {
		p = append(p, fmt.Sprintf(format, args...))
	}

	if problem := checkListen(c.Listen); problem != "" {
		add("%s", problem)
	}

	if err := CheckBasePath(c.BasePath); err != nil {
		add("base_path %v", err)
	}

	c.Domain = normalDomain(c.Domain)
	switch {
	case c.Domain == "":
		add("domain is missing: set it to the site's domain (design.example.com) or the server's IP address")
	case !validHost(c.Domain):
		add("domain %q is not a domain or an IP address: write the name alone, "+
			"for example design.example.com, without https:// or a port", c.Domain)
	}

	if !filepath.IsAbs(c.DataDir) {
		add("data_dir must be an absolute path, not %q", c.DataDir)
	} else {
		c.DataDir = filepath.Clean(c.DataDir)
	}

	if _, ok := slogLevels()[c.LogLevel]; !ok {
		add("log_level must be debug, info, warn or error, not %q", c.LogLevel)
	}
	return p
}

// normalDomain is domain as the config file keeps it: lower case, without spaces or a final
// dot.
func normalDomain(domain string) string {
	return strings.TrimSuffix(strings.ToLower(strings.TrimSpace(domain)), ".")
}

// CheckDomain checks a new domain for the config file (the domain change of Settings >
// HTTPS) with the rules of its domain key, and returns it as the file keeps it.
func CheckDomain(domain string) (string, error) {
	d := normalDomain(domain)
	switch {
	case d == "":
		return "", errors.New("enter the site's domain, for example design.example.com, or the server's IP address")
	case !validHost(d):
		return "", fmt.Errorf("%s is not a domain or an IP address: write the name alone, for example design.example.com, "+
			"without https:// or a port", strings.TrimSpace(domain))
	}
	return d, nil
}

// Web base path rules, as xWriter's (its docs/plan/09-web-api.md section 4.1).
const (
	maxBasePathSegments = 3
	minBasePathSegment  = 4
	maxBasePathSegment  = 64
)

// basePathRE is the web base path's form: slashes around parts of A-Z a-z 0-9 _ -.
var basePathRE = regexp.MustCompile(`^/([A-Za-z0-9_-]+/)*$`)

// CheckBasePath applies the web base path rules (docs/plan/16-owner-list-2026-11-23.md
// section 4, copied from xWriter's CheckBasePath): "/" (allowed, though the installer
// warns about it), or 1 to 3 parts between slashes, each 4 to 64 of A-Z a-z 0-9 _ -.
func CheckBasePath(p string) error {
	bad := fmt.Errorf("%q is not a web base path: it starts and ends with / and has 1 to 3 parts of 4 to 64 letters, "+
		"digits, - or _ between the slashes, for example /k3v9x2m1q8wz7r4t/", p)
	if !basePathRE.MatchString(p) {
		return bad
	}
	if p == "/" {
		return nil
	}
	parts := strings.Split(strings.Trim(p, "/"), "/")
	if len(parts) > maxBasePathSegments {
		return bad
	}
	for _, part := range parts {
		if len(part) < minBasePathSegment || len(part) > maxBasePathSegment {
			return bad
		}
	}
	return nil
}

// checkListen checks the listen address: an IP address (or nothing, for every address)
// and a port. Host names are refused, so name resolution never moves the front to another
// address.
func checkListen(listen string) string {
	host, port, err := net.SplitHostPort(listen)
	if err != nil {
		return fmt.Sprintf("listen must be an address and a port such as 127.0.0.1:8080 or :443, not %q", listen)
	}
	if n, err := strconv.Atoi(port); err != nil || n < 1 || n > 65535 {
		return fmt.Sprintf("listen %q: the port must be a number from 1 to 65535", listen)
	}
	if host != "" {
		if _, err := netip.ParseAddr(host); err != nil {
			return fmt.Sprintf("listen %q: the address must be an IP address, not a host name", listen)
		}
	}
	return ""
}

// validHost reports whether host is an IP address or a DNS name of letters, digits and
// hyphens.
func validHost(host string) bool {
	if _, err := netip.ParseAddr(host); err == nil {
		return true
	}
	if len(host) > maxDomain {
		return false
	}
	for label := range strings.SplitSeq(host, ".") {
		if label == "" || len(label) > maxLabel || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, r := range label {
			if (r < 'a' || r > 'z') && (r < '0' || r > '9') && r != '-' {
				return false
			}
		}
	}
	return true
}
