package app

import (
	"context"
	"crypto/tls"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/Sir-MmD/xdesign/helper/internal/backup"
	"github.com/Sir-MmD/xdesign/helper/internal/buildinfo"
	"github.com/Sir-MmD/xdesign/helper/internal/config"
	"github.com/Sir-MmD/xdesign/helper/internal/control"
	"github.com/Sir-MmD/xdesign/helper/internal/front"
	"github.com/Sir-MmD/xdesign/helper/internal/guard"
	"github.com/Sir-MmD/xdesign/helper/internal/maintenance"
	"github.com/Sir-MmD/xdesign/helper/internal/ssl"
	"github.com/Sir-MmD/xdesign/helper/internal/ssl/acme"
)

// certsDir is the HTTPS manager's folder in the data folder: /var/lib/xdesign/certs. The
// app's channel is in channel_linux.go and channel_windows.go (appSocket, controlPath).
const certsDir = "certs"

// Development front of `serve --dev` (07 section 9).
const (
	devListen    = "127.0.0.1:8443"
	devPublicURL = "https://localhost:8443"
	devLogLevel  = "info"
)

// controlCloseTimeout bounds the control requests in flight at shutdown.
const controlCloseTimeout = 5 * time.Second

// serveSetup is what serve runs: from the config file and the release folder, or for
// --dev from the repository.
type serveSetup struct {
	mode   string // port (the site's port of the config file) or dev
	listen string
	// https is the HTTPS manager's setup.
	https *httpsSetup
	// domain is the config file's domain, which a domain change starts from; publicURL the
	// site's origin, the app's XD_PUBLIC_URL; basePath the web base path, the app's
	// XD_BASE_PATH; address the full address with the web base path, which the status
	// shows.
	domain    string
	publicURL string
	basePath  string
	address   string
	logLevel  string
	slogLevel slog.Level
	dataDir   string
	// configPath is the settings file the backups take; "" for --dev.
	configPath string
	// appSocket is the app's Unix socket, "" on Windows (a port of 127.0.0.1 that the
	// front picks at each start); controlPath the control socket, or on Windows the control
	// file with the control server's port and secret.
	appSocket   string
	controlPath string
	// node, script and webDir are the app's runtime, bundle and SPA; dir its working folder.
	node, script, webDir, dir string
}

// httpsSetup is what the HTTPS manager of the site and of --dev needs
// (docs/plan/07-server-install-update.md section 4).
type httpsSetup struct {
	// dir is the state folder (<data_dir>/certs), selfSignedDir the built-in
	// certificate's folder (empty: dir).
	dir, selfSignedDir string
	// domain is the config file's domain: a name of the built-in certificate, and the
	// name of a first Let's Encrypt certificate when it is a domain name.
	domain string
	// directory is the ACME directory.
	directory string
	// port80 runs the port-80 answerer (not in --dev, which may not bind port 80).
	port80 bool
}

// cmdServe runs the front and the website: it starts the app as its child, passes every
// request to it and serves the control socket, until SIGTERM or SIGINT, or until the
// Windows service manager stops the service xdesign (docs/plan/07-server-install-update.md
// sections 1, 8 and 9, docs/plan/18-third-owner-list-2026-11-23.md section 8.2). The
// service runs it with the config file; --dev runs it on the desktop in front of the
// repository's build.
func cmdServe(ctx context.Context, args []string, _, stderr io.Writer) int {
	fs := flag.NewFlagSet("xdesign serve", flag.ContinueOnError)
	fs.SetOutput(stderr)
	configPath := fs.String("config", config.DefaultPath, "the config file")
	dev := fs.Bool("dev", false, "run on "+devPublicURL+" in front of the repository's build (make build), without a config file")
	if err := fs.Parse(args); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			return exitOK
		}
		return exitUsage
	}
	if fs.NArg() > 0 {
		fmt.Fprintf(stderr, "xdesign serve: unexpected argument %q\n", fs.Arg(0))
		return exitUsage
	}
	configSet := false
	fs.Visit(func(f *flag.Flag) { configSet = configSet || f.Name == "config" })
	if *dev && configSet {
		fmt.Fprintln(stderr, "xdesign serve: --dev reads no config file; leave out --config")
		return exitUsage
	}

	// The setup runs inside runServe, so that the Windows service writes its error to its
	// log file.
	return runServe(ctx, stderr, func(ctx context.Context, out serveOutput) error {
		var setup serveSetup
		var err error
		if *dev {
			setup, err = devSetup()
		} else {
			setup, err = configSetup(*configPath)
		}
		if err != nil {
			return err
		}
		return serve(ctx, setup, out)
	})
}

