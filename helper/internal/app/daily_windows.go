package app

import (
	"context"
	"log/slog"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
)

// The daily backup on Windows (docs/plan/18-third-owner-list-2026-11-23.md section 8.2,
// D-749): serve makes it at 03:30 server time, with the rule of Linux's
// xdesign-backup.timer (OnCalendar=*-*-* 03:30:00, AccuracySec=1min, Persistent=true).
const (
	dailyHour   = 3
	dailyMinute = 30
	// dailyCheck is how often the clock is read: a clock set forward, or a server that
	// slept past 03:30, makes the backup at the next reading.
	dailyCheck = time.Minute
)

// dailyBackups makes one daily backup a day at 03:30 local time until ctx ends, through
// the same code as `xdesign backup --daily`, and logs it. As the timer's Persistent=true,
// one missed while serve did not run is made at its start: when a 03:30 passed after the
// newest daily backup. Without any daily backup yet, the first one waits for 03:30.
func dailyBackups(ctx context.Context, o backup.Options, log *slog.Logger) {
	log = log.With("part", "backup")
	now := time.Now()
	if newest, ok := newestDaily(o, log); ok && newest.Before(lastDailyTime(now)) {
		log.Info("making the daily backup missed while xdesign did not run", "missed_at", lastDailyTime(now))
		makeDaily(ctx, o, log)
	}
	next := nextDailyTime(time.Now())
	log.Info("next daily backup", "at", next)
	t := time.NewTicker(dailyCheck)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		if time.Now().Before(next) {
			continue
		}
		makeDaily(ctx, o, log)
		next = nextDailyTime(time.Now())
		log.Info("next daily backup", "at", next)
	}
}

// makeDaily makes one daily backup and logs what it made, or why it failed.
func makeDaily(ctx context.Context, o backup.Options, log *slog.Logger) {
	res, err := backup.Make(ctx, o, backup.KindDaily)
	if err != nil && res.Path == "" {
		if ctx.Err() != nil {
			log.Info("the daily backup was stopped with xdesign serve")
			return
		}
		log.Error("the daily backup failed", "error", err.Error())
		return
	}
	log.Info("daily backup made", "path", res.Path, "size", res.Backup.Size, "deleted", res.Deleted)
	if err != nil {
		log.Warn("the daily backup was made, but deleting older backups failed", "error", err.Error())
	}
}

// newestDaily returns when the newest daily backup was made; false when there is none, or
// when the backups cannot be listed.
func newestDaily(o backup.Options, log *slog.Logger) (time.Time, bool) {
	l, err := backup.List(o.Dir())
	if err != nil {
		log.Warn("the backups cannot be listed", "error", err.Error())
		return time.Time{}, false
	}
	for _, e := range l.Backups { // newest first
		if e.Kind == backup.KindDaily {
			return e.CreatedAt, true
		}
	}
	return time.Time{}, false
}

// dailyTime returns the backup's time on t's day moved by days, in t's time zone.
func dailyTime(t time.Time, days int) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d+days, dailyHour, dailyMinute, 0, 0, t.Location())
}

// nextDailyTime returns the first 03:30 after t.
func nextDailyTime(t time.Time) time.Time {
	if at := dailyTime(t, 0); at.After(t) {
		return at
	}
	return dailyTime(t, 1)
}

// lastDailyTime returns the last 03:30 at or before t.
func lastDailyTime(t time.Time) time.Time {
	if at := dailyTime(t, 0); !at.After(t) {
		return at
	}
	return dailyTime(t, -1)
}
