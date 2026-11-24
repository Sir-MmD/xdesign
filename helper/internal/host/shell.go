package host

import "strings"

// Quote returns s as one shell word: unchanged when it needs no quoting, in double
// quotes when it contains single quotes but nothing a shell expands inside double
// quotes (so SQL reads naturally: "SELECT ... = 'xdesign'"), otherwise in single
// quotes.
func Quote(s string) string {
	if s != "" && safeWord(s) {
		return s
	}
	if strings.Contains(s, "'") && !strings.ContainsAny(s, "\"$`\\!") {
		return `"` + s + `"`
	}
	return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'"
}

// safeWord reports whether s holds only characters a shell takes literally.
func safeWord(s string) bool {
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
		case strings.ContainsRune("_@%+=:,./-", r):
		default:
			return false
		}
	}
	return true
}
