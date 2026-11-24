package acme

import (
	"regexp"
	"strings"
	"unicode/utf8"
)

const (
	// redacted replaces a secret in a text.
	redacted = "[redacted]"
	// maxErrorText bounds the text of an error in a problem, in bytes.
	maxErrorText = 500
)

// The patterns of Redact.
var (
	// urlPattern is a URL up to the next space or quote.
	urlPattern = regexp.MustCompile(`[a-zA-Z][a-zA-Z0-9+.-]*://[^\s"'<>]+`)
	// authPattern is an Authorization value such as "Bearer abc".
	authPattern = regexp.MustCompile(`(?i)\b(bearer|basic)(\s+)[A-Za-z0-9._~+/=-]{8,}`)
	// keyValuePattern is key=value or "key":"value" with a secret-looking key.
	keyValuePattern = regexp.MustCompile(`(?i)("?[a-z0-9_-]*(?:token|secret|password|passwd|api[_-]?key|authorization)"?\s*[:=]\s*"?)[^\s",}&]+`)
	// pemKeyPattern is a private key in PEM.
	pemKeyPattern = regexp.MustCompile(`-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)`)
)

// Redact removes what may be a secret from text: xWriter's secrets.Redact cut to what the
// ACME and Cloudflare calls can print. It replaces private keys in PEM, Authorization
// values, secret-looking key=value pairs (a Cloudflare token among them), and the user
// info, query and fragment of URLs (an ACME URL keeps its path, which names an order or
// the account, not a secret).
func Redact(text string) string {
	if strings.Contains(text, "PRIVATE KEY-----") {
		text = pemKeyPattern.ReplaceAllString(text, redacted)
	}
	if strings.Contains(text, "://") {
		text = urlPattern.ReplaceAllStringFunc(text, redactURL)
	}
	text = authPattern.ReplaceAllString(text, "${1}${2}"+redacted)
	if strings.ContainsAny(text, ":=") {
		text = keyValuePattern.ReplaceAllString(text, "${1}"+redacted)
	}
	return text
}

// redactURL removes the user info, query and fragment of a URL.
func redactURL(u string) string {
	if i := strings.IndexAny(u, "?#"); i >= 0 {
		u = u[:i]
	}
	scheme, rest, ok := strings.Cut(u, "://")
	if !ok {
		return u
	}
	authority, path, hasPath := strings.Cut(rest, "/")
	if i := strings.LastIndexByte(authority, '@'); i >= 0 {
		authority = authority[i+1:]
	}
	if hasPath {
		return scheme + "://" + authority + "/" + path
	}
	return scheme + "://" + authority
}

// ErrorText returns err's message prepared for a problem or the log: redacted, on one
// line, at most 500 bytes. A nil error gives "".
func ErrorText(err error) string {
	if err == nil {
		return ""
	}
	text := strings.Join(strings.Fields(Redact(err.Error())), " ")
	if len(text) <= maxErrorText {
		return text
	}
	cut := maxErrorText - len("...")
	for cut > 0 && !utf8.RuneStart(text[cut]) {
		cut--
	}
	return text[:cut] + "..."
}
