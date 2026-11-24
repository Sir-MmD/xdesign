package cli

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/host"
	"github.com/Sir-MmD/xdesign/helper/internal/install"
)

// The app's own admin commands (docs/plan/07-server-install-update.md section 7): `xdesign
// admin reset-password <username>`, `xdesign admin reset-2fa <username>` and `xdesign admin
// list-users` run `node app/cli.mjs reset-password|reset-2fa|list-users` of the installed
// release as the xdesign user with the site's environment, as the installer runs the app's
// commands, and pass on its output and its exit status; reset-2fa asks first
// (docs/plan/17-second-owner-list-2026-11-23.md section 7); they take and show usernames
// (docs/plan/18-third-owner-list-2026-11-23.md section 3.7). `sudo xdesign admin set-port`
// and `set-path` move the site later, as xWriter's commands of the same names
// (install.ChangeAddress). On Windows they all run in a terminal opened as Administrator
// (section 8.7); the usages are in cmd_admin_linux.go and cmd_admin_windows.go.

// RunAppCommand is `xdesign admin reset-password <username>`, `xdesign admin reset-2fa
// <username> [--yes]` and `xdesign admin list-users`.
func RunAppCommand(ctx context.Context, env *Env, command string, args []string) int {
	usage, want, yes := listUsersUsage, 0, false
	switch command {
	case "reset-password":
		usage, want = resetUsage, 1
	case "reset-2fa":
		usage, want = reset2faUsage, 1
		n := len(args) // --yes may come before or after the username
		args = slices.DeleteFunc(slices.Clone(args), func(a string) bool { return a == "--yes" || a == "-yes" })
		yes = len(args) < n
	}
	if len(args) > 0 && (args[0] == "-h" || args[0] == "-help" || args[0] == "--help") {
		fmt.Fprint(env.Stdout, usage)
		return ExitOK
	}
	if len(args) != want || (want == 1 && (strings.TrimSpace(args[0]) == "" || strings.HasPrefix(args[0], "-"))) {
		fmt.Fprint(env.Stderr, usage)
		return ExitUsage
	}
	if !appCommandAllowed(env) {
		fmt.Fprintf(env.Stderr, "xdesign admin %s: %s\n", command, appCommandRefusal(command))
		return ExitError
	}
	streamer, ok := env.System.Runner.(host.Streamer)
	if !ok {
		fmt.Fprintf(env.Stderr, "xdesign admin %s: this system cannot run the app's commands\n", command)
		return ExitError
	}
	if command == "reset-2fa" && !yes {
		ok, err := confirm(env, "Turn off two-factor authentication for "+strings.TrimSpace(args[0])+"?", "turn it off without asking")
		if err != nil {
			fmt.Fprintf(env.Stderr, "xdesign admin %s: %v\n", command, err)
			return ExitError
		}
		if !ok {
			fmt.Fprintln(env.Stdout, ":: Nothing was changed.")
			return ExitOK
		}
	}
	cmd := install.AppCommand(env.System.Machine.Euid() == 0, append([]string{command}, args...)...)
	code, err := streamer.Stream(ctx, cmd, env.Stdout, env.Stderr)
	switch {
	case errors.Is(err, host.ErrCommandNotFound):
		fmt.Fprintf(env.Stderr, "xdesign admin %s: %v: is xDesign installed on this server?\n", command, err)
		return ExitError
	case err != nil:
		fmt.Fprintf(env.Stderr, "xdesign admin %s: %v\n", command, err)
		return ExitError
	}
	return code
}

// RunSetPort is `sudo xdesign admin set-port PORT`.
func RunSetPort(ctx context.Context, env *Env, args []string) int {
	var o install.AddressOptions
	fs := flag.NewFlagSet("xdesign admin set-port", flag.ContinueOnError)
	fs.SetOutput(env.Stderr)
	fs.Usage = func() { fmt.Fprint(env.Stderr, setPortUsage) }
	fs.BoolVar(&o.NoFirewall, "no-firewall", false, "")
	fs.BoolVar(&o.Yes, "yes", false, "")
	fs.BoolVar(&o.JSON, "json", false, "")
	rest, code, ok := parseAnywhere(fs, args)
	if !ok {
		return code
	}
	if len(rest) != 1 {
		fmt.Fprint(env.Stderr, setPortUsage)
		return ExitUsage
	}
	port, err := strconv.Atoi(rest[0])
	if err != nil || port < 1 || port > 65535 {
		fmt.Fprintf(env.Stderr, "xdesign admin set-port: %q: please give a port number from 1 to 65535\n", rest[0])
		return ExitUsage
	}
	o.Port = port
	return updater(env, false).ChangeAddress(ctx, o)
}

// RunSetPath is `sudo xdesign admin set-path PATH | --random`.
func RunSetPath(ctx context.Context, env *Env, args []string) int {
	var o install.AddressOptions
	fs := flag.NewFlagSet("xdesign admin set-path", flag.ContinueOnError)
	fs.SetOutput(env.Stderr)
	fs.Usage = func() { fmt.Fprint(env.Stderr, setPathUsage) }
	fs.BoolVar(&o.Random, "random", false, "")
	fs.BoolVar(&o.Yes, "yes", false, "")
	fs.BoolVar(&o.JSON, "json", false, "")
	rest, code, ok := parseAnywhere(fs, args)
	if !ok {
		return code
	}
	switch {
	case o.Random && len(rest) == 0:
		// the change makes the path
	case !o.Random && len(rest) == 1:
		o.BasePath = normalBasePath(rest[0])
		if err := config.CheckBasePath(o.BasePath); err != nil {
			fmt.Fprintf(env.Stderr, "xdesign admin set-path: %v\n", err)
			return ExitUsage
		}
	default:
		fmt.Fprintln(env.Stderr, "xdesign admin set-path: give a path or --random")
		fmt.Fprint(env.Stderr, setPathUsage)
		return ExitUsage
	}
	return updater(env, false).ChangeAddress(ctx, o)
}

// normalBasePath adds the slashes a path may lack, as xWriter's set-path does: "abcd"
// becomes "/abcd/".
func normalBasePath(p string) string {
	if !strings.HasPrefix(p, "/") {
		p = "/" + p
	}
	if !strings.HasSuffix(p, "/") {
		p += "/"
	}
	return p
}

// parseAnywhere parses fs where the arguments may come before, between or after the flags
// ("set-port 40000 --yes"), and returns the arguments.
func parseAnywhere(fs *flag.FlagSet, args []string) (rest []string, code int, ok bool) {
	for {
		if err := fs.Parse(args); err != nil {
			if errors.Is(err, flag.ErrHelp) {
				return nil, ExitOK, false
			}
			return nil, ExitUsage, false
		}
		if fs.NArg() == 0 {
			return rest, ExitOK, true
		}
		rest, args = append(rest, fs.Arg(0)), fs.Args()[1:]
	}
}
