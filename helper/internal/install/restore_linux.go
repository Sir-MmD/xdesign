package install

import (
	"context"
	"fmt"
	"time"

	"github.com/Sir-MmD/xdesign/helper/deploy"
	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
)

// The backup units (section 5.1): xdesign-backup.timer starts xdesign-backup.service at
// 03:30 every day.
const (
	backupService = "xdesign-backup.service"
	backupTimer   = "xdesign-backup.timer"
)

// backupUnits returns the embedded backup units, by name.
func backupUnits() (map[string][]byte, error) {
	out := map[string][]byte{}
	for _, name := range []string{backupService, backupTimer} {
		data, err := deploy.Unit(name)
		if err != nil {
			return nil, err
		}
		out[name] = data
	}
	return out, nil
}

// Stop stops xdesign.service.
func (s Service) Stop(ctx context.Context) error {
	return s.run(ctx, host.Command("systemctl", "stop", serviceUnit))
}

// Start starts xdesign.service and waits until the website answers /api/health under the
// web base path of config.toml, up to 45 seconds (as the installer's start).
func (s Service) Start(ctx context.Context) error {
	_ = s.run(ctx, host.Command("systemctl", "reset-failed", serviceUnit)) // fails for a unit that did not fail
	if err := s.run(ctx, host.Command("systemctl", "start", serviceUnit)); err != nil {
		return err
	}
	if s.Get == nil {
		return nil
	}
	data, err := s.Sys.FS.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("read %s: %w", configPath, err)
	}
	cfg, err := config.Parse(data, configPath)
	if err != nil {
		return err
	}
	url := healthURL(cfg)
	start := time.Now()
	var last error
	for {
		res, err := s.Sys.Runner.Run(ctx, host.Command("systemctl", "is-active", serviceUnit))
		switch state := res.Out(); {
		case err != nil:
			last = err
		case state == "failed":
			return fmt.Errorf("%s failed to start; its journal says why: journalctl -u xdesign -n 50 --no-pager", serviceUnit)
		case state != "active":
			last = fmt.Errorf("%s is %s", serviceUnit, state)
		default:
			if last = checkHealth(ctx, s.Get, url, cfg.Domain); last == nil {
				return nil
			}
		}
		if time.Since(start) >= healthWait {
			return fmt.Errorf("the website did not answer within %s (last: %w); see journalctl -u xdesign -n 50 --no-pager",
				formatElapsed(healthWait), last)
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("interrupted while waiting for the website to answer: %w", ctx.Err())
		case <-time.After(healthPoll):
		}
	}
}