// serveOutput is where serve writes, and whom it tells that the front listens. In a
// terminal and under systemd both writers are the helper's stderr (the journal); the
// Windows service writes both to its log file, through a writer each so that their lines
// never mix (serve_linux.go, serve_windows.go).
type serveOutput struct {
	// log takes the helper's own lines, app the app's standard output and error.
	log, app io.Writer
	// listening is called once the front listens: the Windows service then reports
	// Running.
	listening func()
}

// serveFunc runs serve with its output until ctx ends.
type serveFunc func(ctx context.Context, out serveOutput) error

// serveExit writes serve's error to w and returns the exit status.
func serveExit(w io.Writer, err error) int {
	if err != nil {
		fmt.Fprintf(w, "xdesign serve: %v\n", err)
		return exitError
	}
	return exitOK
}

// configSetup reads the config file and finds the app in the release folder, the folder
// of this file (/opt/xdesign/releases/<version>; on Windows the folder of the path the
// service runs, C:\Program Files\xDesign\current, with runtime\node.exe).
func configSetup(path string) (serveSetup, error) {
	cfg, err := config.Load(path)
	if err != nil {
		return serveSetup{}, err
	}
	exe, err := os.Executable()
	if err != nil {
		return serveSetup{}, fmt.Errorf("find the release folder: %w", err)
	}
	release := filepath.Dir(exe)
	s := serveSetup{
		mode:   "port",
		listen: cfg.Listen,
		https: &httpsSetup{dir: filepath.Join(cfg.DataDir, certsDir), domain: cfg.Domain, directory: acme.DirectoryLetsEncrypt,
			port80: true},
		domain:      cfg.Domain,
		publicURL:   cfg.Origin(),
		basePath:    cfg.BasePath,
		address:     cfg.PublicURL(),
		logLevel:    cfg.LogLevel,
		slogLevel:   cfg.SlogLevel(),
		dataDir:     cfg.DataDir,
		configPath:  path,
		appSocket:   appSocket,
		controlPath: controlPath,
		node:        filepath.Join(release, "runtime", nodeFile),
		script:      filepath.Join(release, "app", "server.mjs"),
		webDir:      filepath.Join(release, "app", "web"),
		dir:         release,
	}
	for _, p := range []string{s.node, s.script} {
		if _, err := os.Stat(p); err != nil {
			return serveSetup{}, fmt.Errorf("the release folder %s has no %s: serve runs from an installed release; "+
				"on the desktop run `xdesign serve --dev`", release, filepath.Base(p))
		}
	}
	return s, nil
}

// devSetup runs the front on https://localhost:8443 in front of the repository's build,
// with the HTTPS manager's state in .dev/certs and the built-in certificate of .dev/tls:
// the working folder must be the repository's root, after `make build`. Let's Encrypt
// methods use the staging directory, and there is no port-80 answerer.
func devSetup() (serveSetup, error) {
	repo, err := os.Getwd()
	if err != nil {
		return serveSetup{}, fmt.Errorf("find the repository: %w", err)
	}
	appSock, ctlPath, err := devChannel(repo)
	if err != nil {
		return serveSetup{}, err
	}
	s := serveSetup{
		mode:   "dev",
		listen: devListen,
		https: &httpsSetup{dir: filepath.Join(repo, ".dev", certsDir), selfSignedDir: filepath.Join(repo, ".dev", "tls"),
			domain: "localhost", directory: acme.DirectoryLetsEncryptStaging},
		domain:      "localhost",
		publicURL:   devPublicURL,
		basePath:    "/",
		address:     devPublicURL + "/",
		logLevel:    devLogLevel,
		slogLevel:   slog.LevelInfo,
		dataDir:     filepath.Join(repo, ".dev", "data"),
		appSocket:   appSock,
		controlPath: ctlPath,
		script:      filepath.Join(repo, "apps", "server", "dist", "server.mjs"),
		webDir:      filepath.Join(repo, "apps", "web", "dist"),
		dir:         repo,
	}
	for _, p := range []string{s.script, filepath.Join(s.webDir, "index.html")} {
		if _, err := os.Stat(p); err != nil {
			return serveSetup{}, fmt.Errorf("serve --dev runs from the repository's root after `make build`: %s is missing", p)
		}
	}
	if s.node, err = exec.LookPath("node"); err != nil {
		return serveSetup{}, fmt.Errorf("serve --dev starts the app with node, which is not on PATH: %w", err)
	}
	return s, nil
}

