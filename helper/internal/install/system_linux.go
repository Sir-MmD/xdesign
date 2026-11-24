package install

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/fs"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/deploy"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// stepSystemUser is step 2: the xdesign system user through systemd-sysusers, with the
// definition the xdesign file carries (deploy/sysusers/xdesign.conf).
func (r *run) stepSystemUser() Step {
	return Step{
		Num: "2", ID: "system-user", Title: "System user",
		Check: func(context.Context, *Env) (string, error) {
			want, err := deploy.Sysusers()
			if err != nil {
				return "", err
			}
			have, err := r.sys.FS.ReadFile(sysusersPath)
			if err != nil && !errors.Is(err, fs.ErrNotExist) {
				return "", fmt.Errorf("read %s: %w", sysusersPath, err)
			}
			_, right, err := fileState(r.sys.FS, sysusersPath, 0o644, host.Root())
			if err != nil {
				return "", err
			}
			if _, _, err := r.sys.Users.LookupUser(serviceUser); err != nil {
				if errors.Is(err, host.ErrUnknownUser) {
					return "", nil
				}
				return "", err
			}
			if !right || !bytes.Equal(want, have) {
				return "", nil
			}
			return "the user xdesign exists", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			data, err := deploy.Sysusers()
			if err != nil {
				return err
			}
			err = env.Do("install -D -m 0644 -o root -g root sysusers/xdesign.conf "+sysusersPath, func() error {
				if err := r.sys.FS.MkdirAll("/etc/sysusers.d", 0o755); err != nil {
					return err
				}
				return r.sys.FS.WriteFile(sysusersPath, data, 0o644, host.Root())
			})
			if err != nil {
				return err
			}
			_, err = env.Run(ctx, host.Command("systemd-sysusers", sysusersPath))
			return err
		},
		Verify: func(context.Context, *Env) error {
			if _, _, err := r.sys.Users.LookupUser(serviceUser); err != nil {
				return fmt.Errorf("systemd-sysusers ran, but %w", err)
			}
			if _, err := r.sys.Users.LookupGroup(serviceUser); err != nil {
				return fmt.Errorf("systemd-sysusers ran, but %w", err)
			}
			return nil
		},
	}
}

// dirGroup is one `install -d` command of step 3: folders with the same mode and
// owner.
type dirGroup struct {
	Perm         fs.FileMode
	Owner, Group string
	Paths        []string
}

// dirGroups are the folders of section 3, parents first: the program files, the settings
// (the group reads config.toml) and the data, which only xdesign opens.
func dirGroups() []dirGroup {
	return []dirGroup{
		{Perm: 0o755, Owner: "root", Group: "root", Paths: []string{optDir, releasesDir}},
		{Perm: 0o750, Owner: "root", Group: serviceUser, Paths: []string{etcDir}},
		{Perm: 0o750, Owner: serviceUser, Group: serviceUser, Paths: []string{dataDir}},
	}
}

func (g dirGroup) cmd() host.Cmd {
	args := []string{"-d", "-m", fmt.Sprintf("%04o", g.Perm), "-o", g.Owner, "-g", g.Group}
	return host.Command("install", append(args, g.Paths...)...)
}

// wrongDirs returns the folders of g that are missing or have another mode or owner.
// Symbolic links to folders are accepted (a data folder moved to another disk).
func (r *run) wrongDirs(g dirGroup) ([]string, error) {
	sys := r.sys
	uid, _, err := sys.Users.LookupUser(g.Owner)
	if err != nil {
		return g.Paths, nil //nolint:nilerr // the user does not exist yet: every folder needs the act
	}
	gid, err := sys.Users.LookupGroup(g.Group)
	if err != nil {
		return g.Paths, nil //nolint:nilerr // as above, for the group
	}
	var wrong []string
	for _, p := range g.Paths {
		fi, err := sys.FS.Stat(p)
		if errors.Is(err, fs.ErrNotExist) {
			wrong = append(wrong, p)
			continue
		}
		if err != nil {
			return nil, fmt.Errorf("check %s: %w", p, err)
		}
		o, err := sys.FS.Owner(p)
		if err != nil {
			return nil, fmt.Errorf("check %s: %w", p, err)
		}
		if !fi.IsDir() {
			return nil, fmt.Errorf("%s exists but is not a folder; move it away and run the installer again", p)
		}
		if fi.Mode().Perm() != g.Perm || o != (host.Owner{UID: uid, GID: gid}) {
			wrong = append(wrong, p)
		}
	}
	return wrong, nil
}

