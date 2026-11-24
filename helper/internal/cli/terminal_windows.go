package cli

import (
	"fmt"
	"os"

	"golang.org/x/sys/windows"
)

// isTerminalFile reports whether f is a console.
func isTerminalFile(f *os.File) bool {
	var mode uint32
	return windows.GetConsoleMode(windows.Handle(f.Fd()), &mode) == nil
}

// terminalOutput reports whether f is a console that takes the terminal's sequences (the
// colors and the running step's line that is redrawn), which it turns on
// (ENABLE_VIRTUAL_TERMINAL_PROCESSING). The setting belongs to the console's screen, so
// standard error written to the same console takes them too.
func terminalOutput(f *os.File) bool {
	h := windows.Handle(f.Fd())
	var mode uint32
	if windows.GetConsoleMode(h, &mode) != nil {
		return false
	}
	if mode&windows.ENABLE_VIRTUAL_TERMINAL_PROCESSING != 0 {
		return true
	}
	return windows.SetConsoleMode(h, mode|windows.ENABLE_VIRTUAL_TERMINAL_PROCESSING) == nil
}

// echoOff turns off the echo of the console f and returns the function that restores its
// previous mode: the installer's Cloudflare API token question. Lines are still read
// whole, and Ctrl+C still stops the installer.
func echoOff(f *os.File) (func(), error) {
	h := windows.Handle(f.Fd())
	var old uint32
	if err := windows.GetConsoleMode(h, &old); err != nil {
		return nil, fmt.Errorf("read the console mode: %w", err)
	}
	quiet := old&^windows.ENABLE_ECHO_INPUT | windows.ENABLE_LINE_INPUT | windows.ENABLE_PROCESSED_INPUT
	if err := windows.SetConsoleMode(h, quiet); err != nil {
		return nil, fmt.Errorf("change the console mode: %w", err)
	}
	return func() { _ = windows.SetConsoleMode(h, old) }, nil // best effort: the console may be gone
}