// serve runs the front, the app and the control socket until ctx ends, with the HTTPS
// manager, the certificate store, the port-80 answerer and, on Windows outside --dev, the
// daily backup.
func serve(ctx context.Context, s serveSetup, out serveOutput) error {
	log := slog.New(slog.NewJSONHandler(out.log, &slog.HandlerOptions{Level: s.slogLevel}))
	info := buildinfo.Get()
	version := info.Version
	startedAt := time.Now().UTC()
	log.Info("xdesign serve", "version", version, "mode", s.mode, "address", s.address)
	updates := maintenance.New(maintenance.Config{DataDir: s.dataDir, Dev: s.mode == "dev", Domain: s.domain, Listen: s.listen,
		BasePath: s.basePath, Log: log, Build: maintenance.Build{
			Version: version, Commit: info.Commit, BuiltAt: info.BuiltAt, Arch: info.Arch, SchemaFloor: info.SchemaFloor, StartedAt: startedAt,
		}})
	// The start-count guard of an update comes first (docs/plan/07-server-install-update.md
	// section 6.3): a new release that does not serve asks the root helper for the release
	// before it, and stops.
	ctx, stop := context.WithCancelCause(ctx)
	defer stop(nil)
	var updateGuard *guard.Guard
	if s.mode != "dev" {
		g, err := guard.StartGuard(guard.Options{
			DataDir: s.dataDir, Log: log, Stop: stop,
			GoBack: func(m guard.Marker) error { return updates.GoBack(ctx, m) },
		})
		if err != nil {
			return err
		}
		updateGuard = g
		updateGuard.Watch()
	}

	var lc net.ListenConfig
	ln, err := lc.Listen(ctx, "tcp", s.listen)
	if err != nil {
		return fmt.Errorf("listen on %s (another program may use the port): %w", s.listen, err)
	}
	// The HTTPS parts stop after the front: the deferred calls run in reverse order.
	var background sync.WaitGroup
	defer background.Wait()
	bgCtx, stopBackground := context.WithCancel(ctx)
	defer stopBackground()
	var https control.HTTPS
	var tlsConfig *tls.Config
	if s.https != nil {
		mgr, cfg, err := startHTTPS(bgCtx, s, version, log, &background)
		if err != nil {
			_ = ln.Close() // not served yet
			return err
		}
		https, tlsConfig = mgr, cfg
	}
	// The control server listens first: the app's variables name it.
	endpoint, err := control.Listen(ctx, s.controlPath)
	if err != nil {
		_ = ln.Close() // not served yet
		return err
	}
	// The app creates its data folder when it is missing. The front adds the variables of
	// the app's own channel at each start (XD_SOCKET, or on Windows XD_PORT and
	// XD_PROXY_SECRET).
	child := front.NewChild(front.ChildOptions{
		Node:   s.node,
		Script: s.script,
		Dir:    s.dir,
		Env: append([]string{
			"XD_DATA_DIR=" + s.dataDir,
			"XD_WEB_DIR=" + s.webDir,
			"XD_PUBLIC_URL=" + s.publicURL,
			"XD_BASE_PATH=" + s.basePath,
			"XD_LOG_LEVEL=" + s.logLevel,
		}, endpoint.AppEnv()...),
		Socket:   s.appSocket,
		BasePath: s.basePath,
		Output:   out.app,
	}, log)
	ctl := control.Start(ctx, endpoint, control.Options{
		Status: func() control.Status {
			return control.Status{Version: version, FrontStartedAt: startedAt, App: child.Status(), Mode: s.mode, Address: s.address}
		},
		Mode:        s.mode,
		HTTPS:       https,
		Backups:     backupOptions(s, version),
		Maintenance: updates,
	}, log)

	background.Go(func() { confirmWhenReady(bgCtx, child, updateGuard, log) })
	if s.mode != "dev" {
		// On Linux xdesign-backup.timer makes them, and dailyBackups returns at once.
		background.Go(func() { dailyBackups(bgCtx, *backupOptions(s, version), log) })
	}
	// The front's listener is open: connections wait for front.Serve.
	out.listening()
	err = front.Serve(ctx, front.Options{Listener: ln, TLS: tlsConfig, Child: child, Version: version}, log)
	closeCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), controlCloseTimeout)
	defer cancel()
	if cause := context.Cause(ctx); errors.Is(cause, guard.ErrWentBack) {
		err = errors.Join(err, cause)
	}
	return errors.Join(err, ctl.Close(closeCtx))
}

