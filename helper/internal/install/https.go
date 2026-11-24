package install

import (
	"context"
	"fmt"
	"net/netip"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/ssl"
)

// The site's port and web base path (docs/plan/07-server-install-update.md sections 3 and
// 4, docs/plan/16-owner-list-2026-11-23.md sections 5 and 6): xDesign always serves HTTPS
// itself, on a random free port under a random path that the installer proposes and the
// owner may change, as xWriter's installer does; ports 443 and 80 are left to other
// programs. Preflight finds whether port 80 is free for Let's Encrypt's checks, and step
// 13 writes the HTTPS manager's first state, the built-in certificate; the certificate
// step gets the one the owner chose (certificate.go).

// checkPort80 finds whether port 80 is free for Let's Encrypt's checks (section 4.1) and
// which programs hold it. A port that only root may open counts as free in a dry run by
// another user.
func (r *run) checkPort80(ctx context.Context, env *Env) {
	r.programs = listeningPrograms(ctx, env)
	err := r.sys.Machine.ProbePort(ctx, "", httpPort)
	switch {
	case err == nil:
	case portNeedsPrivilege(err):
		env.Notef("port %d is not checked: only root may open it", httpPort)
	default:
		text := strconv.Itoa(httpPort)
		if names := r.programs[httpPort]; len(names) > 0 {
			text += " (" + strings.Join(names, ", ") + ")"
		}
		env.Factf("ports", "%s in use", text)
		return
	}
	r.port80Free = true
	env.Factf("ports", "%d free", httpPort)
}

// domainIsName reports whether the site has a domain name rather than an IP address.
func (r *run) domainIsName() bool {
	_, err := netip.ParseAddr(r.cfg.Domain)
	return r.cfg.Domain != "" && err != nil
}

// heldText says which program holds port: "Another program (nginx) uses port 80".
func (r *run) heldText(port int) string {
	who := "Another program"
	if names := r.programs[port]; len(names) > 0 {
		who += " (" + strings.Join(names, ", ") + ")"
	}
	return fmt.Sprintf("%s uses port %d", who, port)
}

// chooseSite picks the site's port and web base path: --port and --base-path, else a
// random free port and a random path, which the owner confirms or replaces when ask is
// set (xWriter's planPanel and askPanel). The path / is warned about.
func (r *run) chooseSite(ctx context.Context, ask bool) error {
	port := r.opts.Port
	if port != 0 {
		if err := r.sys.Machine.ProbePort(ctx, "", port); err != nil && !r.opts.DryRun {
			return fmt.Errorf("--port %d: the port is in use; choose another one", port)
		}
	} else {
		var err error
		if port, err = RandomFreePort(ctx, r.sys.Machine, r.in.Rand, ""); err != nil {
			return err
		}
	}
	basePath := r.opts.BasePath
	if basePath == "" {
		var err error
		if basePath, err = RandomBasePath(r.in.Rand); err != nil {
			return err
		}
	}
	if ask {
		var err error
		if port, err = r.askPort(ctx, port); err != nil {
			return err
		}
		if basePath, err = r.askBasePath(basePath); err != nil {
			return err
		}
	}
	r.cfg.BasePath = basePath
	if basePath == "/" {
		r.warningf("with the web base path / anyone who finds the port finds the sign-in page; a random path is recommended")
	}
	r.applyPort(port)
	return nil
}

// askSystem asks the questions outside xDesign's own files (section 3 step 6, section
// 4.5): the firewall and SELinux. Without questions (--yes, dry runs) each takes its
// default, yes.
func (r *run) askSystem(ctx context.Context, ask bool) error {
	if err := r.askFirewall(ctx, ask); err != nil {
		return err
	}
	return r.askSELinux(ctx, ask)
}

// askPort asks the site's port, with def as the default: 443 too when it is free (the
// address then has no port), never 80.
func (r *run) askPort(ctx context.Context, def int) (int, error) {
	text, err := r.ask.ask("Site port", strconv.Itoa(def), func(s string) string {
		n, err := strconv.Atoi(s)
		switch {
		case err != nil || n < 1 || n > 65535:
			return "please give a port number from 1 to 65535"
		case n == httpPort:
			return "port 80 cannot serve HTTPS; choose another one"
		case n != def && r.sys.Machine.ProbePort(ctx, "", n) != nil:
			return fmt.Sprintf("port %d is in use; choose another one", n)
		}
		return ""
	})
	if err != nil {
		return 0, err
	}
	port, _ := strconv.Atoi(text) // valid checked it
	return port, nil
}

// askBasePath asks the web base path, with def as the default, checked as xWriter's
// CheckBasePath.
func (r *run) askBasePath(def string) (string, error) {
	return r.ask.ask("Web base path", def, func(s string) string {
		if config.CheckBasePath(s) != nil {
			return "the path starts and ends with / and has 1 to 3 parts of 4 to 64 letters, digits, - or _, for example /k3v9x2m1q8wz7r4t/"
		}
		return ""
	})
}

// applyPort sets the port in config.toml and install.json, with port 80 for Let's Encrypt
// when it is free; the HTTPS certificate question (chooseHTTPS) follows from it.
func (r *run) applyPort(port int) {
	r.cfg.Listen = ":" + strconv.Itoa(port)
	r.state.HTTPS = StateHTTPS{Port80: r.port80Free}
}

// certsDir is the HTTPS manager's folder (GO-03): <data_dir>/certs.
func (r *run) certsDir() string {
	return filepath.Join(r.cfg.DataDir, "certs")
}

// stepHTTPSMethod is step 13: the HTTPS manager's state file with the built-in
// certificate, which the site serves from its first start until the certificate step gets
// the one the owner chose (docs/plan/17-second-owner-list-2026-11-23.md section 5) or
// Settings > HTTPS chooses another. A state file that exists is the site's and is kept.
func (r *run) stepHTTPSMethod() Step {
	return Step{
		Num: "13", ID: "https-method", Title: "HTTPS method",
		Check: func(context.Context, *Env) (string, error) {
			if exists(r.sys.FS, filepath.Join(r.certsDir(), ssl.StateFile)) {
				return "the HTTPS settings are kept", nil
			}
			return "", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			data, err := ssl.FirstState(false, nil)
			if err != nil {
				return err
			}
			dir := r.certsDir()
			owner, err := r.makeCertsDir(ctx, env, dir)
			if err != nil {
				return err
			}
			file := filepath.Join(dir, ssl.StateFile)
			method := "the built-in certificate until Settings > HTTPS chooses another"
			if r.https.method.LetsEncrypt() {
				method = "the built-in certificate until Let's Encrypt issues one after the start"
			}
			err = env.Do(fmt.Sprintf("write %s (%s): %s", file, certsFileOwner, method), func() error {
				return r.sys.FS.WriteFile(file, data, 0o600, owner)
			})
			if err != nil {
				return err
			}
			env.Factf("HTTPS", "%s", method)
			r.state.HTTPS.StateFile = file
			return r.saveState(env)
		},
	}
}
