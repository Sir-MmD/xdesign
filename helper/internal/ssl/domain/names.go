package domain

import (
	"net/netip"
	"strconv"
	"strings"
)

// Limits of the names of a Let's Encrypt request.
const (
	// MaxNames is how many DNS names one certificate of xDesign may hold.
	MaxNames = 10
	// maxNameLen and maxLabelLen are the DNS limits of a name and of one label.
	maxNameLen  = 253
	maxLabelLen = 63
)

// wildcardPrefix starts a wildcard name: "*." followed by the domain it covers.
const wildcardPrefix = "*."

// NormalizeName returns name as xDesign stores it: without surrounding space, in lower
// case, without the final dot of a fully qualified name.
func NormalizeName(name string) string {
	return strings.TrimSuffix(strings.ToLower(strings.TrimSpace(name)), ".")
}

// IsWildcard reports whether name is a wildcard name such as "*.example.com".
func IsWildcard(name string) bool {
	return strings.HasPrefix(name, wildcardPrefix)
}

// BaseName returns name without its wildcard label: "example.com" for "*.example.com".
func BaseName(name string) string {
	return strings.TrimPrefix(name, wildcardPrefix)
}

// NameError is what ValidateNames found wrong with the names of a request: one plain
// sentence for each problem, in the order of the names.
type NameError struct {
	Problems []string
}

// Error joins the sentences.
func (e *NameError) Error() string {
	return strings.Join(e.Problems, " ")
}

// ValidateNames checks the names of a Let's Encrypt request for a certificate of method
// m and returns them normalized (NormalizeName), in the order given: 1 to MaxNames DNS
// names in ASCII form (an internationalized name in its xn-- form), no IP addresses, no
// name twice, and a wildcard only as the first label and only through Cloudflare (DNS-01;
// Let's Encrypt checks wildcards only that way). The error is a *NameError.
func ValidateNames(m Method, names []string) ([]string, error) {
	var problems []string
	switch {
	case len(names) == 0:
		problems = append(problems, "Give the domain the certificate is for.")
	case len(names) > MaxNames:
		problems = append(problems, "A certificate holds at most "+strconv.Itoa(MaxNames)+" names.")
	}
	out := make([]string, 0, len(names))
	seen := map[string]bool{}
	for _, raw := range names {
		name := NormalizeName(raw)
		out = append(out, name)
		if msg := checkName(m, name); msg != "" {
			if name != "" {
				problems = append(problems, name+": "+msg+".")
			} else {
				problems = append(problems, sentence(msg))
			}
			continue
		}
		if seen[name] {
			problems = append(problems, name+" is listed twice.")
			continue
		}
		seen[name] = true
	}
	if len(problems) > 0 {
		return nil, &NameError{Problems: problems}
	}
	return out, nil
}

// sentence returns msg, which starts with an ASCII letter, with a capital first letter
// and a final period.
func sentence(msg string) string {
	return strings.ToUpper(msg[:1]) + msg[1:] + "."
}

// checkName returns why the request cannot hold a name, or "".
func checkName(m Method, name string) string {
	if name == "" {
		return "give a domain name such as design.example.com"
	}
	if _, err := netip.ParseAddr(strings.Trim(name, "[]")); err == nil {
		return "Let's Encrypt certificates of xDesign are for domain names, not IP addresses"
	}
	host := name
	if IsWildcard(name) {
		if m != MethodLetsEncryptCloudflare {
			return "a wildcard name needs Cloudflare: Let's Encrypt checks it only through DNS"
		}
		host = BaseName(name)
	}
	if strings.Contains(host, "*") {
		return "a wildcard is allowed only as the first label, as in *.example.com"
	}
	if len(name) > maxNameLen {
		return "a domain name has at most " + strconv.Itoa(maxNameLen) + " characters"
	}
	labels := strings.Split(host, ".")
	if len(labels) < 2 {
		return "give a full domain name such as design.example.com"
	}
	for _, label := range labels {
		if !validLabel(label) {
			return "must be a domain name in ASCII form, such as design.example.com " +
				"(write an internationalized name in its xn-- form)"
		}
	}
	if allDigits(labels[len(labels)-1]) {
		return "the last label of a domain name is not a number"
	}
	return ""
}

// validLabel reports whether label is a DNS label of letters, digits and hyphens, 1 to
// 63 characters, not starting or ending with a hyphen.
func validLabel(label string) bool {
	if label == "" || len(label) > maxLabelLen || label[0] == '-' || label[len(label)-1] == '-' {
		return false
	}
	for i := range len(label) {
		if c := label[i]; (c < 'a' || c > 'z') && (c < '0' || c > '9') && c != '-' {
			return false
		}
	}
	return true
}

func allDigits(s string) bool {
	for i := range len(s) {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return s != ""
}

// SameNames reports whether a and b hold the same names, in any order.
func SameNames(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	set := make(map[string]int, len(a))
	for _, n := range a {
		set[NormalizeName(n)]++
	}
	for _, n := range b {
		k := NormalizeName(n)
		if set[k] == 0 {
			return false
		}
		set[k]--
	}
	return true
}

// DisplayName returns the name of a certificate for these names: the first one, which
// is the domain the owner typed ("example.com" for example.com and *.example.com).
func DisplayName(names []string) string {
	if len(names) == 0 {
		return ""
	}
	return names[0]
}
