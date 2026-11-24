package platform

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

// stopOnStdin makes the app stop cleanly when its standard input closes (the server's
// XD_STOP_ON_STDIN).
const stopOnStdin = "XD_STOP_ON_STDIN=1"

// ChildProcess is the front's app process: how it starts and how it is asked to stop on
// this system.
type ChildProcess struct {
	cmd   *exec.Cmd
	stdin io.WriteCloser
	job   windows.Handle
}

// PrepareChild sets cmd up before its start (docs/plan/18-third-owner-list-2026-11-23.md
// section 8.2): a job object that ends what runs in it when its last handle closes, so the
// app ends with the helper even when the helper ends abruptly, and a pipe on the app's
// standard input with XD_STOP_ON_STDIN=1, so closing it stops the app cleanly.
func PrepareChild(cmd *exec.Cmd) (*ChildProcess, error) {
	job, err := windows.CreateJobObject(nil, nil)
	if err != nil {
		return nil, fmt.Errorf("the app's job object: %w", err)
	}
	info := windows.JOBOBJECT_EXTENDED_LIMIT_INFORMATION{
		BasicLimitInformation: windows.JOBOBJECT_BASIC_LIMIT_INFORMATION{LimitFlags: windows.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE},
	}
	//nolint:gosec // G103: SetInformationJobObject takes the structure's address and size
	_, err = windows.SetInformationJobObject(job, windows.JobObjectExtendedLimitInformation,
		uintptr(unsafe.Pointer(&info)), uint32(unsafe.Sizeof(info)))
	if err != nil {
		_ = windows.CloseHandle(job) // unused
		return nil, fmt.Errorf("the app's job object: %w", err)
	}
	stdin, err := cmd.StdinPipe()
	if err != nil {
		_ = windows.CloseHandle(job) // unused
		return nil, fmt.Errorf("the app's standard input: %w", err)
	}
	cmd.Env = append(cmd.Env, stopOnStdin)
	return &ChildProcess{cmd: cmd, stdin: stdin, job: job}, nil
}

// Started puts the started process in the job object. Until then it runs outside it: an
// error means it would not end with the helper, so the caller ends it.
func (c *ChildProcess) Started() error {
	p, err := windows.OpenProcess(windows.PROCESS_SET_QUOTA|windows.PROCESS_TERMINATE, false, uint32(c.cmd.Process.Pid)) //nolint:gosec // G115: a process ID fits in a DWORD
	if err != nil {
		return fmt.Errorf("open the app's process: %w", err)
	}
	defer func() { _ = windows.CloseHandle(p) }() // only used here
	if err := windows.AssignProcessToJobObject(c.job, p); err != nil {
		return fmt.Errorf("put the app in its job object: %w", err)
	}
	return nil
}

// Stop asks the process to stop: it closes its standard input.
func (c *ChildProcess) Stop() error {
	return c.stdin.Close() //nolint:wrapcheck // exec.Cmd.Cancel's error
}

// Release closes the job object once the process ended: anything still running in it ends
// too.
func (c *ChildProcess) Release() {
	_ = windows.CloseHandle(c.job) // the handle is ours; nothing to do on an error
}

// StartDetached starts file with args in the folder dir as a process of its own and does
// not wait for it (the uninstall that the maintenance service starts,
// docs/plan/19-uninstall-2026-11-24.md section 5): no console (DETACHED_PROCESS), a process
// group of its own, and out of this process's job object when it is in one that allows it
// (CREATE_BREAKAWAY_FROM_JOB), so neither the end of this process nor the deletion of its
// service ends it. Its standard streams are NUL.
func StartDetached(ctx context.Context, file string, args []string, dir string) error {
	start := func(flags uint32) error {
		// A fixed program with the arguments the caller builds; no shell is involved. The
		// context never ends the process: it outlives this one.
		cmd := exec.CommandContext(context.WithoutCancel(ctx), file, args...) //nolint:gosec // G204: see above
		cmd.Dir = dir
		cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: flags, HideWindow: true}
		if err := cmd.Start(); err != nil {
			return err //nolint:wrapcheck // wrapped below
		}
		return cmd.Process.Release()
	}
	const detached = windows.DETACHED_PROCESS | windows.CREATE_NEW_PROCESS_GROUP
	err := start(detached | windows.CREATE_BREAKAWAY_FROM_JOB)
	if errors.Is(err, windows.ERROR_ACCESS_DENIED) {
		// A job that allows no breakaway: the process stays in it, which ends it only when
		// the job ends what it holds as its last handle closes.
		err = start(detached)
	}
	if err != nil {
		return fmt.Errorf("start %s: %w", file, err)
	}
	return nil
}
