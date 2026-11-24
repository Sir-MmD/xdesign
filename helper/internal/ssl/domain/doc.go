// Package domain holds the rules of the HTTPS manager (docs/plan/07-server-install-update.md
// section 4): the ways to get a certificate (Method), the states of a certificate
// (Status), the names a Let's Encrypt request may hold (ValidateNames), the renewal time
// and the backoff after failed renewals (RenewAt, RetryDelay, ChooseInWindow), the
// issuance log (LogEntry), the plain-words texts of the failures (Problem), and the JSON
// values the state file keeps: the renewal information (ARI) and the account's
// registration (Registration). Pure logic.
//
// Copied from xWriter's internal/domain/ssl (07 section 10) without the panel settings,
// the file state and the validation package: a field problem is a plain sentence
// (NameError). Texts say "xDesign" where xWriter's say "the panel".
package domain
