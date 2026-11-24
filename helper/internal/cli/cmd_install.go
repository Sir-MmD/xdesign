package cli

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/install"
)

// installFlagsUsage ends the installer's usage (installUsage, in cmd_install_linux.go and
// cmd_install_windows.go): its flags, the same on both systems.
const installFlagsUsage = `
Flags:
  --yes                    ask nothing: take the flags and the defaults (the site's
                           address is this server's IP address without --domain)
  --json                   progress as JSON lines on standard error, one result
                           object on standard output (needs --yes). A "step" line
                           comes when a step starts and when it ends and a "progress"
                           line while it runs; both carry "percent": how far the whole
                           installation is, from 0 to 100
  --dry-run                print the plan and every command, change nothing
  --domain NAME            the site's domain (for example design.example.com)
  --port N                 serve HTTPS on port N instead of a random free port
  --base-path PATH         the web base path the site answers under (for example
                           /k3v9x2m1q8wz7r4t/) instead of a random one
  --owner-username NAME    the site owner's username, for --yes (default owner)
  --owner-name NAME        the site owner's name, for --yes
  --https METHOD           the HTTPS certificate of a site with a domain name, for
                           --yes: letsencrypt (over port 80), cloudflare (Let's
                           Encrypt through Cloudflare DNS) or builtin; without it,
                           Let's Encrypt over port 80 when port 80 is free, else the
                           built-in certificate. Let's Encrypt is asked once the site
                           runs; if it fails, the site keeps its built-in certificate
  --cloudflare-token TOKEN the Cloudflare API token of --https cloudflare: Zone Read
                           and DNS Edit for the domain's zone
  --no-color               no colors (also NO_COLOR=1; FORCE_COLOR=1 forces them)
  --log FILE               log file (default ` + install.DefaultLogPath + `)
`

// RunInstall is `xdesign --install`: the flags, then install.Installer.
func RunInstall(ctx context.Context, env *Env, args []string) int {
	var o install.Options
	fs := flag.NewFlagSet("xdesign --install", flag.ContinueOnError)
	fs.SetOutput(env.Stderr)
	fs.Usage = func() { fmt.Fprint(env.Stderr, installUsage) }
	fs.BoolVar(&o.Yes, "yes", false, "")
	fs.BoolVar(&o.JSON, "json", false, "")
	fs.BoolVar(&o.DryRun, "dry-run", false, "")
	fs.StringVar(&o.Domain, "domain", "", "")
	fs.IntVar(&o.Port, "port", 0, "")
	fs.StringVar(&o.BasePath, "base-path", "", "")
	fs.StringVar(&o.OwnerUsername, "owner-username", "", "")
	fs.StringVar(&o.OwnerName, "owner-name", "", "")
	fs.StringVar(&o.HTTPS, "https", "", "")
	fs.StringVar(&o.CloudflareToken, "cloudflare-token", "", "")
	fs.BoolVar(&o.NoColor, "no-color", false, "")
	fs.StringVar(&o.LogPath, "log", "", "")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return ExitOK
		}
		return ExitUsage
	}
	if fs.NArg() > 0 {
		fmt.Fprintf(env.Stderr, "xdesign --install: unexpected argument %q\n", fs.Arg(0))
		return ExitUsage
	}
	// A path given relative to the folder the owner is in.
	if o.LogPath != "" && !filepath.IsAbs(o.LogPath) {
		abs, err := filepath.Abs(o.LogPath)
		if err != nil {
			fmt.Fprintf(env.Stderr, "xdesign --install: %v\n", err)
			return ExitUsage
		}
		o.LogPath = abs
	}
	if err := o.Validate(); err != nil {
		fmt.Fprintf(env.Stderr, "xdesign --install: %v\n", strings.TrimPrefix(err.Error(), install.ErrUsage.Error()+": "))
		return ExitUsage
	}
	// The messages name the command that runs the installer again: this file with
	// --install, or the installed xdesign on the PATH.
	program := executablePath(env)
	rerun := installRerun(program)
	inst := &install.Installer{
		Sys: env.System, Build: env.Build, Rand: env.Rand,
		Stdin: env.Stdin, Stdout: env.Stdout, Stderr: env.Stderr, Terminal: env.Terminal,
		Color: install.UseColor(env.Terminal, o.NoColor, env.Getenv), Rerun: rerun, Program: program,
		// The check that the domain points to this server, and the health check.
		LookupIP: env.LookupIP, Get: env.Get, Upgrade: env.Upgrade,
	}
	if f, ok := env.Stdin.(*os.File); ok && isTerminalFile(f) {
		// The Cloudflare API token is typed without being shown.
		inst.EchoOff = func() (func(), error) { return echoOff(f) }
	}
	code := inst.Run(ctx, o)
	holdWindow(env)
	return code
}

// executablePath returns the path of the running file with its links resolved, "" when
// it cannot be told.
func executablePath(env *Env) string {
	if env.Executable == nil {
		return ""
	}
	exe, err := env.Executable()
	if err != nil {
		return ""
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	return exe
}
