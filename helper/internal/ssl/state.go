package ssl

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"time"

	sslcfg "github.com/Sir-MmD/xdesign/helper/internal/ssl/domain"
)

// Files of the state folder, /var/lib/xdesign/certs.
const (
	// StateFile holds the method, its fields, the state machine, the Let's Encrypt account
	// and the log of the last issuance; mode 0600, since it holds the Cloudflare token and
	// the account key.
	StateFile = "state.json"
	// CertFile and KeyFile hold the certificate of the method: the one Let's Encrypt
	// issued, the pasted one, or the last good copy of the certificate files.
	CertFile = "cert.pem"
	KeyFile  = "key.pem"

	stateVersion = 1
	// maxStateSize bounds what is read of the state file: it holds a log of at most 200
	// lines of 1,000 bytes and a few keys.
	maxStateSize = 1 << 20
	// secretMode is the mode of the state file and the key; certMode of the chain.
	secretMode fs.FileMode = 0o600
	certMode   fs.FileMode = 0o644
	dirMode    fs.FileMode = 0o700
)

// state is the content of the state file. Only the manager reads and writes it, under its
// lock.
type state struct {
	Version int           `json:"version"`
	Method  sslcfg.Method `json:"method"`
	// Names are the names of a Let's Encrypt certificate, the first one the domain the
	// owner typed; empty for the other methods.
	Names []string `json:"names,omitempty"`
	// CloudflareToken is the API token of letsencrypt_cloudflare (Zone Read and DNS
	// Edit). It is kept when another method is chosen, so coming back needs no new token,
	// and never logged or answered.
	CloudflareToken string `json:"cloudflare_token,omitempty"`
	// CertPath and KeyPath are the files of the file method.
	CertPath string `json:"cert_path,omitempty"`
	KeyPath  string `json:"key_path,omitempty"`

	Status sslcfg.Status `json:"status"`
	// HasCert reports that CertFile and KeyFile hold a certificate for the method. A new
	// Let's Encrypt certificate replaces them only once it is issued, so the certificate
	// before it is served meanwhile.
	HasCert   bool      `json:"has_cert,omitempty"`
	NotBefore time.Time `json:"not_before,omitzero"`
	NotAfter  time.Time `json:"not_after,omitzero"`
	// Fingerprint is the SHA-256 fingerprint of the certificate in CertFile.
	Fingerprint string `json:"fingerprint_sha256,omitempty"`
	// IssuedAt is when Let's Encrypt issued the certificate of CertFile.
	IssuedAt time.Time `json:"issued_at,omitzero"`
	// FromLetsEncrypt reports that CertFile holds a certificate Let's Encrypt issued for
	// Names, which renews itself.
	FromLetsEncrypt bool `json:"from_letsencrypt,omitempty"`
	// RenewAt is the renewal time without renewal information (sslcfg.RenewAt); ARI holds
	// the CA's window and the time chosen in it.
	RenewAt time.Time   `json:"renew_at,omitzero"`
	ARI     *sslcfg.ARI `json:"ari,omitempty"`
	// Failures counts the failed renewals in a row; NextAttemptAt is when the next one
	// runs (sslcfg.RetryDelay, or Let's Encrypt's Retry-After).
	Failures      int       `json:"failures,omitempty"`
	NextAttemptAt time.Time `json:"next_attempt_at,omitzero"`
	// LastProblem is why the last issuance, renewal or read of the files failed, in plain
	// words; empty once one succeeds.
	LastProblem   string    `json:"last_problem,omitempty"`
	LastProblemAt time.Time `json:"last_problem_at,omitzero"`
	// Log is the log of the last issuance or renewal.
	Log []sslcfg.LogEntry `json:"log,omitempty"`
	// Account is the Let's Encrypt account, made at the first issuance.
	Account *account `json:"account,omitempty"`
}

// account is xDesign's account at an ACME directory.
type account struct {
	Directory string `json:"directory"`
	// KeyPEM is the account key (acme.EncodeKey).
	KeyPEM       string              `json:"key_pem"`
	Registration sslcfg.Registration `json:"registration"`
}

// readState reads the state file of dir; found is false when there is none yet.
func readState(dir string) (st state, found bool, err error) {
	path := filepath.Join(dir, StateFile)
	data, err := readSmall(path, maxStateSize)
	if errors.Is(err, fs.ErrNotExist) {
		return state{}, false, nil
	}
	if err != nil {
		return state{}, false, err
	}
	if err := json.Unmarshal(data, &st); err != nil {
		return state{}, false, fmt.Errorf("read %s: %w", path, err)
	}
	switch {
	case st.Version != stateVersion:
		return state{}, false, fmt.Errorf("read %s: version %d is not %d", path, st.Version, stateVersion)
	case !st.Method.Valid():
		return state{}, false, fmt.Errorf("read %s: unknown method %q", path, st.Method)
	case !st.Status.Valid():
		return state{}, false, fmt.Errorf("read %s: unknown status %q", path, st.Status)
	}
	return st, true, nil
}