// stepDirectories is step 3: the folders with their owners and modes.
func (r *run) stepDirectories() Step {
	return Step{
		Num: "3", ID: "directories", Title: "Folders",
		Check: func(context.Context, *Env) (string, error) {
			for _, g := range dirGroups() {
				wrong, err := r.wrongDirs(g)
				if err != nil || len(wrong) > 0 {
					return "", err
				}
			}
			return "every folder has the right owner and mode", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			for _, g := range dirGroups() {
				wrong, err := r.wrongDirs(g)
				if err != nil {
					return err
				}
				if len(wrong) == 0 {
					continue
				}
				if _, err := env.Run(ctx, g.cmd()); err != nil {
					return err
				}
			}
			return nil
		},
	}
}

// selinuxPaths are the trees the installer relabels: the program files, the settings and
// the data.
func selinuxPaths() []string {
	return []string{optDir, etcDir, dataDir}
}

// programLabel returns the SELinux context of an installed program.
func (r *run) programLabel(ctx context.Context, env *Env, program string) (string, error) {
	cmd := host.Command("stat", "-c", "%C", program)
	res, err := env.Query(ctx, cmd)
	if err != nil {
		return "", err
	}
	if err := res.Err(cmd); err != nil {
		return "", err
	}
	return res.Out(), nil
}

// pendingRelabels returns the files restorecon would relabel.
func (r *run) pendingRelabels(ctx context.Context, env *Env) ([]string, error) {
	cmd := host.Command("restorecon", append([]string{"-R", "-F", "-n", "-v"}, selinuxPaths()...)...)
	res, err := env.Query(ctx, cmd)
	if err != nil {
		return nil, err
	}
	if err := res.Err(cmd); err != nil {
		return nil, err
	}
	var files []string
	for line := range strings.SplitSeq(string(res.Stdout), "\n") {
		rest, ok := strings.CutPrefix(strings.TrimSpace(line), "Would relabel ")
		if !ok {
			continue
		}
		file, _, _ := strings.Cut(rest, " from ")
		// The program keeps the type the chcon fallback gave it.
		if r.state.SELinux.ChconFallback && strings.HasSuffix(file, "/"+releaseSelf) {
			continue
		}
		files = append(files, file)
	}
	return files, nil
}

// stepSELinux is step 5: relabel the xDesign folders and make sure the xdesign file has
// the type bin_t, which systemd needs to start it, with chcon when the policy does not
// give it. The installer never disables SELinux.
func (r *run) stepSELinux() Step {
	return Step{
		Num: "5", ID: "selinux", Title: "SELinux labels",
		Check: func(ctx context.Context, env *Env) (string, error) {
			if r.selinux == "" {
				return "SELinux is off", nil
			}
			pending, err := r.pendingRelabels(ctx, env)
			if err != nil || len(pending) > 0 {
				return "", err
			}
			label, err := r.programLabel(ctx, env, currentBin)
			if err != nil || !strings.Contains(label, selinuxBinType) {
				return "", err
			}
			return "the labels are correct", nil
		},
		Act: func(ctx context.Context, env *Env) error {
			restorecon := host.Command("restorecon", append([]string{"-R", "-F"}, selinuxPaths()...)...)
			if _, err := env.runWaiting(ctx, "labeling the files for SELinux", restorecon); err != nil {
				return err
			}
			if env.DryRun {
				env.Plan("stat -c %C " + currentBin + "   # must contain :bin_t:, otherwise chcon -t bin_t " + currentBin)
				return nil
			}
			label, err := r.programLabel(ctx, env, currentBin)
			if err != nil || strings.Contains(label, selinuxBinType) {
				return err
			}
			if _, err := env.Run(ctx, host.Command("chcon", "-t", "bin_t", currentBin)); err != nil {
				return err
			}
			env.Warnf("the SELinux policy did not give the xdesign file the type bin_t (it had %s), so the installer set it with chcon. "+
				"A relabel would undo it; the installer sets it again whenever it runs", label)
			r.state.SELinux.ChconFallback = true
			return r.saveState(env)
		},
		Verify: func(ctx context.Context, env *Env) error {
			label, err := r.programLabel(ctx, env, currentBin)
			if err != nil {
				return err
			}
			if !strings.Contains(label, selinuxBinType) {
				return fmt.Errorf("the xdesign file has the SELinux context %s, not the type bin_t; systemd could not start it (status=203/EXEC)",
					label)
			}
			return nil
		},
	}
}

// runsAs names the account the site runs as, for the summary.
const runsAs = "the system user " + serviceUser

// makeConfigDir makes /etc/xdesign root:root 0750 when install.json is the first thing
// written there.
func makeConfigDir(fsys host.FS) error {
	if err := fsys.MkdirAll(etcDir, 0o750); err != nil {
		return err
	}
	return fsys.Chmod(etcDir, 0o750)
}
