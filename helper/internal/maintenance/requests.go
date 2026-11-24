package maintenance

import (
	"context"
	"errors"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/maintreq"
)

// The other requests of the root helper: "Restore" on a backup of Maintenance > Backups
// (docs/plan/07-server-install-update.md section 5.4), the domain of Settings > HTTPS
// (section 4), the port and web base path of Settings > Site address
// (docs/plan/17-second-owner-list-2026-11-23.md section 6) and Maintenance > Uninstall
// xDesign (docs/plan/19-uninstall-2026-11-24.md section 5). The helper carries them out as
// root: a restore with backup.Restore, the domain change with config.toml and a restart,
// the address change with set-port and set-path, the uninstall by starting xdesign
// --uninstall detached from itself. GET /maintenance follows them, as it follows an
// update.

// StartRestore asks the root helper to put the backup name of the backups' folder back
// ("Restore", after "Confirm it's you"). It refuses a backup that is not listed, and one of
// a newer xDesign.
func (u *Updates) StartRestore(ctx context.Context, name string) (maintreq.Request, error) {
	if !backup.ValidName(name) {
		return maintreq.Request{}, refused(RefusedInvalid, "There is no backup named %s.", name)
	}
	e, _, err := backup.Find(backup.Options{DataDir: u.dataDir}.Dir(), name)
	switch {
	case errors.Is(err, backup.ErrNotFound):
		return maintreq.Request{}, refused(RefusedInvalid, "There is no backup named %s.", name)
	case err != nil:
		return maintreq.Request{}, refused(RefusedNotNow, "%s", sentence("The backup "+name+" cannot be read: "+err.Error()))
	}
	if err := backup.CheckVersion(backup.Meta{Version: e.Version}, u.build.Version); err != nil {
		return maintreq.Request{}, refused(RefusedNotNow, "%s", sentence(upperFirst(err.Error())))
	}
	return u.h.Submit(ctx, maintreq.Request{Kind: maintreq.KindRestore, Restore: &maintreq.RestoreRequest{Backup: name}})
}

// StartDomain asks the root helper to change the site's domain (Settings > HTTPS): a
// domain name, or the server's IP address.
func (u *Updates) StartDomain(ctx context.Context, domain string) (maintreq.Request, error) {
	d, err := config.CheckDomain(domain)
	switch {
	case err != nil:
		return maintreq.Request{}, refused(RefusedInvalid, "%s", sentence(upperFirst(err.Error())))
	case d == u.domain:
		return maintreq.Request{}, refused(RefusedNotNow, "xDesign already uses %s.", d)
	}
	return u.h.Submit(ctx, maintreq.Request{Kind: maintreq.KindDomain, Domain: &maintreq.DomainRequest{Domain: d}})
}

// httpPort is the port of the front's HTTP answers, which cannot serve HTTPS.
const httpPort = 80

// minProbedPort is the first port the front, as the xdesign user, can open to see whether
// it is free; the root helper checks a lower one.
const minProbedPort = 1024

// StartAddress asks the root helper to move the site to the port and the web base path
// (Settings > Site address, "Change address" after "Confirm it's you"); the website sends
// both, the one from before for the part that does not change. A new web base path follows
// the installer's rule, and only the one in use may be /.
func (u *Updates) StartAddress(ctx context.Context, port int, basePath string) (maintreq.Request, error) {
	switch {
	case port < 1 || port > 65535:
		return maintreq.Request{}, refused(RefusedInvalid, "Give a port number from 1 to 65535.")
	case port == httpPort:
		return maintreq.Request{}, refused(RefusedInvalid, "Port 80 cannot serve HTTPS; choose another one.")
	case basePath != u.basePath && (basePath == "/" || config.CheckBasePath(basePath) != nil):
		return maintreq.Request{}, refused(RefusedInvalid, "The path starts and ends with / and has 1 to 3 parts of 4 to 64 letters, "+
			"digits, - or _, for example /k3v9x2m1q8wz7r4t/.")
	case port == u.port && basePath == u.basePath:
		return maintreq.Request{}, refused(RefusedNotNow, "xDesign already uses this address.")
	case port != u.port && port >= minProbedPort && u.machine.ProbePort(ctx, "", port) != nil:
		return maintreq.Request{}, refused(RefusedNotNow, "Port %d is in use; choose another one.", port)
	case backup.Running(backup.Options{DataDir: u.dataDir}.Dir()):
		return maintreq.Request{}, refused(RefusedNotNow, "A backup is running. Try again when it ends.")
	}
	req := maintreq.Request{Kind: maintreq.KindAddress, Address: &maintreq.AddressRequest{Port: port, BasePath: basePath}}
	return u.h.Submit(ctx, req)
}

// StartUninstall asks the root helper to uninstall xDesign (Maintenance > Uninstall
// xDesign, after "Confirm it's you"): keepData is "Keep the data", otherwise "Remove
// everything". The panel offered its own backup, so the uninstall makes none. It refuses
// while a backup runs, which stopping xDesign would cut off.
func (u *Updates) StartUninstall(ctx context.Context, keepData bool) (maintreq.Request, error) {
	if backup.Running(backup.Options{DataDir: u.dataDir}.Dir()) {
		return maintreq.Request{}, refused(RefusedNotNow, "A backup is running. Try again when it ends.")
	}
	req := maintreq.Request{Kind: maintreq.KindUninstall, Uninstall: &maintreq.UninstallRequest{KeepData: keepData}}
	return u.h.Submit(ctx, req)
}

// upperFirst starts text with a capital letter.
func upperFirst(text string) string {
	if text == "" {
		return text
	}
	return strings.ToUpper(text[:1]) + text[1:]
}
