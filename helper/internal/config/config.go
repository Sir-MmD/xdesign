package config

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net"
	"os"
	"strings"

	"github.com/pelletier/go-toml/v2"

	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

// DefaultPath is the configuration file the installer writes; `xdesign serve --config`
// names another.
const DefaultPath = platform.ConfigPath

// maxFileSize bounds the config file; the real one is a few hundred bytes.
const maxFileSize = 64 << 10

// Config is the content of the configuration file.
type Config struct {
	// Listen is the address and port the front serves HTTPS on: ":<port>", a random free
	// port the installer proposes (docs/plan/07-server-install-update.md section 4).
	Listen string `toml:"listen"`
	// Domain is the name the site is opened at (design.example.com), or the server's IP
	// address when the owner gave no domain.
	Domain string `toml:"domain"`
	// BasePath is the web base path the site answers under, as xWriter's: "/" or 1 to 3
	// parts between slashes, such as the random /k3v9x2m1q8wz7r4t/ the installer proposes
	// (docs/plan/16-owner-list-2026-11-23.md sections 4 and 6). The app gets it as
	// XD_BASE_PATH.
	BasePath string `toml:"base_path"`
	// DataDir holds the database, the media, the backups and the helper's certificates.
	DataDir string `toml:"data_dir"`
	// LogLevel is debug, info, warn or error, for the front and the app alike.
	LogLevel string `toml:"log_level"`

	// File is the path the configuration was read from.
	File string `toml:"-"`
}

// Defaults returns the configuration of a file that sets only the required keys (listen
// and domain): base path /, as before there was one.
func Defaults() Config {
	return Config{BasePath: "/", DataDir: platform.DataDir, LogLevel: "info"}
}

// Load reads the config file at path, fills in the defaults and checks every value. A
// *ValidationError lists every problem found, each naming its key.
func Load(path string) (*Config, error) {
	data, err := readFile(path)
	if err != nil {
		return nil, err
	}
	return Parse(data, path)
}

// Parse reads the content of the config file at path, as Load does after reading it: the
// installer reads the file itself and checks what it found or is about to write.
func Parse(data []byte, path string) (*Config, error) {
	cfg := Defaults()
	cfg.File = path
	if problems := decode(data, &cfg); len(problems) > 0 {
		return nil, &ValidationError{Source: path, Problems: problems}
	}
	if problems := cfg.validate(); len(problems) > 0 {
		return nil, &ValidationError{Source: path, Problems: problems}
	}
	return &cfg, nil
}

// Render returns the content of the config file for c, which Parse reads back as c.
func Render(c Config) ([]byte, error) {
	data, err := toml.Marshal(c)
	if err != nil {
		return nil, fmt.Errorf("write the config file: %w", err)
	}
	return append([]byte(fileHeader), data...), nil
}

// Origin returns the site's origin, the app's XD_PUBLIC_URL: https with the domain, and
// the port when it is not 443.
func (c *Config) Origin() string {
	host := c.Domain
	if strings.Contains(host, ":") {
		host = "[" + host + "]" // an IPv6 address
	}
	if _, port, err := net.SplitHostPort(c.Listen); err == nil && port != "443" {
		host = net.JoinHostPort(c.Domain, port)
	}
	return "https://" + host
}

// PublicURL returns the site's full address, the one people open: the origin with the web
// base path, ending with / (https://design.example.com:34567/k3v9x2m1q8wz7r4t/).
func (c *Config) PublicURL() string {
	return c.Origin() + c.BasePath
}

// SlogLevel returns the helper's log level for LogLevel.
func (c *Config) SlogLevel() slog.Level {
	return slogLevels()[c.LogLevel]
}

// slogLevels maps the accepted log levels, which the app's pino names the same way, to the
// helper's.
func slogLevels() map[string]slog.Level {
	return map[string]slog.Level{
		"debug": slog.LevelDebug,
		"info":  slog.LevelInfo,
		"warn":  slog.LevelWarn,
		"error": slog.LevelError,
	}
}

// readFile reads the config file, refusing anything that is not a small regular file.
func readFile(path string) ([]byte, error) {
	f, err := os.Open(path) //nolint:gosec // G304: the config path is the default or the operator's --config
	if errors.Is(err, fs.ErrNotExist) {
		return nil, fmt.Errorf("the config file %s does not exist: the installer writes it; "+
			"on the desktop run `xdesign serve --dev`", path)
	}
	if err != nil {
		return nil, fmt.Errorf("read the config file: %w", err)
	}
	defer func() { _ = f.Close() }() // read-only: closing cannot lose data
	info, err := f.Stat()
	if err != nil {
		return nil, fmt.Errorf("read the config file: %w", err)
	}
	if !info.Mode().IsRegular() {
		return nil, fmt.Errorf("the config file %s is not a regular file", path)
	}
	data, err := io.ReadAll(io.LimitReader(f, maxFileSize+1))
	if err != nil {
		return nil, fmt.Errorf("read the config file: %w", err)
	}
	if len(data) > maxFileSize {
		return nil, fmt.Errorf("the config file %s is larger than %d bytes", path, maxFileSize)
	}
	return data, nil
}

// decode reads TOML into cfg, which holds the defaults: keys absent from the file keep
// them. Unknown keys are errors, so a misspelled key never passes silently.
func decode(data []byte, cfg *Config) []string {
	dec := toml.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	err := dec.Decode(cfg)
	if err == nil {
		return nil
	}
	if strict, ok := errors.AsType[*toml.StrictMissingError](err); ok {
		problems := make([]string, 0, len(strict.Errors))
		for i := range strict.Errors {
			row, _ := strict.Errors[i].Position()
			problems = append(problems, fmt.Sprintf("line %d: unknown key %s", row, keyName(strict.Errors[i].Key())))
		}
		return problems
	}
	if de, ok := errors.AsType[*toml.DecodeError](err); ok {
		row, col := de.Position()
		return []string{fmt.Sprintf("line %d, column %d: %s", row, col, strings.TrimPrefix(de.Error(), "toml: "))}
	}
	return []string{strings.TrimPrefix(err.Error(), "toml: ")}
}

// keyName formats a TOML key path as section and key: [listen] port.
func keyName(key toml.Key) string {
	switch len(key) {
	case 0:
		return "(unknown)"
	case 1:
		return key[0]
	default:
		return "[" + strings.Join(key[:len(key)-1], ".") + "] " + key[len(key)-1]
	}
}

// ValidationError lists the problems of a config file.
type ValidationError struct {
	// Source is the config file.
	Source string
	// Problems are the messages, each naming its key.
	Problems []string
}

func (e *ValidationError) Error() string {
	if len(e.Problems) == 1 {
		return fmt.Sprintf("invalid configuration in %s: %s", e.Source, e.Problems[0])
	}
	return fmt.Sprintf("invalid configuration in %s:\n  %s", e.Source, strings.Join(e.Problems, "\n  "))
}
