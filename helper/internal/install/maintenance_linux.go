package install

import (
	"context"
	"path"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/maintreq"
)

// The units of the maintenance helper (docs/plan/07-server-install-update.md section 6),
// copied from xWriter's install/maintenance.go: xdesign-maintenance.path watches for the
// requests of Maintenance > Update and starts xdesign-maintenance.service, the root helper
// `xdesign admin maintenance --request`. The installer and the update install and enable
// them like the backup units.
const (
	maintenancePath    = maintreq.PathUnit
	maintenanceService = maintreq.ServiceUnit
)

// maintenanceUnitNames are the units of the maintenance helper in the order they are
// installed.
func maintenanceUnitNames() []string {
	return []string{maintenanceService, maintenancePath}
}

// enableMaintenancePath turns on the watch for the maintenance asked for in the website
// after the units were installed, unless the owner masked it.
func enableMaintenancePath(ctx context.Context, env *Env, fsys host.FS) {
	if !env.DryRun && !exists(fsys, path.Join(unitDir, maintenancePath)) {
		return
	}
	if res, err := env.Query(ctx, host.Command("systemctl", "is-enabled", maintenancePath)); err == nil {
		switch state := res.Out(); {
		case state == "enabled":
			return
		case strings.HasPrefix(state, "masked"):
			env.Notef("updates and rollbacks from the website stay off, as you left them (%s is masked)", maintenancePath)
			return
		}
	}
	if _, err := env.Run(ctx, host.Command("systemctl", "enable", "--now", maintenancePath)); err != nil {
		env.Warnf("could not turn on updates and rollbacks from the website: %v. Turn them on with: systemctl enable --now %s",
			err, maintenancePath)
		return
	}
	env.Notef("updates and rollbacks from the website are on (%s)", maintenancePath)
}
