package host

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/netip"
	"os"
	"strings"
	"time"
)

// System bundles the operating system interfaces.
type System struct {
	Runner  Runner
	FS      FS
	Users   Users
	Machine Machine
}

// OS returns the real operating system.
func OS() System {
	return System{Runner: ExecRunner{}, FS: OSFS{}, Users: OSUsers{}, Machine: OSMachine{}}
}

// Cmd is one command to run, without a shell.
type Cmd struct {
	// Name is the program, looked up in PATH unless it contains a slash.
	Name string
	// Args are the arguments after the program name.
	Args []string
	// Env holds extra KEY=VALUE pairs added to the inherited environment. They are
	// shown in front of the command in its shell form, like a shell would take them.
	Env []string
	// Stdin is the standard input; nil means an empty input.
	Stdin []byte
	// StdinFile, when set, is the standard input instead of Stdin: the program reads the
	// open file itself, from its current offset (the staged dump that the root helper of
	// a panel restore opened once, docs/plan/16-post-v1-updates.md section 7.3).
	StdinFile *os.File
	// StatusOut, when set, gets what the program writes to file descriptor 3: a pipe
	// the program receives besides its standard streams, for machine-readable progress
	// such as apt-get's -o APT::Status-Fd=3 (docs/plan/18-install-ssl-update.md section
	// 4.3). [ExecRunner] opens it in Run and Stream; the simulated runners leave it
	// silent.
	StatusOut io.Writer
	// SecretStdin marks Stdin as secret (a password): logs never show it.
	SecretStdin bool
	// SecretOutput marks the output as secret (generated credentials): logs never
	// show it.
	SecretOutput bool
	// Timeout bounds the run; zero means [DefaultTimeout].
	Timeout time.Duration
}

// DefaultTimeout bounds a command whose Cmd.Timeout is zero. Package installations
// are the slowest commands of the installer.
const DefaultTimeout = 30 * time.Minute

// Command returns the command name with args.
func Command(name string, args ...string) Cmd {
	return Cmd{Name: name, Args: args}
}

// String formats the command in shell form, with the environment additions first,
// quoting where a shell would need it. Standard input is not shown.
func (c Cmd) String() string {
	words := make([]string, 0, len(c.Env)+1+len(c.Args))
	for _, kv := range c.Env {
		k, v, _ := strings.Cut(kv, "=")
		words = append(words, k+"="+Quote(v))
	}
	words = append(words, Quote(c.Name))
	for _, a := range c.Args {
		words = append(words, Quote(a))
	}
	return strings.Join(words, " ")
}

// Result is the outcome of a command that ran.
type Result struct {
	Stdout   []byte
	Stderr   []byte
	ExitCode int
}

// OK reports whether the command exited with status 0.
func (r Result) OK() bool {
	return r.ExitCode == 0
}

// Out returns the standard output without surrounding white space.
func (r Result) Out() string {
	return strings.TrimSpace(string(r.Stdout))
}

// Err returns nil for exit status 0, otherwise an [*ExitError] for cmd.
func (r Result) Err(cmd Cmd) error {
	if r.OK() {
		return nil
	}
	detail := strings.TrimSpace(string(r.Stderr))
	if detail == "" && !cmd.SecretOutput {
		detail = strings.TrimSpace(string(r.Stdout))
	}
	return &ExitError{Cmd: cmd.String(), Code: r.ExitCode, Detail: lastLines(detail, 5)}
}

// lastLines returns at most n last lines of s.
func lastLines(s string, n int) string {
	lines := strings.Split(s, "\n")
	if len(lines) > n {
		lines = lines[len(lines)-n:]
	}
	return strings.Join(lines, "\n")
}

// ExitError reports a command that ran and exited with a non-zero status.
type ExitError struct {
	// Cmd is the command in shell form.
	Cmd string
	// Code is the exit status.
	Code int
	// Detail is the end of the command's error output (or of its output when it
	// wrote no errors).
	Detail string
}

func (e *ExitError) Error() string {
	if e.Detail == "" {
		return fmt.Sprintf("%s: exit status %d", e.Cmd, e.Code)
	}
	return fmt.Sprintf("%s: exit status %d: %s", e.Cmd, e.Code, e.Detail)
}

// ErrCommandNotFound is returned by [Runner.Run] for a program that is not
// installed.
var ErrCommandNotFound = errors.New("command not found")

