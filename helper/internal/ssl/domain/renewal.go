package domain

import "time"

// Renewal timing (xWriter's).
const (
	// RenewCheckInterval is how often the manager looks at a Let's Encrypt certificate.
	RenewCheckInterval = 15 * time.Minute
	// ARICheckInterval is how often the renewal information of a certificate is read
	// when the CA sends no Retry-After.
	ARICheckInterval = 12 * time.Hour
	// minARICheck and maxARICheck bound the CA's Retry-After, so a broken header neither
	// floods the CA nor stops the checks.
	minARICheck = 15 * time.Minute
	maxARICheck = 24 * time.Hour
	// ARIRetryAfterError is when the renewal information is read again after the CA could
	// not be reached.
	ARIRetryAfterError = time.Hour
	// shortLived is the lifetime below which a certificate renews at half of it.
	shortLived = 10 * 24 * time.Hour
)

// RenewAt returns when a certificate valid from notBefore to notAfter is renewed without
// renewal information from the CA: after two thirds of its lifetime (Let's Encrypt's
// advice: day 60 of 90, 30 days before the expiry), after half of it for a certificate
// that lives less than 10 days.
func RenewAt(notBefore, notAfter time.Time) time.Time {
	life := notAfter.Sub(notBefore)
	if life <= 0 {
		return notBefore
	}
	if life < shortLived {
		return notBefore.Add(life / 2)
	}
	return notBefore.Add(life / 3 * 2)
}

// RetryDelay returns how long a renewal waits after its failures-th failure in a row:
// 5 minutes after the first, 30 minutes after the second, 2 hours after the
// third, then 6 hours.
func RetryDelay(failures int) time.Duration {
	switch {
	case failures <= 1:
		return 5 * time.Minute
	case failures == 2:
		return 30 * time.Minute
	case failures == 3:
		return 2 * time.Hour
	default:
		return 6 * time.Hour
	}
}

// Rand draws random numbers. *rand.Rand of math/rand/v2 is one; production seeds it at
// start.
type Rand interface {
	// Int64N returns a uniform random number in [0, n).
	Int64N(n int64) int64
}

// ChooseInWindow returns a uniform random time in [start, end), in whole seconds after
// start, the renewal time inside a window the CA suggested (RFC 9773 section 4.2): chosen
// once per window, so renewals spread out instead of crowding at its start. A window
// shorter than a second gives start.
func ChooseInWindow(start, end time.Time, r Rand) time.Time {
	seconds := int64(end.Sub(start) / time.Second)
	if seconds < 1 {
		return start
	}
	return start.Add(time.Duration(r.Int64N(seconds)) * time.Second)
}

// NextARICheck returns when the renewal information is read again after a successful
// read at now: after the CA's Retry-After, bounded to 15 minutes to 24 hours, or after
// ARICheckInterval without one.
func NextARICheck(now time.Time, retryAfter time.Duration) time.Time {
	if retryAfter <= 0 {
		return now.Add(ARICheckInterval)
	}
	return now.Add(min(max(retryAfter, minARICheck), maxARICheck))
}

// ARI is the renewal information of a Let's Encrypt certificate (RFC 9773) in the state
// file: the window the CA suggested, the time chosen in it, and when it was read.
type ARI struct {
	WindowStart time.Time `json:"window_start,omitzero"`
	WindowEnd   time.Time `json:"window_end,omitzero"`
	// Chosen is the random time inside the window (ChooseInWindow): the renewal time.
	Chosen time.Time `json:"chosen,omitzero"`
	// ExplanationURL is the CA's page about the window, for example after a mass
	// revocation; Settings > HTTPS shows it.
	ExplanationURL string    `json:"explanation_url,omitempty"`
	CheckedAt      time.Time `json:"checked_at,omitzero"`
	// NextCheckAt is when the manager reads the information again (NextARICheck, or
	// ARIRetryAfterError after a failed read).
	NextCheckAt time.Time `json:"next_check_at,omitzero"`
	// Unsupported records that the CA offers no renewal information: the certificate
	// renews at RenewAt.
	Unsupported bool `json:"unsupported,omitempty"`
	// Error is why the last read failed; empty after a successful one.
	Error string `json:"error,omitempty"`
}

// SameWindow reports whether a holds the window from start to end.
func (a *ARI) SameWindow(start, end time.Time) bool {
	return a != nil && a.WindowStart.Equal(start) && a.WindowEnd.Equal(end)
}

// Due reports whether the information should be read at now.
func (a *ARI) Due(now time.Time) bool {
	return a == nil || !now.Before(a.NextCheckAt)
}
