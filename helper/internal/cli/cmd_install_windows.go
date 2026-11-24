package cli

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"unsafe"

	"golang.org/x/sys/windows"

	"github.com/Sir-MmD/xdesign/helper/internal/platform"
)

const installUsage = `Usage: xdesign.exe --install [flags], in a terminal opened as Administrator

Installs xDesign on this Windows server from this file alone
(docs/plan/18-third-owner-list-2026-11-23.md section 8.3). Where xDesign was installed
before, it continues an installation that stopped, installs with the data an uninstall
kept, repairs the same version, stops with the command that updates an older one
(xdesign update FILE) and refuses to replace a newer one; --yes answers each of these
questions with yes. Running it again is always safe: finished steps are skipped.
` + installFlagsUsage

// installRerun is the command that runs the installer again: this file with --install, in
// the folder it is in, or the installed xdesign on the system PATH.
func installRerun(program string) string {
	if strings.HasPrefix(strings.ToLower(program), strings.ToLower(platform.ProgramDir)+`\`) {
		return "xdesign --install"
	}
	name := "xdesign.exe"
	if program != "" {
		name = filepath.Base(program)
	}
	return `.\` + name + " --install"
}

// ownConsole reports whether the console belongs to this process alone: Explorer started
// it (a double click, or the copy the Administrator prompt started), so its window closes
// when the process ends. A terminal's shell shares its console (GetConsoleProcessList
// counts both).
func ownConsole() bool {
	list := make([]uint32, 4)
	get := windows.NewLazySystemDLL("kernel32.dll").NewProc("GetConsoleProcessList")
	if get.Find() != nil {
		return false
	}
	//nolint:gosec // G103: GetConsoleProcessList fills the list at its address
	n, _, _ := get.Call(uintptr(unsafe.Pointer(&list[0])), uintptr(len(list)))
	return n == 1
}

// holdWindow keeps the window of a double-clicked xdesign.exe open until Enter, so the
// owner reads how the installer ended (docs/plan/18-third-owner-list-2026-11-23.md section
// 8.3). In a terminal it does nothing.
func holdWindow(env *Env) {
	if !ownConsole() {
		return
	}
	fmt.Fprint(env.Stdout, "\nPress Enter to close this window.")
	_, _ = bufio.NewReader(env.Stdin).ReadString('\n') // any end closes it
}

// RunDoubleClicked is xdesign.exe started with no arguments by Explorer (a double click:
// the console belongs to this process alone), section 8.3: the installer in a window that
// asks for Administrator. Elevated already, the installer runs here; otherwise the file
// starts itself again with --install through the Administrator prompt (ShellExecute's
// "runas"), and that copy keeps its window open until Enter. A refused or cancelled prompt
// says to use a terminal opened as Administrator. ok is false when a terminal started it:
// the caller shows the usage. No manifest asks for Administrator, so `xdesign version` runs
// in any terminal.
func RunDoubleClicked(ctx context.Context, env *Env) (code int, ok bool) {
	if !ownConsole() {
		return 0, false
	}
	if platform.Elevated() {
		return RunInstall(ctx, env, nil), true
	}
	if err := runAsAdministrator(env, "--install"); err != nil {
		fmt.Fprintln(env.Stderr, "Run this in a terminal opened as Administrator.")
		holdWindow(env)
		return ExitError, true
	}
	return ExitOK, true
}

// runAsAdministrator starts this file again with args through the Administrator prompt, in
// a window of its own.
func runAsAdministrator(env *Env, args string) error {
	exe := executablePath(env)
	if exe == "" {
		return errors.New("the running file is not known")
	}
	verb, err := windows.UTF16PtrFromString("runas")
	if err != nil {
		return fmt.Errorf("start as Administrator: %w", err)
	}
	file, err := windows.UTF16PtrFromString(exe)
	if err != nil {
		return fmt.Errorf("start as Administrator: %w", err)
	}
	params, err := windows.UTF16PtrFromString(args)
	if err != nil {
		return fmt.Errorf("start as Administrator: %w", err)
	}
	dir, err := windows.UTF16PtrFromString(filepath.Dir(exe))
	if err != nil {
		return fmt.Errorf("start as Administrator: %w", err)
	}
	if err := windows.ShellExecute(0, verb, file, params, dir, windows.SW_SHOWNORMAL); err != nil {
		return fmt.Errorf("start as Administrator: %w", err)
	}
	return nil
}