// Runner runs commands.
type Runner interface {
	// Run runs cmd and waits for it. The error is non-nil only when the command
	// could not run at all: ErrCommandNotFound, a start failure, or a cancelled or
	// expired context. A command that ran and failed reports its status in
	// Result.ExitCode.
	Run(ctx context.Context, cmd Cmd) (Result, error)
}

// Streamer runs a command whose output goes to the given writers as it comes, for
// output the owner watches (xdesign admin logs -f). The runners of [OS] and of the
// fakes implement it besides [Runner].
type Streamer interface {
	// Stream runs cmd and returns its exit status. The error is non-nil only when the
	// command could not run at all, as for Runner.Run; Cmd.Stdin and Cmd.Timeout apply.
	Stream(ctx context.Context, cmd Cmd, stdout, stderr io.Writer) (exitCode int, err error)
}

// Owner is a numeric owner and group.
type Owner struct {
	UID, GID int
}

// Root is the owner root:root.
func Root() Owner {
	return Owner{}
}

// FS is the file system. Every path is absolute.
type FS interface {
	// Stat describes the file at name, following symbolic links.
	Stat(name string) (fs.FileInfo, error)
	// Lstat describes the file at name without following a final symbolic link.
	Lstat(name string) (fs.FileInfo, error)
	// Owner returns the owner of the file at name, following symbolic links.
	Owner(name string) (Owner, error)
	// ReadFile returns the content of the file at name.
	ReadFile(name string) ([]byte, error)
	// ReadDir lists the directory at name, sorted by name.
	ReadDir(name string) ([]fs.DirEntry, error)
	// Readlink returns the target of the symbolic link at name.
	Readlink(name string) (string, error)
	// Open opens the file at name for reading.
	Open(name string) (io.ReadCloser, error)
	// WriteFile replaces the file at name atomically: it writes a temporary file in
	// the same directory with perm and owner, flushes it to disk and renames it over
	// name, so readers see the old or the new content, never a mix.
	WriteFile(name string, data []byte, perm fs.FileMode, owner Owner) error
	// OpenAppend opens the file at name for appending, creating it with perm when it
	// does not exist.
	OpenAppend(name string, perm fs.FileMode) (io.WriteCloser, error)
	// MkdirAll creates the directory at name and missing parents with perm; existing
	// directories are left as they are.
	MkdirAll(name string, perm fs.FileMode) error
	// Chmod sets the permission bits of the file at name.
	Chmod(name string, perm fs.FileMode) error
	// Chown sets the owner of the file at name, following symbolic links.
	Chown(name string, owner Owner) error
	// Symlink creates the symbolic link name pointing to target. It fails when
	// name exists.
	Symlink(target, name string) error
	// Rename renames (moves) oldname to newname, replacing a file or an empty
	// directory at newname.
	Rename(oldname, newname string) error
	// Remove removes the file or empty directory at name.
	Remove(name string) error
	// RemoveAll removes name and everything below it; a missing name is not an error.
	RemoveAll(name string) error
}

// ErrUnknownUser is returned by [Users] for a user or group that does not exist.
var ErrUnknownUser = errors.New("no such user or group")

// Users looks up users and groups.
type Users interface {
	// LookupUser returns the user ID and primary group ID of the user name.
	LookupUser(name string) (uid, gid int, err error)
	// LookupGroup returns the ID of the group name.
	LookupGroup(name string) (gid int, err error)
}

// Statfs is what the installer needs to know about a mounted file system.
type Statfs struct {
	// Free is the space available to unprivileged users, in bytes.
	Free uint64
	// NoExec reports that programs on the file system cannot run (mount option
	// noexec).
	NoExec bool
}

// Machine reports facts about the machine.
type Machine interface {
	// Euid returns the effective user ID of this process.
	Euid() int
	// Arch returns the hardware name of the kernel, the output of uname -m
	// ("x86_64", "aarch64").
	Arch() (string, error)
	// Statfs describes the file system that holds path.
	Statfs(path string) (Statfs, error)
	// ProbePort binds ip:port for a moment and returns nil when that worked, so the
	// port is free.
	ProbePort(ctx context.Context, ip string, port int) error
	// Hostname returns the host name.
	Hostname() (string, error)
	// GlobalAddrs returns the global unicast addresses of the network interfaces.
	GlobalAddrs() ([]netip.Addr, error)
}
