package cli

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/control"
	"github.com/Sir-MmD/xdesign/helper/internal/install"
	"github.com/Sir-MmD/xdesign/helper/internal/status"
)

// The usage, the words, the service's state and the control channel's client of the
// status differ between Linux and Windows: cmd_status_linux.go and cmd_status_windows.go.

// statusTimeout bounds the question to the control socket and the health check.
const statusTimeout = 5 * time.Second

// statusOutput is what `xdesign status --json` prints: the control socket's GET /status,
// with what the command found itself.
type statusOutput struct {
	// Running reports that the front answered on its control socket.
	Running bool `json:"running"`
	// Service is the state of xdesign.service (systemctl is-active), on Windows of the
	// service xdesign (running, stopped...).
	Service string `json:"service"`
	// Health is "ok" when the website answered /api/health under the web base path,
	// otherwise why it did not.
	Health string `json:"health"`
	control.Status
}

// RunStatus is `xdesign status`.
func RunStatus(ctx context.Context, env *Env, args []string) int {
	fs := flag.NewFlagSet("xdesign status", flag.ContinueOnError)
	fs.SetOutput(env.Stderr)
	fs.Usage = func() { fmt.Fprint(env.Stderr, statusUsage) }
	asJSON := fs.Bool("json", false, "")
	configPath := fs.String("config", config.DefaultPath, "")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return ExitOK
		}
		return ExitUsage
	}
	if fs.NArg() > 0 {
		fmt.Fprintf(env.Stderr, "xdesign status: unexpected argument %q\n", fs.Arg(0))
		return ExitUsage
	}
	if !statusAllowed(env) {
		fmt.Fprintln(env.Stderr, "xdesign status: "+statusRefused)
		return ExitError
	}
	data, err := env.System.FS.ReadFile(*configPath)
	if err != nil {
		fmt.Fprintf(env.Stderr, "xdesign status: read the settings: %v (is xDesign installed on this server?)\n", err)
		return ExitError
	}
	cfg, err := config.Parse(data, *configPath)
	if err != nil {
		fmt.Fprintf(env.Stderr, "xdesign status: %v\n", err)
		return ExitError
	}
	out := statusOutput{Service: serviceState(ctx, env)}
	if st, err := askStatus(ctx); err == nil {
		out.Running, out.Status = true, st
	} else {
		out.Status = filesStatus(env, cfg)
	}
	out.Health = "ok"
	if env.Get == nil {
		out.Health = "not checked"
	} else {
		hctx, cancel := context.WithTimeout(ctx, statusTimeout)
		if err := install.CheckHealth(hctx, env.Get, cfg); err != nil {
			out.Health = err.Error()
		}
		cancel()
	}
	if *asJSON {
		enc := json.NewEncoder(env.Stdout)
		enc.SetIndent("", "  ")
		if err := enc.Encode(out); err != nil {
			fmt.Fprintf(env.Stderr, "xdesign status: %v\n", err)
			return ExitError
		}
		return ExitOK
	}
	printStatus(env.Stdout, out, cfg)
	return ExitOK
}

// askStatus asks the front for GET /status on its control channel (controlClient).
func askStatus(ctx context.Context) (control.Status, error) {
	client, base, err := controlClient()
	if err != nil {
		return control.Status{}, err
	}
	ctx, cancel := context.WithTimeout(ctx, statusTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"/status", nil)
	if err != nil {
		return control.Status{}, fmt.Errorf("GET /status: %w", err)
	}
	resp, err := client.Do(req)
	if err != nil {
		return control.Status{}, fmt.Errorf("GET /status: %w", err)
	}
	defer func() { _ = resp.Body.Close() }() // read to its end below
	if resp.StatusCode != http.StatusOK {
		return control.Status{}, fmt.Errorf("GET /status: HTTP %d", resp.StatusCode)
	}
	var st control.Status
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&st); err != nil {
		return control.Status{}, fmt.Errorf("GET /status: %w", err)
	}
	return st, nil
}

// filesStatus is what the files say while the front does not answer: the installed
// version, the settings, the disk use and the backups.
func filesStatus(env *Env, cfg *config.Config) control.Status {
	st := control.Status{Version: env.Build.Version, Mode: "port", Address: cfg.PublicURL()}
	if rel, err := install.CurrentRelease(env.System.FS); err == nil {
		st.Version = rel.Version
	}
	storage := status.StorageOf(cfg.DataDir)
	backups := status.BackupsOf(backup.Options{DataDir: cfg.DataDir}.Dir())
	st.Storage, st.Backups = &storage, &backups
	return st
}

