package platform

import (
	"os/exec"
	"syscall"
)

// ChildProcess is the front's app process: how it starts and how it is asked to stop on
// this system.
type ChildProcess struct {
	cmd *exec.Cmd
}

// PrepareChild sets cmd up before its start: a process group of its own, so Ctrl-C in a
// terminal reaches only the parent, which then stops the child in order.
func PrepareChild(cmd *exec.Cmd) (*ChildProcess, error) {
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}
	return &ChildProcess{cmd: cmd}, nil
}

// Started does nothing on Linux: the process group is set at the start.
func (c *ChildProcess) Started() error {
	return nil
}

// Stop asks the process to stop (SIGTERM).
func (c *ChildProcess) Stop() error {
	return c.cmd.Process.Signal(syscall.SIGTERM) //nolint:wrapcheck // exec.Cmd.Cancel's error, as before the split
}

// Release does nothing on Linux.
func (c *ChildProcess) Release() {}
