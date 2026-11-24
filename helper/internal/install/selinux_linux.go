package install

import (
	"context"
	"fmt"
	"slices"
	"strconv"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// semanageTimeout bounds semanage, which rebuilds the policy.
const semanageTimeout = 5 * time.Minute

// stepSELinuxNetwork is step 12: the label of the site's port that the owner allowed.
func (r *run) stepSELinuxNetwork() Step {
	return Step{
		Num: "12", ID: "selinux-network", Title: "SELinux network",
		Check: func(ctx context.Context, env *Env) (string, error) {
			if r.labelPort == 0 {
				return "nothing to change", nil
			}
			if label, err := portLabel(ctx, env, r.labelPort); err != nil || label != selinuxPortType {
				return "", err
			}
			return "set", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			label, err := portLabel(ctx, env, r.labelPort)
			if err != nil && !env.DryRun {
				return err
			}
			flag := semanageFlag(label)
			cmd := host.Command("semanage", "port", flag, "-t", selinuxPortType, "-p", "tcp", strconv.Itoa(r.labelPort))
			if _, err := env.runWaiting(ctx, fmt.Sprintf("labeling port %d for SELinux", r.labelPort), cmd); err != nil {
				return err
			}
			list := &r.state.SELinux.PortsAdded
			if flag == "-m" {
				list = &r.state.SELinux.PortsModified
			}
			if !slices.Contains(*list, r.labelPort) {
				*list = append(*list, r.labelPort)
			}
			return r.saveState(env)
		},
	}
}