// printStatus prints the status in pacman's style.
func printStatus(w io.Writer, out statusOutput, cfg *config.Config) {
	st := out.Status
	fact := func(label, format string, args ...any) {
		fmt.Fprintf(w, " -> %-9s %s\n", label, fmt.Sprintf(format, args...))
	}
	fmt.Fprintf(w, ":: xDesign %s\n", st.Version)
	_, port, _ := net.SplitHostPort(cfg.Listen)
	fact("port", "%s: xDesign serves HTTPS itself on it", port)
	fact("address", "%s", st.Address)
	if out.Running {
		started := st.FrontStartedAt.UTC()
		fact("front", "running for %s (since %s UTC); %s is %s", formatUptime(time.Duration(st.UptimeSeconds)*time.Second),
			started.Format("2006-01-02 15:04"), serviceName, out.Service)
		app := string(st.App.State)
		if st.App.PID > 0 {
			app += fmt.Sprintf(" (process %d)", st.App.PID)
		}
		if st.App.Restarts > 0 {
			app += fmt.Sprintf(", restarted %d times", st.App.Restarts)
		}
		if e := st.App.LastExit; e != nil && st.App.Restarts > 0 {
			app += fmt.Sprintf(", last exit at %s UTC", e.At.UTC().Format("2006-01-02 15:04"))
		}
		fact("app", "%s", app)
	} else {
		fact("front", "not running: %s is %s (%s)", serviceName, out.Service, serviceWhy)
		fact("app", "not running")
	}
	if out.Health == "ok" {
		fact("health", "the website answers /api/health")
	} else {
		fact("health", "the website does not answer: %s", out.Health)
	}
	if s := st.Storage; s != nil {
		fact("database", "%s", backup.FormatBytes(s.DatabaseBytes))
		fact("media", "%s in %d files", backup.FormatBytes(s.MediaBytes), s.MediaFiles)
		fact("disk", "%s free in %s", backup.FormatBytes(s.FreeBytes), s.DataDir)
		if s.Problem != "" {
			fact("", "not everything could be measured: %s", s.Problem)
		}
	}
	if b := st.Backups; b != nil {
		switch {
		case b.Problem != "":
			fact("backups", "cannot be listed: %s", b.Problem)
		case b.Count == 0:
			fact("backups", "none yet (%s)", backupHint)
		default:
			fact("backups", "%d, %s in all", b.Count, backup.FormatBytes(b.SpaceUsed))
		}
		for _, e := range b.Last {
			fact("", "%s  %s, %s UTC, %s", e.Name, e.Kind, e.CreatedAt.UTC().Format("2006-01-02 15:04"), backup.FormatBytes(e.Size))
		}
		if b.Running {
			fact("", "a backup or a restore runs now")
		}
	}
	fact("https", "%s", httpsWords(out))
}

// httpsWords says the HTTPS method and the certificate's expiry.
func httpsWords(out statusOutput) string {
	h := out.HTTPS
	if h.Method == "" {
		return "not known while xDesign does not run"
	}
	words := map[string]string{
		"builtin": "the built-in certificate", "letsencrypt_http": "Let's Encrypt (port 80)",
		"letsencrypt_cloudflare": "Let's Encrypt through Cloudflare DNS", "file": "Certificate files on this server",
		"uploaded": "a pasted certificate",
	}
	text := words[h.Method]
	if text == "" {
		text = h.Method
	}
	if h.State != "" {
		text += ", " + h.State
	}
	if !h.ExpiresAt.IsZero() {
		day := h.ExpiresAt.UTC().Format("2006-01-02")
		if left := time.Until(h.ExpiresAt); left > 0 {
			text += fmt.Sprintf("; the certificate expires %s UTC (in %s)", day, formatUptime(left))
		} else {
			text += fmt.Sprintf("; the certificate expired %s UTC", day)
		}
	}
	if h.LastProblem != "" {
		text += ". Last problem: " + h.LastProblem
	}
	return text
}

// formatUptime says a duration in days and hours, hours and minutes, or minutes.
func formatUptime(d time.Duration) string {
	switch {
	case d < 0:
		return "0 min"
	case d >= 48*time.Hour:
		return fmt.Sprintf("%d days %d h", int(d.Hours())/24, int(d.Hours())%24)
	case d >= time.Hour:
		return fmt.Sprintf("%d h %d min", int(d.Hours()), int(d.Minutes())%60)
	case d >= time.Minute:
		return fmt.Sprintf("%d min", int(d.Minutes()))
	}
	return fmt.Sprintf("%d s", int(d.Seconds()))
}