// confirmWhenReady confirms an update to the start-count guard once the front serves and
// the app answers its health check; nothing without a guard.
func confirmWhenReady(ctx context.Context, child *front.Child, g *guard.Guard, log *slog.Logger) {
	if g == nil {
		return
	}
	t := time.NewTicker(time.Second)
	defer t.Stop()
	for !child.Ready() {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
	if err := g.Confirm(); err != nil {
		log.Warn("the update guard could not be confirmed", "error", err)
	}
}

// backupOptions are the site's backups (docs/plan/07-server-install-update.md section 5):
// the data folder, the config file, and the HTTPS manager's folder.
func backupOptions(s serveSetup, version string) *backup.Options {
	certs := filepath.Join(s.dataDir, certsDir)
	if s.https != nil {
		certs = s.https.dir
	}
	return &backup.Options{DataDir: s.dataDir, ConfigPath: s.configPath, CertsDir: certs, Version: version}
}

// startHTTPS opens the HTTPS manager and starts, until ctx ends, its issuances and
// renewals, the certificate store that serves its certificate (swapped without a
// restart) and, outside --dev, the port-80 answerer. It returns the manager and the TLS
// configuration of the front.
func startHTTPS(ctx context.Context, s serveSetup, version string, log *slog.Logger, background *sync.WaitGroup) (*ssl.Manager, *tls.Config, error) {
	listenIP, listenPort, err := net.SplitHostPort(s.listen)
	if err != nil {
		return nil, nil, fmt.Errorf("the listen address %s: %w", s.listen, err)
	}
	port, err := strconv.Atoi(listenPort)
	if err != nil {
		return nil, nil, fmt.Errorf("the listen port %s: %w", listenPort, err)
	}
	var store *front.Certificates
	mgr, err := ssl.Open(ssl.Options{
		Dir:           s.https.dir,
		SelfSignedDir: s.https.selfSignedDir,
		Hosts:         []string{s.https.domain},
		DefaultNames:  []string{s.https.domain},
		Directory:     s.https.directory,
		UserAgent:     "xDesign/" + version,
		ListenIP:      listenIP,
		ListenPort:    port,
		// Set once the store exists, before any issuance or request can change the
		// certificate.
		Changed: func() { store.Reload() },
	}, log)
	if err != nil {
		return nil, nil, fmt.Errorf("the https manager: %w", err)
	}
	if store, err = front.NewCertificates(ctx, mgr, []string{s.https.domain}, log); err != nil {
		return nil, nil, err
	}
	background.Go(func() { store.Run(ctx) })
	background.Go(func() { mgr.Run(ctx) })
	if s.https.port80 {
		p80 := front.NewPort80(mgr, listenIP, log)
		background.Go(func() { p80.Run(ctx) })
	}
	return mgr, store.TLSConfig(), nil
}