// writeState replaces the state file of dir.
func writeState(dir string, st *state) error {
	st.Version = stateVersion
	data, err := json.MarshalIndent(st, "", "  ")
	if err != nil {
		return fmt.Errorf("encode the state: %w", err)
	}
	return writeAtomic(filepath.Join(dir, StateFile), append(data, '\n'), secretMode)
}

// FirstState returns the content of a state file that a first start reads instead of
// choosing its default method: Let's Encrypt over port 80 for names when letsEncrypt is
// set (the issuance starts at the first start), else the built-in certificate. The
// installer writes the built-in one (17 section 5) and asks the running site for the
// certificate the owner chose through the control socket (PUT /https).
func FirstState(letsEncrypt bool, names []string) ([]byte, error) {
	st := state{Version: stateVersion, Method: sslcfg.MethodBuiltin, Status: sslcfg.StatusActive}
	if letsEncrypt {
		valid, err := sslcfg.ValidateNames(sslcfg.MethodLetsEncryptHTTP, names)
		if err != nil {
			return nil, err
		}
		st = state{Version: stateVersion, Method: sslcfg.MethodLetsEncryptHTTP, Names: valid, Status: sslcfg.StatusIssuing}
	}
	data, err := json.MarshalIndent(&st, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("encode the state: %w", err)
	}
	return append(data, '\n'), nil
}

// writePair replaces the certificate files of dir with chain and key. The key is replaced
// first, as certs.WriteSelfSigned does: a reader that catches the new key with the old
// chain refuses the pair.
func writePair(dir string, chain, key []byte) error {
	if err := writeAtomic(filepath.Join(dir, KeyFile), key, secretMode); err != nil {
		return err
	}
	return writeAtomic(filepath.Join(dir, CertFile), chain, certMode)
}

// removePair removes the certificate files of dir.
func removePair(dir string) error {
	var errs []error
	for _, name := range []string{CertFile, KeyFile} {
		if err := os.Remove(filepath.Join(dir, name)); err != nil && !errors.Is(err, fs.ErrNotExist) {
			errs = append(errs, fmt.Errorf("remove %s: %w", name, err))
		}
	}
	return errors.Join(errs...)
}

// pairPaths returns the paths of the certificate files of dir.
func pairPaths(dir string) (certPath, keyPath string) {
	return filepath.Join(dir, CertFile), filepath.Join(dir, KeyFile)
}

// readSmall reads the file at path, refusing one larger than limit.
func readSmall(path string, limit int64) ([]byte, error) {
	f, err := os.Open(path) //nolint:gosec // G304: the manager's own state file
	if err != nil {
		return nil, fmt.Errorf("open %s: %w", path, err)
	}
	defer func() { _ = f.Close() }() // read-only: closing cannot lose data
	data, err := io.ReadAll(io.LimitReader(f, limit+1))
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", path, err)
	}
	if int64(len(data)) > limit {
		return nil, fmt.Errorf("read %s: larger than %d bytes", path, limit)
	}
	return data, nil
}

// writeAtomic replaces path with data through a temporary file in the same folder that is
// written, given mode, synced and renamed over path, then syncs the folder (the way of
// certs.WriteSelfSigned).
func writeAtomic(path string, data []byte, mode fs.FileMode) (err error) {
	dir := filepath.Dir(path)
	f, err := os.CreateTemp(dir, "."+filepath.Base(path)+".*.tmp")
	if err != nil {
		return fmt.Errorf("create a temporary file in %s: %w", dir, err)
	}
	tmp := f.Name()
	defer func() {
		if err != nil {
			_ = f.Close()      // already closed on the success path; a second close only fails
			_ = os.Remove(tmp) // nothing else refers to the temporary file
		}
	}()
	if _, err := f.Write(data); err != nil {
		return fmt.Errorf("write %s: %w", tmp, err)
	}
	// CreateTemp makes 0600 files; Chmod sets the mode exactly, without the umask.
	if err := f.Chmod(mode); err != nil {
		return fmt.Errorf("set the mode of %s: %w", tmp, err)
	}
	if err := f.Sync(); err != nil {
		return fmt.Errorf("sync %s: %w", tmp, err)
	}
	if err := f.Close(); err != nil {
		return fmt.Errorf("close %s: %w", tmp, err)
	}
	if err := os.Rename(tmp, path); err != nil {
		return fmt.Errorf("replace %s: %w", path, err)
	}
	d, err := os.Open(dir) //nolint:gosec // G304: the manager's own folder
	if err != nil {
		return fmt.Errorf("open %s: %w", dir, err)
	}
	defer func() { _ = d.Close() }() // a folder opened read-only: closing cannot lose data
	if err := d.Sync(); err != nil {
		return fmt.Errorf("sync %s: %w", dir, err)
	}
	return nil
}
