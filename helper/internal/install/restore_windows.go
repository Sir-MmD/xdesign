package install

import (
	"context"
	"fmt"
	"time"

	"golang.org/x/sys/windows/svc"
)

// The Windows parts of a restore's service (Service, restore.go): the service xdesign
// stopped and started through the service manager, as the update does
// (docs/plan/18-third-owner-list-2026-11-23.md section 8.5).

// Stop stops the service xdesign and waits until it stopped; a restart Windows planned
// after a failure is waited for and stopped too (stopSite).
func (s Service) Stop(ctx context.Context) error {
	return stopSite(ctx)
}

// Start starts the service xdesign and waits until the website answers /api/health under
// the web base path of config.toml, up to 45 seconds (as the installer's start). A service
// that stops on the way is waited for, as Windows restarts it (its failure actions).
func (s Service) Start(ctx context.Context) error {
	if err := startWindowsService(serviceName); err != nil {
		return err
	}
	if s.Get == nil {
		return nil
	}
	cfg, err := readSiteConfig(s.Sys.FS)
	if err != nil {
		return err
	}
	url := healthURL(cfg)
	start := time.Now()
	var last error
	for {
		state, _, err := serviceState(serviceName)
		switch {
		case err != nil:
			last = err
		case state != svc.Running:
			last = fmt.Errorf("the service %s is %s; its log says why: xdesign logs --lines 50", serviceName, stateWords(state))
		default:
			if last = checkHealth(ctx, s.Get, url, cfg.Domain); last == nil {
				return nil
			}
		}
		if time.Since(start) >= healthWait {
			return fmt.Errorf("the website did not answer within %s (last: %w); see Get-Service %s and xdesign logs --lines 50",
				formatElapsed(healthWait), last, serviceName)
		}
		select {
		case <-ctx.Done():
			return fmt.Errorf("interrupted while waiting for the website to answer: %w", ctx.Err())
		case <-time.After(healthPoll):
		}
	}
}
