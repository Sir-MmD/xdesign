package cli

import (
	"fmt"
	"os"

	"golang.org/x/sys/unix"
)

// isTerminalFile reports whether f is a terminal.
func isTerminalFile(f *os.File) bool {
	_, err := unix.IoctlGetTermios(int(f.Fd()), unix.TCGETS)
	return err == nil
}

// terminalOutput reports whether f is a terminal that takes the terminal's sequences (the
// colors and the running step's line that is redrawn): every Linux terminal does.
func terminalOutput(f *os.File) bool {
	return isTerminalFile(f)
}

// echoOff turns off the echo of the terminal f and returns the function that restores
// its previous settings: the installer's Cloudflare API token question (xWriter's).
func echoOff(f *os.File) (func(), error) {
	fd := int(f.Fd())
	old, err := unix.IoctlGetTermios(fd, unix.TCGETS)
	if err != nil {
		return nil, fmt.Errorf("read the terminal settings: %w", err)
	}
	quiet := *old
	quiet.Lflag &^= unix.ECHO
	quiet.Lflag |= unix.ICANON | unix.ISIG
	if err := unix.IoctlSetTermios(fd, unix.TCSETS, &quiet); err != nil {
		return nil, fmt.Errorf("change the terminal settings: %w", err)
	}
	return func() { _ = unix.IoctlSetTermios(fd, unix.TCSETS, old) }, nil // best effort: the terminal may be gone
}
