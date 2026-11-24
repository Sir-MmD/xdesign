package install

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/config"
)

// Timeouts and waits of the service steps.
const (
	// appTimeout bounds a command of the app (node app/cli.mjs).
	appTimeout = 10 * time.Minute
	// healthWait is how long the start waits for the website to answer /api/health
	// (docs/plan/07-server-install-update.md section 3, as xmtp-panel's waitReady), and
	// healthPoll how often it asks.
	healthWait = 45 * time.Second
	healthPoll = time.Second
	// healthTimeout bounds one request of the health check.
	healthTimeout = 3 * time.Second
)

// readConfig reads and checks /etc/xdesign/config.toml (GO-02's config).
func (r *run) readConfig() (*config.Config, error) {
	data, err := r.sys.FS.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", configPath, err)
	}
	cfg, err := config.Parse(data, configPath)
	if err != nil {
		return nil, fmt.Errorf("%s exists but is not valid: %w. Fix it, or move it away so the installer writes a new one, "+
			"then run the installer again", configPath, err)
	}
	return cfg, nil
}

// stepMigrations is step 10: the database's migrations (`node app/cli.mjs migrate`), which
// make the database on a new site.
func (r *run) stepMigrations() Step {
	return Step{
		Num: "10", ID: "migrations", Title: "Database migrations",
		Act: func(ctx context.Context, env *Env) error {
			_, err := env.Run(ctx, appCmd("migrate"))
			return err
		},
	}
}

// ownerPasswordRE finds the generated password in what init-owner prints: "Sign in with
// <username> and this password. It is shown only now: <password>. Change it under Account."
var ownerPasswordRE = regexp.MustCompile(`It is shown only now: ([A-Za-z0-9]+)\.`)

// siteOwner returns the username of the site owner as `node app/cli.mjs list-users` lists
// it, "" when the site has none yet.
func siteOwner(ctx context.Context, env *Env) (string, error) {
	cmd := appCmd("list-users")
	res, err := env.Query(ctx, cmd)
	if err != nil {
		return "", err
	}
	if err := res.Err(cmd); err != nil {
		return "", err
	}
	return ownerInList(res.Out()), nil
}

// ownerInList finds the site owner in the table of list-users: Username, Name, Role ("site
// owner" or "member"), Status ("active" or "disabled"), Last seen ("never" or a date and a
// time). The columns are read from the end, so a name with spaces does not matter.
func ownerInList(table string) string {
	for i, line := range strings.Split(table, "\n") {
		f := strings.Fields(line)
		if i == 0 || len(f) < 5 {
			continue // the header, or "No one has an account yet."
		}
		end := len(f) - 2 // the date and the time
		if f[len(f)-1] == "never" {
			end = len(f) - 1
		}
		end-- // the status
		if end >= 3 && f[end-2] == "site" && f[end-1] == "owner" {
			return f[0]
		}
	}
	return ""
}

// stepOwner is step 11: the site owner (`node app/cli.mjs init-owner`), whose generated
// password the end shows once. A site that has its owner keeps it.
func (r *run) stepOwner() Step {
	return Step{
		Num: "11", ID: "owner", Title: "Owner account",
		Check: func(ctx context.Context, env *Env) (string, error) {
			username, err := siteOwner(ctx, env)
			if err != nil || username == "" {
				return "", err
			}
			r.ownerUsername = username
			return "the site has its owner, " + username, nil
		},
		Act: func(ctx context.Context, env *Env) error {
			if r.owner.Username == "" {
				return errors.New("the site has no owner: run the installer again and answer its owner questions " +
					"(or give --owner-name)")
			}
			cmd := appCmd("init-owner", "--username", r.owner.Username, "--name", r.owner.Name)
			cmd.SecretOutput = true // it prints the password
			res, err := env.Run(ctx, cmd)
			if err != nil || env.DryRun {
				return err
			}
			m := ownerPasswordRE.FindStringSubmatch(res.Out())
			if m == nil {
				return fmt.Errorf("init-owner made the owner %s but printed no password; make a new one with "+
					"%sxdesign admin reset-password %s", r.owner.Username, adminPrefix, r.owner.Username)
			}
			r.password = m[1]
			env.Masker().Add(r.password)
			return nil
		},
	}
}

// healthURL is the address at which the front answers /api/health on this server: its
// listen address, at 127.0.0.1 for every address, under the web base path
// (https://127.0.0.1:34567/k3v9x2m1q8wz7r4t/api/health), since the front answers the
// empty page outside it.
func healthURL(c *config.Config) string {
	host, port, err := net.SplitHostPort(c.Listen)
	if err != nil {
		host, port = "", strconv.Itoa(httpsPort)
	}
	if host == "" || host == "0.0.0.0" || host == "::" {
		host = "127.0.0.1"
	}
	return "https://" + net.JoinHostPort(host, port) + c.BasePath + "api/health"
}

// healthy asks the front for /api/health once: the app answers {"ok": true} once it is
// ready, and the front's starting page answers 503 until then.
func (r *run) healthy(ctx context.Context, url string) error {
	if r.in.Get == nil {
		return errors.New("the health check is not available")
	}
	return checkHealth(ctx, r.in.Get, url, r.cfg.Domain)
}

// CheckHealth asks the front of the site cfg for /api/health once, as the installer's
// health check does (`xdesign status`).
func CheckHealth(ctx context.Context, get func(ctx context.Context, url, host string) (int, []byte, error), cfg *config.Config) error {
	return checkHealth(ctx, get, healthURL(cfg), cfg.Domain)
}

// checkHealth asks url once with get, with domain as the Host header and the TLS server
// name.
func checkHealth(ctx context.Context, get func(ctx context.Context, url, host string) (int, []byte, error), url, domain string) error {
	gctx, cancel := context.WithTimeout(ctx, healthTimeout)
	defer cancel()
	status, body, err := get(gctx, url, domain)
	if err != nil {
		return err
	}
	if status != 200 {
		return fmt.Errorf("GET %s: HTTP %d", url, status)
	}
	var health struct {
		OK bool `json:"ok"`
	}
	if err := json.Unmarshal(body, &health); err != nil || !health.OK {
		return fmt.Errorf("GET %s answered %q", url, strings.TrimSpace(string(body)))
	}
	return nil
}

// stepFinish is step 17: record the installation in install.json.
func (r *run) stepFinish() Step {
	return Step{
		Num: "17", ID: "finish", Title: "Finish",
		Act: func(_ context.Context, env *Env) error {
			r.state.Status = StateInstalled
			r.state.CurrentVersion = r.version
			r.state.History = append(r.state.History, HistoryEntry{
				At: r.now().Format(time.RFC3339), Action: r.historyAction(), Version: r.version,
			}.withTimes(r.progress))
			return env.Do("write "+StatePath+` with "status": "installed" (`+stateFileWords+")", func() error {
				return WriteState(r.sys.FS, r.state)
			})
		},
	}
}

// saveState writes install.json in the middle of a run, so later runs know what this
// one did; dry runs write nothing.
func (r *run) saveState(env *Env) error {
	if env.DryRun {
		return nil
	}
	return WriteState(r.sys.FS, r.state)
}
