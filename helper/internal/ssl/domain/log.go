package domain

import (
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

// LogLevel is the level of a log entry.
type LogLevel string

// The levels.
const (
	LogInfo    LogLevel = "info"
	LogWarning LogLevel = "warning"
	LogError   LogLevel = "error"
)

// Limits of the log of the certificate in the state file.
const (
	// MaxLogEntries is how many entries the log keeps: the last ones of the last
	// issuance or renewal.
	MaxLogEntries = 200
	// MaxLogText is the longest text of one entry, in bytes.
	MaxLogText = 1000
)

// LogEntry is one line of the log of the last issuance or renewal of a certificate: the
// engine's steps in plain words and the ACME library's records, redacted.
type LogEntry struct {
	At    time.Time `json:"at"`
	Level LogLevel  `json:"level"`
	Text  string    `json:"text"`
}

// NewLogEntry returns an entry with text cleaned for storage: one line, valid UTF-8,
// at most MaxLogText bytes. The caller redacts it first.
func NewLogEntry(at time.Time, level LogLevel, text string) LogEntry {
	return LogEntry{At: at.UTC(), Level: level, Text: cleanLine(text, MaxLogText)}
}

// cleanLine makes text one line of valid UTF-8 of at most limit bytes.
func cleanLine(text string, limit int) string {
	text = strings.ToValidUTF8(text, "�")
	text = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) || r == ' ' || r == ' ' {
			return ' '
		}
		return r
	}, text)
	text = strings.TrimSpace(text)
	if len(text) <= limit {
		return text
	}
	cut := limit - len("...")
	for cut > 0 && !utf8.RuneStart(text[cut]) {
		cut--
	}
	return text[:cut] + "..."
}
