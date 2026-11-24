package install

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io/fs"

	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// The installed files of the units, which only Linux has.

// sameFile reports whether dst exists as root:root 0644 with the content want.
func sameFile(fsys host.FS, dst string, want []byte) (bool, error) {
	exists, right, err := fileState(fsys, dst, 0o644, host.Root())
	if err != nil || !exists || !right {
		return false, err
	}
	have, err := fsys.ReadFile(dst)
	if err != nil {
		return false, fmt.Errorf("read %s: %w", dst, err)
	}
	return bytes.Equal(want, have), nil
}

// fileState reports whether the file at p exists with perm and owner.
func fileState(fsys host.FS, p string, perm fs.FileMode, owner host.Owner) (exists, right bool, err error) {
	fi, err := fsys.Lstat(p)
	if errors.Is(err, fs.ErrNotExist) {
		return false, false, nil
	}
	if err != nil {
		return false, false, fmt.Errorf("check %s: %w", p, err)
	}
	if !fi.Mode().IsRegular() {
		return true, false, fmt.Errorf("%s is not a regular file", p)
	}
	o, err := fsys.Owner(p)
	if err != nil {
		return true, false, fmt.Errorf("check %s: %w", p, err)
	}
	return true, fi.Mode().Perm() == perm && o == owner, nil
}

// unitActive reports whether unit is active (or starting or stopping), and its state.
func unitActive(ctx context.Context, env *Env, unit string) (bool, string, error) {
	res, err := env.Query(ctx, host.Command("systemctl", "is-active", unit))
	if err != nil {
		return false, "", err
	}
	state := res.Out()
	switch state {
	case "active", "activating", "deactivating", "reloading", "refreshing":
		return true, state, nil
	}
	return false, state, nil
}
